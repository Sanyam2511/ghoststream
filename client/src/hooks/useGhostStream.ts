// src/hooks/useGhostStream.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useGhostStream = () => {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, connected, full
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');

  // Grab URL params (e.g. ?room=a1b2-c3d4)
  const searchParams = useSearchParams();

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  
  // File Refs
  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string } | null>(null);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  const suspendedFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[], id: string } | null>(null);
  const pendingFile = useRef<File | null>(null);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev.slice(0, 9)]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('connect', () => addLog(`🔌 Server Connected (ID: ${socket.id?.slice(0, 4)}...)`));
    
    // STANDARD HANDSHAKE EVENTS
    socket.on("user_joined", (userId) => { addLog(`👤 User joined! Calling...`); callUser(userId); });
    socket.on("receiving_call", (data) => { addLog(`📞 Receiving call...`); acceptCall(data); });
    socket.on("call_accepted", (signal) => { addLog("✅ Call accepted! Locking signal..."); peerRef.current?.signal(signal); });
    
    // DISCONNECT HANDLING
    socket.on("user_disconnected", () => {
      addLog("🔴 Peer disconnected (Socket). Resetting...");
      resetConnection();
    });

    // SECURITY: HANDLE ROOM FULL
    socket.on("room_full", () => {
        addLog("⛔ Security Alert: Room is full (Max 2 peers).");
        setStatus("full"); 
        socket.disconnect();
    });

    // AUTO-JOIN LOGIC (If ?room= exists in URL)
    const urlRoomId = searchParams.get('room');
    if (urlRoomId) {
        setRoomId(urlRoomId);
        // Small delay to ensure socket is ready
        setTimeout(() => {
            if (socket.connected) {
                socket.emit('join_room', urlRoomId);
                addLog(`🔐 Secure Link Detected. Joining Room...`);
            }
        }, 500);
    }

    const handleTabClose = () => { socket.disconnect(); };
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      socket.disconnect();
    };
  }, [searchParams]);

  // --- NEW: CREATE SECURE ROOM ---
  const createSecureRoom = () => {
    const newId = uuidv4();
    setRoomId(newId);
    
    if (socketRef.current) {
        socketRef.current.emit('join_room', newId);
        addLog(`🛡️ Created Secure Room: ${newId.slice(0,8)}...`);
    }
    
    // Update URL without refreshing page
    window.history.pushState({}, '', `?room=${newId}`);
  };

  const resetConnection = () => {
    if (peerRef.current) peerRef.current.destroy();
    
    // 1. Handle File Suspension (Keep this!)
    if (receivingFile.current) {
        addLog(`⚠️ Connection lost! Saving progress at ${Math.round((receivingFile.current.received / receivingFile.current.size) * 100)}%`);
        suspendedFile.current = { ...receivingFile.current, id: `${receivingFile.current.name}-${receivingFile.current.size}` };
        receivingFile.current = null; 
    } else {
        setProgress(0);
    }

    // 2. BURN THE LINK (The Fix)
    setRoomId(''); // Clear the ID from memory
    window.history.pushState({}, '', window.location.pathname); // Remove ?room=xyz from URL
    
    // 3. Reset UI
    setStatus("idle");
    setTransferSpeed('');
    addLog("🔒 Link expired. Session ended.");
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

  // --- FILE TRANSFER LOGIC ---
  const sendFile = (file: File) => {
    if (!peerRef.current) return;
    
    pendingFile.current = file;
    addLog(`📤 Proposing: ${file.name}`);
    
    // Send Header first, wait for ACK
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

    // 1. HEADER HANDSHAKE
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

        // Send ACK with offset
        peerRef.current?.send(JSON.stringify({ type: 'resume_ack', offset: resumeOffset }));
        
        lastSpeedRef.current = { bytes: resumeOffset, time: Date.now() };
        return;
      } catch (e) { console.error(e); }
    }

    // 2. ACK HANDSHAKE
    if (strData.includes('"type":"resume_ack"')) {
        const ack = JSON.parse(strData);
        startStreamingFile(ack.offset); 
        return;
    }

    // 3. DATA STREAM
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
    roomId, 
    setRoomId, 
    joinRoom, 
    createSecureRoom, // EXPORTED THIS NEW FUNCTION
    status, 
    logs, 
    progress, 
    transferSpeed, 
    sendFile
  };
};