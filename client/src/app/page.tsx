"use client";
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';

// Initialize socket outside component to prevent re-connections on render
let socket: Socket;

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Refs are better than State for these because they don't trigger re-renders
  const peerRef = useRef<PeerInstance | null>(null);
  const myVideo = useRef<HTMLVideoElement>(null); // Placeholder for future media

  useEffect(() => {
    socket = io('http://localhost:3001');

    socket.on('connect', () => {
        addLog(`Connected to Signaling Server (ID: ${socket.id})`);
    });

    // 1. HOST LOGIC: Someone joined my room! I must call them.
    socket.on("user_joined", (userId) => {
        addLog(`User ${userId} joined! Initiating WebRTC connection...`);
        callUser(userId);
    });

    // 2. GUEST LOGIC: I am receiving a call from the Host.
    socket.on("receiving_call", (data) => {
        addLog(`Receiving call from ${data.from}. Accepting...`);
        acceptCall(data);
    });

    // 3. HOST LOGIC: The Guest accepted! Finalize handshake.
    socket.on("call_accepted", (signal) => {
        addLog("Call accepted! Finalizing connection...");
        peerRef.current?.signal(signal);
    });

    return () => { socket.disconnect(); };
  }, []);

  // --- HANDSHAKE FUNCTIONS ---

  // Called by Host
  const callUser = (userToCallId: string) => {
    // initiator: true means "I am starting this call"
    const peer = new SimplePeer({ initiator: true, trickle: false });

    // Step A: Generate my "Offer" signal
    peer.on("signal", (data) => {
        socket.emit("call_user", {
            userToCall: userToCallId,
            signalData: data,
            from: socket.id
        });
    });

    peer.on("connect", () => {
        setStatus("P2P CONNECTION ESTABLISHED 🚀");
        addLog("P2P Connection Established! We are now talking directly.");
        
        // TEST: Send a message via the direct tunnel
        peer.send("Hello from the other side (P2P)!");
    });

    // Handle incoming data (Phase 3 stuff)
    peer.on("data", (data) => {
        addLog(`Received P2P Data: ${data}`);
    });

    peerRef.current = peer;
  };

  // Called by Guest
  const acceptCall = (incomingData: any) => {
    // initiator: false means "I am answering a call"
    const peer = new SimplePeer({ initiator: false, trickle: false });

    // Step B: Generate my "Answer" signal
    peer.on("signal", (data) => {
        socket.emit("answer_call", { signal: data, to: incomingData.from });
    });

    peer.on("connect", () => {
        setStatus("P2P CONNECTION ESTABLISHED 🚀");
        addLog("P2P Connection Established! We are now talking directly.");
    });

    peer.on("data", (data) => {
        addLog(`Received P2P Data: ${data}`);
    });

    // Process the "Offer" we just received
    peer.signal(incomingData.signal);
    peerRef.current = peer;
  };

  // --- UI HELPERS ---

  const joinRoom = () => {
    if (roomId !== '') {
      socket.emit('join_room', roomId);
      setStatus("Waiting for peer...");
      addLog(`Joined Room: ${roomId}. Waiting for someone to join...`);
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
    console.log(message);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono p-4">
      <h1 className="text-4xl font-bold mb-8 text-green-400">GhostStream v0.2</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        <div className="mb-4">
            <div className={`text-center p-2 rounded ${status.includes('P2P') ? 'bg-green-900 text-green-200' : 'bg-gray-700'}`}>
                {status}
            </div>
        </div>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Enter Room ID"
            className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:border-green-500"
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button 
            onClick={joinRoom}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Join
          </button>
        </div>

        <div className="bg-black p-4 rounded h-64 overflow-y-auto text-xs text-green-300 font-mono border border-gray-700">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">&gt; {log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}