"use client";
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';

let socket: Socket;

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('Idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0); // 0 to 100
  
  const peerRef = useRef<PeerInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // INCOMING FILE STATE
  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[] } | null>(null);

  useEffect(() => {
    socket = io('http://localhost:3001');

    socket.on('connect', () => addLog(`Connected to Server (ID: ${socket.id})`));

    socket.on("user_joined", (userId) => {
        addLog(`User joined! Initiating Connection...`);
        callUser(userId);
    });

    socket.on("receiving_call", (data) => {
        addLog(`Receiving call...`);
        acceptCall(data);
    });

    socket.on("call_accepted", (signal) => {
        addLog("Call accepted! Finalizing...");
        peerRef.current?.signal(signal);
    });

    return () => { socket.disconnect(); };
  }, []);

  // --- WEBRTC LOGIC ---

  const callUser = (userToCallId: string) => {
    const peer = new SimplePeer({ initiator: true, trickle: false });
    
    peer.on("signal", (data) => {
        socket.emit("call_user", { userToCall: userToCallId, signalData: data, from: socket.id });
    });

    peer.on("connect", () => {
        setStatus("P2P CONNECTION ESTABLISHED 🚀");
        addLog("P2P Connection Ready.");
    });

    peer.on("data", handleReceiveData); // NEW: Handle data stream

    peerRef.current = peer;
  };

  const acceptCall = (incomingData: any) => {
    const peer = new SimplePeer({ initiator: false, trickle: false });
    
    peer.on("signal", (data) => {
        socket.emit("answer_call", { signal: data, to: incomingData.from });
    });

    peer.on("connect", () => {
        setStatus("P2P CONNECTION ESTABLISHED 🚀");
        addLog("P2P Connection Ready.");
    });

    peer.on("data", handleReceiveData); // NEW: Handle data stream

    peer.signal(incomingData.signal);
    peerRef.current = peer;
  };

  const sendFile = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !peerRef.current) return;

    addLog(`Starting transfer: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const metaData = JSON.stringify({ type: 'header', name: file.name, size: file.size });
    peerRef.current.send(metaData);

    const chunkSize = 16 * 1024; // 16KB
    let offset = 0;

    const readSlice = (o: number) => {
        const slice = file.slice(o, o + chunkSize);
        const reader = new FileReader();
        
        reader.onload = (event) => {
            if (!event.target?.result || !peerRef.current) return;
            
            // 1. Convert to Uint8Array (Standard for streams)
            const chunk = new Uint8Array(event.target.result as ArrayBuffer);

            // 2. Write to the stream using Backpressure logic
            // .write returns FALSE if the buffer is full
            const canSendMore = peerRef.current.write(chunk);

            offset += chunk.byteLength;
            setProgress(Math.round((offset / file.size) * 100));

            if (offset < file.size) {
                if (canSendMore) {
                    // Buffer is empty, keep reading immediately
                    readSlice(offset);
                } else {
                    // Buffer is full! Wait for 'drain' event before reading next chunk
                    // This prevents "RTCDataChannel queue full" error
                    peerRef.current.once('drain', () => readSlice(offset));
                }
            } else {
                addLog("File Sent Successfully! ✅");
                setProgress(0);
            }
        };
        
        reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  };

  const handleReceiveData = (data: any) => {
    // 1. Is it a String? (Metadata or Chat)
    if (data.toString().includes('"type":"header"')) {
        try {
            const header = JSON.parse(data.toString());
            addLog(`Incoming File: ${header.name}`);
            receivingFile.current = { 
                name: header.name, 
                size: header.size, 
                received: 0, 
                chunks: [] 
            };
            return;
        } catch (e) { console.error("JSON Parse Error", e); }
    }

    // 2. Is it File Data? (Binary)
    if (receivingFile.current) {
        const file = receivingFile.current;
        file.chunks.push(data); // Store chunk
        file.received += data.byteLength;
        
        setProgress(Math.round((file.received / file.size) * 100));

        // 3. Is the file done?
        if (file.received >= file.size) {
            addLog(`Download Complete: ${file.name} ✅`);
            downloadFile(new Blob(file.chunks), file.name);
            receivingFile.current = null; // Reset
            setProgress(0);
        }
    } else {
        // Fallback for simple text messages
        addLog(`Msg: ${data.toString()}`);
    }
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const joinRoom = () => {
    if (!roomId) {
      alert("Please enter a Room ID first!");
      return;
    }

    if (!socket) {
        addLog("Error: Socket not connected. Reloading...");
        window.location.reload();
        return;
    }

    // 1. Send the signal
    socket.emit('join_room', roomId);
    
    // 2. VISUAL FEEDBACK (This was missing!)
    setStatus(`Joined Room: ${roomId}`);
    addLog(`Joined Room: ${roomId}. Waiting for peer to join...`);
  };

  const addLog = (msg: string) => setLogs(p => [...p, msg]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono p-4">
      <h1 className="text-4xl font-bold mb-8 text-green-400">GhostStream v0.3</h1>
      
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
        {/* Status Bar */}
        <div className={`text-center p-2 mb-4 rounded font-bold ${status.includes('P2P') ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-200'}`}>
            {status}
        </div>

        {/* Room Input */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="Room ID"
            className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none"
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom} className="bg-green-600 hover:bg-green-700 px-4 rounded font-bold">Join</button>
        </div>

        {/* File Transfer UI (Only shows when connected) */}
        {status.includes('P2P') && (
            <div className="mb-6 p-4 border border-green-500/30 rounded bg-gray-900/50">
                <input ref={fileInputRef} type="file" className="mb-2 w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white" />
                <button onClick={sendFile} className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-bold transition-colors">
                    Send File 📤
                </button>
                
                {/* Progress Bar */}
                {progress > 0 && (
                    <div className="mt-4 w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full transition-all duration-75" style={{ width: `${progress}%` }}></div>
                        <p className="text-right text-xs mt-1 text-blue-300">{progress}%</p>
                    </div>
                )}
            </div>
        )}

        {/* Logs */}
        <div className="bg-black p-4 rounded h-48 overflow-y-auto text-xs text-green-300 border border-gray-700 font-mono">
          {logs.map((log, i) => <div key={i} className="mb-1">&gt; {log}</div>)}
        </div>
      </div>
    </div>
  );
}