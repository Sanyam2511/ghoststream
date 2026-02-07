"use client";

import { useEffect, useState, Suspense } from 'react';
import { useGhostStream } from '../hooks/useGhostStream';
import Header from '../components/Header';
import ConnectionPanel from '../components/ConnectionPanel';
import FileTransferPanel from '../components/FileTransferPanel';
import LogTerminal from '../components/LogTerminal';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ChatPanel from '../components/ChatPanel';
import RequestModal from '../components/RequestModal';
import {PlayCircle, AlertTriangle } from 'lucide-react';
import ModeSelector from '../components/ModeSelector';
import GridBackground from '../components/GridBackground';

function DestructModal({ onCancel }: { onCancel: () => void }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / 30) * circumference;

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-green-500/30 w-full max-w-md p-8 rounded-3xl shadow-2xl shadow-green-900/20 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50 animate-pulse" />

        <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-4 bg-green-500/10 rounded-full text-green-500 animate-bounce">
                <AlertTriangle size={32} />
            </div>
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">Transfer Complete</h2>
                <p className="text-zinc-400 text-sm">Transfer finished. Securing session...</p>
            </div>
        </div>

        <div className="relative flex items-center justify-center mb-8">
            <svg className="transform -rotate-90 w-32 h-32">
                <circle
                    cx="64" cy="64" r={radius}
                    stroke="currentColor" strokeWidth="6" fill="transparent"
                    className="text-zinc-800"
                />
                <circle
                    cx="64" cy="64" r={radius}
                    stroke="currentColor" strokeWidth="6" fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="text-green-500 transition-all duration-1000 ease-linear"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-mono font-bold text-white">{timeLeft}</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Sec</span>
            </div>
        </div>

        <button 
            onClick={onCancel}
            className="w-full py-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
            <PlayCircle size={20} />
            STAY CONNECTED
        </button>

        <p className="mt-4 text-xs text-zinc-600">
            If you do nothing, this room will self-destruct.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { 
    roomId, setRoomId, joinRoom, createSecureRoom, 
    status, logs, progress, transferSpeed, sendFiles, queueCount, cancelTransfer,
    messages, sendChat, incomingRequest, acceptRequest, rejectRequest, latency,
    warning, cancelSelfDestruct, transferMode, setTransferMode
  } = useGhostStream();

  return (
    <div className="min-h-screen text-white font-sans selection:bg-green-500/30">
      <GridBackground />
      <Header 
        status={status} 
        transferSpeed={transferSpeed} 
        queueCount={queueCount} 
       />
      {warning && <DestructModal onCancel={cancelSelfDestruct} />}

      <div className="relative z-10">
        
        <div className="max-w-4xl mx-auto px-8 pt-32 pb-0">
            <ModeSelector 
              currentMode={transferMode} 
              setMode={setTransferMode} 
              disabled={status !== 'connected'}
            />
        </div>

        <main className="max-w-4xl mx-auto p-8 flex flex-col gap-8">
          <ConnectionPanel 
            status={status} 
            roomId={roomId} 
            setRoomId={setRoomId} 
            joinRoom={joinRoom} 
            createSecureRoom={createSecureRoom}
          />

          {status === 'connected' && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <FileTransferPanel 
                    sendFiles={sendFiles}
                    progress={progress} 
                    transferSpeed={transferSpeed} 
                    queueCount={queueCount}
                    onCancel={cancelTransfer}
                />
              </div>

              <div className="md:col-span-1">
                  <ChatPanel messages={messages} sendChat={sendChat} />
              </div>
            </div>
          )}

          <LogTerminal logs={logs} />
          <AnalyticsDashboard />
          
          {incomingRequest && (
              <RequestModal 
                  request={incomingRequest} 
                  latency={latency}
                  onAccept={acceptRequest}
                  onReject={rejectRequest}
              />
          )}
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
            Loading GhostStream...
        </div>
    }>
        <AppContent />
    </Suspense>
  );
}