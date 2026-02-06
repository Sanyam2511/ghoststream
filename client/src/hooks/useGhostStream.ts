// src/hooks/useGhostStream.ts
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { useFileTransfer } from './useFileTransfer';
import { MODES, TransferMode } from '../utils/modes';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const IDLE_TIMEOUT = 10 * 60 * 1000;
const DESTRUCT_DELAY = 30000;

export const useGhostStream = () => {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<PeerInstance | null>(null);

  const [warning, setWarning] = useState<{ text: string; timer: number } | null>(null);
  
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const destructTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const searchParams = useSearchParams();

  // --- CYBERPUNK LOGGING ---
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false }); // 14:30:22
    setLogs(prev => [`${time} | ${msg}`, ...prev.slice(0, 9)]);
  };

  const [transferMode, setTransferMode] = useState<TransferMode>('balanced');

  const destroySession = (reason: string) => {
    if (peerRef.current) peerRef.current.destroy();
    
    setRoomId('');
    window.history.pushState({}, '', window.location.pathname);
    setStatus("idle");
    addLog(`SYS  : Session Destroyed: ${reason}`);
    
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (destructTimerRef.current) clearTimeout(destructTimerRef.current);
    destructTimerRef.current = null;
    setWarning(null);
  };

  const handleRemoteCancel = () => {
      if (destructTimerRef.current) {
          clearTimeout(destructTimerRef.current);
          destructTimerRef.current = null;
      }
      setWarning(null);
      addLog("INFO : Peer cancelled auto-destruct.");
      resetIdleTimer();
  };

  const cancelSelfDestruct = () => {
      if (destructTimerRef.current) {
          clearTimeout(destructTimerRef.current);
          destructTimerRef.current = null;
      }
      setWarning(null);
      addLog("INFO : Auto-destruct cancelled.");
      resetIdleTimer();

      if (peerRef.current) {
          peerRef.current.send(JSON.stringify({ type: 'system_cancel_destruct' }));
      }
  };

  const { 
    progress, 
    transferSpeed, 
    sendFiles,
    queueCount,
    cancelTransfer,
    handleReceiveData, 
    suspendTransfer,
    messages,
    sendChat,
    incomingRequest, acceptRequest, rejectRequest, latency,
  } = useFileTransfer({ 
      peerRef, 
      addLog,
      transferMode,
      onTransferComplete: () => {
          if (destructTimerRef.current) return;

          addLog(`SYS  : Transfer complete. Auto-closing in ${DESTRUCT_DELAY/1000}s...`);
          setWarning({ text: "Transfer Complete. Room closing in", timer: 10 });

          destructTimerRef.current = setTimeout(() => {
              destroySession("Transfer Finished");
          }, DESTRUCT_DELAY);
      },
      onRemoteCancel: handleRemoteCancel
  });
  const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      if (status === 'connected') {
          idleTimerRef.current = setTimeout(() => {
              destroySession("Timeout (10min Idle)");
          }, IDLE_TIMEOUT);
      }
  };

  useEffect(() => {
      if (latency === null) return;
      if (latency > 150 && transferMode !== 'stable') {
          addLog("NET  : High latency detected. Mode: Stable.");
          setTransferMode('stable');
      }
      else if (latency < 30 && transferMode !== 'speed') {
         addLog("NET  : Low latency. Mode: Speed.");
      }
  }, [latency]);

  useEffect(() => {
      if (status === 'connected') {
          resetIdleTimer();
      }
      return () => {
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      };
  }, [status]);
  
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    const socket = socketRef.current;
    socket.on('connect', () => {
        addLog(`CONN : Connected (ID: ${socket.id?.slice(0, 4)}...)`);
        
        const urlRoomId = searchParams.get('room');
        if (urlRoomId) {
            setRoomId(urlRoomId);
            socket.emit('join_room', urlRoomId);
            addLog(`AUTH : Joining Room from Link...`);
        }
    });

    socket.on("user_joined", (id) => { addLog(`PEER : User joined room.`); callUser(id); });
    socket.on("receiving_call", (data) => { addLog(`PEER : Incoming connection request...`); acceptCall(data); });
    socket.on("call_accepted", (signal) => { addLog("SEC  : Connection established (P2P)."); peerRef.current?.signal(signal); });
    
    socket.on("user_disconnected", () => {
      addLog("PEER : Peer disconnected.");
      resetConnection();
    });

    socket.on("room_full", () => {
        addLog("ERR  : Room is full.");
        setStatus("full");
        socket.disconnect();
    });

    const urlRoomId = searchParams.get('room');
    if (urlRoomId) {
        setRoomId(urlRoomId);
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
    addLog(`SYS  : Secure room created: ${newId.slice(0,8)}...`);
    window.history.pushState({}, '', `?room=${newId}`);
  };

  const resetConnection = () => {
    peerRef.current?.destroy();
    suspendTransfer(); 
    
    setRoomId('');
    window.history.pushState({}, '', window.location.pathname);
    setStatus("idle");
    addLog("SYS  : Session Ended.");
    
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (destructTimerRef.current) clearTimeout(destructTimerRef.current);
    setWarning(null);
  };

  const handlePeerEvents = (peer: PeerInstance) => {
    peer.on("connect", () => { 
        setStatus("connected"); 
        addLog("NET  : P2P Tunnel Established."); 
        resetIdleTimer();
    });
    
    peer.on("data", (data) => {
        handleReceiveData(data);
        resetIdleTimer();
    });
    
    peer.on("close", () => { addLog("NET  : P2P Connection Closed."); resetConnection(); });
    peer.on("error", (err) => { addLog(`ERR  : WebRTC Error: ${err.message}`); setStatus("idle"); });
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
    status, logs, progress, transferSpeed, sendFiles, queueCount, cancelTransfer,
    messages, sendChat, incomingRequest, acceptRequest, rejectRequest, latency,
    warning, cancelSelfDestruct,transferMode, setTransferMode,
  };
};