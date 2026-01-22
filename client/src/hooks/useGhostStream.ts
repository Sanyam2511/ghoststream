// src/hooks/useGhostStream.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useGhostStream = () => {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string } | null>(null);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  const suspendedFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[], id: string } | null>(null);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev.slice(0, 9)]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('connect', () => addLog(`🔌 Server Connected (ID: ${socket.id?.slice(0, 4)}...)`));
    socket.on("user_joined", (userId) => { addLog(`👤 User joined! Calling...`); callUser(userId); });
    socket.on("receiving_call", (data) => { addLog(`📞 Receiving call...`); acceptCall(data); });
    socket.on("call_accepted", (signal) => { addLog("✅ Call accepted! Locking signal..."); peerRef.current?.signal(signal); });
    
    socket.on("user_disconnected", () => {
      addLog("🔴 Peer disconnected (Socket). Resetting...");
      resetConnection();
    });

    const handleTabClose = () => { socket.disconnect(); };
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      socket.disconnect();
    };
  }, []);

const resetConnection = () => {
  if (peerRef.current) peerRef.current.destroy();
  
  if (receivingFile.current) {
      addLog(`⚠️ Connection lost! Saving progress at ${Math.round((receivingFile.current.received / receivingFile.current.size) * 100)}%`);
      suspendedFile.current = { ...receivingFile.current, id: `${receivingFile.current.name}-${receivingFile.current.size}` };
      receivingFile.current = null; 
  } else {
      setProgress(0);
  }

  setStatus("idle");
  setTransferSpeed('');
};

  const handlePeerEvents = (peer: PeerInstance) => {
    peer.on("connect", () => { setStatus("connected"); addLog("🚀 P2P Tunnel Established"); });
    peer.on("data", handleReceiveData);
    peer.on("close", () => { addLog("🔴 Peer disconnected. Connection closed."); resetConnection(); });
    peer.on("error", (err) => { addLog(`⚠️ Peer Error: ${err.message}`); setStatus("idle"); });
  };

  const callUser = (userToCallId: string) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: true, trickle: false });
    peer.on("signal", (data) => socketRef.current?.emit("call_user", { userToCall: userToCallId, signalData: data, from: socketRef.current.id }));
    handlePeerEvents(peer);
    peerRef.current = peer;
  };

  const acceptCall = (incomingData: any) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: false, trickle: false });
    peer.on("signal", (data) => socketRef.current?.emit("answer_call", { signal: data, to: incomingData.from }));
    handlePeerEvents(peer);
    peer.signal(incomingData.signal);
    peerRef.current = peer;
  };

  const joinRoom = () => {
    if (roomId && socketRef.current) {
      socketRef.current.emit('join_room', roomId);
      addLog(`Attempting join: ${roomId}`);
    }
  };

const pendingFile = useRef<File | null>(null);

const sendFile = (file: File) => {
  if (!peerRef.current) return;
  
  pendingFile.current = file;
  addLog(`📤 Proposing: ${file.name}`);
  
  peerRef.current.send(JSON.stringify({ type: 'header', name: file.name, size: file.size }));
};

const startStreamingFile = (startingOffset: number) => {
  const file = pendingFile.current;
  if (!file || !peerRef.current) return;

  if (startingOffset > 0) {
      addLog(`⏩ Resuming transfer from ${(startingOffset / 1024 / 1024).toFixed(2)} MB`);
  } else {
      addLog(`🚀 Starting transfer...`);
  }

  lastSpeedRef.current = { bytes: startingOffset, time: Date.now() };
  
  const chunkSize = 64 * 1024;
  let offset = startingOffset;

  const readSlice = (o: number) => {
    const slice = file.slice(o, o + chunkSize);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result || !peerRef.current) return;
      const chunk = new Uint8Array(event.target.result as ArrayBuffer);
      const canSendMore = peerRef.current.write(chunk);
      
      offset += chunk.byteLength;
      setProgress(Math.round((offset / file.size) * 100));
      
      const now = Date.now();
      const timeDiff = (now - lastSpeedRef.current.time) / 1000;
      if (timeDiff > 0.5) {
          const speed = ((offset - lastSpeedRef.current.bytes) / 1024 / 1024) / timeDiff;
          setTransferSpeed(`${speed.toFixed(2)} MB/s`);
          lastSpeedRef.current = { bytes: offset, time: now };
      }

      if (offset < file.size) {
        canSendMore ? readSlice(offset) : peerRef.current.once('drain', () => readSlice(offset));
      } else {
        addLog("✅ File Sent!");
        setTransferSpeed('Done');
        setProgress(0);
        pendingFile.current = null;
      }
    };
    reader.readAsArrayBuffer(slice);
  };
  readSlice(startingOffset);
};

const handleReceiveData = (data: any) => {
  const strData = data.toString();

  if (strData.includes('"type":"header"')) {
    try {
      const header = JSON.parse(strData);
      const fileId = `${header.name}-${header.size}`;
      
      let resumeOffset = 0;

      if (suspendedFile.current && suspendedFile.current.id === fileId) {
          addLog(`🔄 Found incomplete transfer! Resuming from ${Math.round((suspendedFile.current.received / suspendedFile.current.size) * 100)}%`);
          resumeOffset = suspendedFile.current.received;
          receivingFile.current = suspendedFile.current;
          suspendedFile.current = null;
      } else {
          addLog(`📥 Incoming: ${header.name}`);
          receivingFile.current = { name: header.name, size: header.size, received: 0, chunks: [], id: fileId };
      }

      peerRef.current?.send(JSON.stringify({ type: 'resume_ack', offset: resumeOffset }));
      
      lastSpeedRef.current = { bytes: resumeOffset, time: Date.now() };
      return;
    } catch (e) { console.error(e); }
  }

  if (strData.includes('"type":"resume_ack"')) {
      const ack = JSON.parse(strData);
      startStreamingFile(ack.offset); 
      return;
  }

  if (receivingFile.current) {
      const file = receivingFile.current;
      file.chunks.push(data);
      file.received += data.byteLength;
      setProgress(Math.round((file.received / file.size) * 100));
      
      if (file.received >= file.size) {
        const blob = new Blob(file.chunks);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        
        receivingFile.current = null;
        suspendedFile.current = null;
        setProgress(0);
        setTransferSpeed('Complete');
        addLog("💾 Downloaded!");
      }
  }
};

  return {
    roomId, setRoomId, joinRoom, status, logs, progress, transferSpeed, sendFile
  };
};