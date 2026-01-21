"use client";
import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import SimplePeer, { Instance as PeerInstance } from 'simple-peer';
import { Upload, Download, Zap, Shield, Link2, Monitor, FileText } from 'lucide-react';

let socket: Socket;

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('idle'); // idle, connecting, connected
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  
  const peerRef = useRef<PeerInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  
  // INCOMING FILE STATE
  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[] } | null>(null);

  useEffect(() => {
    const socketURL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    socket = io(socketURL);

    socket.on('connect', () => addLog(`🔌 Server Connected (ID: ${socket.id?.slice(0,4)}...)`));

    socket.on("user_joined", (userId) => {
        addLog(`👤 User joined! Calling...`);
        callUser(userId);
    });

    socket.on("receiving_call", (data) => {
        addLog(`📞 Receiving call...`);
        acceptCall(data);
    });

    socket.on("call_accepted", (signal) => {
        addLog("✅ Call accepted! Locking signal...");
        peerRef.current?.signal(signal);
    });

    socket.on("user_disconnected", () => {
        if (peerRef.current) peerRef.current.destroy();
        setStatus("idle");
        setTransferSpeed('');
        setProgress(0);
        receivingFile.current = null;
    });

    // --- NEW: THE INSTANT DISCONNECT FIX ---
    const handleTabClose = () => {
        // Explicitly tell the server we are leaving
        socket.emit("disconnecting_event"); // Optional custom event if needed, but disconnect() usually triggers it
        socket.disconnect();
    };

    // Listen for when the user closes the tab or refreshes
    window.addEventListener('beforeunload', handleTabClose);

    // Cleanup when the component unmounts
    return () => { 
        window.removeEventListener('beforeunload', handleTabClose);
        socket.disconnect();
    };
  }, []);

  const handlePeerEvents = (peer: PeerInstance) => {
    peer.on("connect", () => {
        setStatus("connected");
        addLog("🚀 P2P Tunnel Established");
    });

    peer.on("data", handleReceiveData);

    peer.on("close", () => {
        setStatus("idle");
        addLog("🔴 Peer disconnected. Connection closed.");
        peerRef.current = null;
        setProgress(0);
        setTransferSpeed('');
    });

    // NEW: Handle Errors (Network drops, firewall blocks)
    peer.on("error", (err) => {
        addLog(`⚠️ Peer Error: ${err.message}`);
        setStatus("idle"); // Optional: Reset to idle on critical error
    });
  };

  const callUser = (userToCallId: string) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: true, trickle: false });
    
    peer.on("signal", (data) => {
        socket.emit("call_user", { userToCall: userToCallId, signalData: data, from: socket.id });
    });

    handlePeerEvents(peer); // Use the helper above
    peerRef.current = peer;
  };

  const acceptCall = (incomingData: any) => {
    setStatus('connecting');
    const peer = new SimplePeer({ initiator: false, trickle: false });
    
    peer.on("signal", (data) => {
        socket.emit("answer_call", { signal: data, to: incomingData.from });
    });

    handlePeerEvents(peer); // Use the helper above
    peer.signal(incomingData.signal);
    peerRef.current = peer;
  };

  // --- FILE TRANSFER ---

  const calculateSpeed = (newBytes: number) => {
    const now = Date.now();
    const timeDiff = (now - lastSpeedRef.current.time) / 1000; // in seconds
    const byteDiff = newBytes - lastSpeedRef.current.bytes;
    
    if (timeDiff > 0.5) { // Update every 0.5s
        const speed = (byteDiff / 1024 / 1024) / timeDiff; // MB/s
        setTransferSpeed(`${speed.toFixed(2)} MB/s`);
        lastSpeedRef.current = { bytes: newBytes, time: now };
    }
  };

  const sendFile = () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !peerRef.current) return;

    addLog(`📤 Sending: ${file.name}`);
    lastSpeedRef.current = { bytes: 0, time: Date.now() };

    const metaData = JSON.stringify({ type: 'header', name: file.name, size: file.size });
    peerRef.current.send(metaData);

    const chunkSize = 64 * 1024; // Increased to 64KB for speed
    let offset = 0;

    const readSlice = (o: number) => {
        const slice = file.slice(o, o + chunkSize);
        const reader = new FileReader();
        
        reader.onload = (event) => {
            if (!event.target?.result || !peerRef.current) return;
            
            const chunk = new Uint8Array(event.target.result as ArrayBuffer);
            const canSendMore = peerRef.current.write(chunk);

            offset += chunk.byteLength;
            setProgress(Math.round((offset / file.size) * 100));
            calculateSpeed(offset);

            if (offset < file.size) {
                if (canSendMore) {
                    readSlice(offset);
                } else {
                    peerRef.current.once('drain', () => readSlice(offset));
                }
            } else {
                addLog("✅ File Sent!");
                setTransferSpeed('Done');
                setProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''; 
                }
            }
        };
        reader.readAsArrayBuffer(slice);
    };

    readSlice(0);
  };

  const handleReceiveData = (data: any) => {
    if (data.toString().includes('"type":"header"')) {
        try {
            const header = JSON.parse(data.toString());
            receivingFile.current = { name: header.name, size: header.size, received: 0, chunks: [] };
            addLog(`📥 Incoming: ${header.name}`);
            lastSpeedRef.current = { bytes: 0, time: Date.now() };
            return;
        } catch (e) {}
    }

    if (receivingFile.current) {
        const file = receivingFile.current;
        file.chunks.push(data);
        file.received += data.byteLength;
        
        setProgress(Math.round((file.received / file.size) * 100));
        calculateSpeed(file.received);

        if (file.received >= file.size) {
            downloadFile(new Blob(file.chunks), file.name);
            receivingFile.current = null;
            setProgress(0);
            setTransferSpeed('Complete');
            addLog("💾 Downloaded!");
        }
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

  // --- UI HELPERS ---
  const joinRoom = () => {
    if (roomId) {
        socket.emit('join_room', roomId);
        addLog(`Attempting join: ${roomId}`);
    }
  };
  const addLog = (msg: string) => setLogs(p => [msg, ...p.slice(0, 9)]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-green-500/30">
      
      {/* HEADER */}
      <header className="p-6 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/>
            <h1 className="text-xl font-bold tracking-tight">GhostStream <span className="text-green-500 text-xs px-2 py-0.5 border border-green-500/30 rounded-full">BETA</span></h1>
        </div>
        <div className="text-xs text-zinc-500 flex gap-4">
            <span className="flex items-center gap-1"><Shield size={12}/> End-to-End Encrypted</span>
            <span className="flex items-center gap-1"><Zap size={12}/> P2P Direct</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 flex flex-col gap-8">
        
        {/* CONNECTION CARD */}
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                
                {/* STATUS INDICATOR */}
                <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-full ${status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                        {status === 'connected' ? <Link2 size={24}/> : <Monitor size={24}/>}
                    </div>
                    <div>
                        <h2 className="text-lg font-medium">Connection Status</h2>
                        <p className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-zinc-500'}`}>
                            {status === 'connected' ? 'Secure P2P Link Active' : 'Waiting for Peer...'}
                        </p>
                    </div>
                </div>

                {/* ROOM INPUT */}
                {status !== 'connected' && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <input 
                            onChange={(e) => setRoomId(e.target.value)} 
                            placeholder="Room ID (e.g. 123)" 
                            className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-500/50 transition-all w-full"
                        />
                        <button 
                            onClick={joinRoom}
                            className="bg-white text-black font-bold px-6 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Join
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* FILE TRANSFER AREA (ONLY WHEN CONNECTED) */}
        {status === 'connected' && (
            <div className="grid md:grid-cols-2 gap-6">
                
                {/* DROP ZONE */}
                <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-green-500/50 transition-all bg-zinc-900/20 group relative overflow-hidden">
                    <input ref={fileInputRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={sendFile} />
                    <div className="p-4 bg-zinc-800 rounded-full group-hover:scale-110 transition-transform">
                        <Upload className="text-zinc-400 group-hover:text-white" />
                    </div>
                    <div className="text-center">
                        <p className="font-medium">Click or Drag file here</p>
                        <p className="text-sm text-zinc-500">Supports 1GB+ sizes</p>
                    </div>
                </div>

                {/* PROGRESS CARD */}
                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
                    <div className="flex justify-between mb-2">
                        <span className="text-zinc-400 text-sm flex items-center gap-2"><FileText size={14}/> Current Transfer</span>
                        <span className="text-green-400 font-mono text-sm">{transferSpeed}</span>
                    </div>
                    
                    <div className="h-4 bg-black rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="h-full bg-green-500 transition-all duration-300 ease-out" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="flex justify-end mt-2">
                        <span className="text-xs text-zinc-500">{progress}% Complete</span>
                    </div>
                </div>

            </div>
        )}

        {/* LOGS TERMINAL */}
        <div className="mt-8">
            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-2">Network Logs</h3>
            <div className="bg-black border border-white/10 rounded-lg p-4 h-32 overflow-y-auto font-mono text-xs text-green-500/80">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 border-l-2 border-green-900 pl-2">
                        <span className="opacity-50 text-[10px] mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                    </div>
                ))}
            </div>
        </div>

      </main>
    </div>
  );
}