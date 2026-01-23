// src/hooks/useGhostStream.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useFileTransfer } from './useFileTransfer';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export const useGhostStream = () => {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);
  
  const searchParams = useSearchParams();
  const addLog = (msg: string) => setLogs(prev => [msg, ...prev.slice(0, 9)]);

  const { 
    progress, 
    transferSpeed, 
    sendFile, 
    handleReceiveData, 
    suspendTransfer 
  } = useFileTransfer({ peerRef, addLog });

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;

    socket.on('connect', () => addLog(`🔌 Connected (ID: ${socket.id?.slice(0, 4)}...)`));
    socket.on("user_joined", (id) => { addLog(`👤 User joined!`); callUser(id); });
    socket.on("receiving_call", (data) => { addLog(`📞 Receiving call...`); acceptCall(data); });
    socket.on("call_accepted", (signal) => { addLog("✅ Connection Locked"); peerRef.current?.signal(signal); });
    
    socket.on("user_disconnected", () => {
      addLog("🔴 Peer disconnected.");
      resetConnection();
    });

    socket.on("room_full", () => {
        addLog("⛔ Room Full.");
        setStatus("full");
        socket.disconnect();
    });

    const urlRoomId = searchParams.get('room');
    if (urlRoomId) {
        setRoomId(urlRoomId);
        setTimeout(() => {
            if (socket.connected) {
                socket.emit('join_room', urlRoomId);
                addLog(`🔐 Joining Secure Room...`);
            }
        }, 500);
    }

    const handleTabClose = () => socket.disconnect();
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      socket.disconnect();
    };
  }, [searchParams]);

  const createSecureRoom = () => {
    const newId = uuidv4();
    setRoomId(newId);
    socketRef.current?.emit('join_room', newId);
    addLog(`🛡️ Room Created: ${newId.slice(0,8)}...`);
    window.history.pushState({}, '', `?room=${newId}`);
  };

  const resetConnection = () => {
    peerRef.current?.destroy();
    suspendTransfer(); 
    
    setRoomId('');
    window.history.pushState({}, '', window.location.pathname);
    setStatus("idle");
    addLog("🔒 Session Ended.");
  };

  const handlePeerEvents = (peer: PeerInstance) => {
    peer.on("connect", () => { setStatus("connected"); addLog("🚀 Tunnel Established"); });
    peer.on("data", handleReceiveData);
    peer.on("close", () => { addLog("🔴 Connection Closed"); resetConnection(); });
    peer.on("error", (err) => { addLog(`⚠️ Error: ${err.message}`); setStatus("idle"); });
  };

  const callUser = (id: string) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: true, trickle: false });
    peer.on("signal", (data) => socketRef.current?.emit("call_user", { userToCall: id, signalData: data, from: socketRef.current.id }));
    handlePeerEvents(peer);
    peerRef.current = peer;
  };

  const acceptCall = (data: any) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: false, trickle: false });
    peer.on("signal", (signal) => socketRef.current?.emit("answer_call", { signal, to: data.from }));
    handlePeerEvents(peer);
    peer.signal(data.signal);
    peerRef.current = peer;
  };

  const joinRoom = () => {
    if (roomId && socketRef.current) socketRef.current.emit('join_room', roomId);
  };

  return {
    roomId, setRoomId, joinRoom, createSecureRoom,
    status, logs, progress, transferSpeed, sendFile
  };
};