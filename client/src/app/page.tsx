"use client";
import { useGhostStream } from '../hooks/useGhostStream';
import Header from '../components/Header';
import ConnectionPanel from '../components/ConnectionPanel';
import FileTransferPanel from '../components/FileTransferPanel';
import LogTerminal from '../components/LogTerminal';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ChatPanel from '../components/ChatPanel';
import RequestModal from '../components/RequestModal';
import { Timer, XCircle, PlayCircle } from 'lucide-react';
import ModeSelector from '../components/ModeSelector';

export default function Home() {
  const { 
    roomId, setRoomId, joinRoom, createSecureRoom, 
    status, logs, progress, transferSpeed, sendFile,
    messages, sendChat,incomingRequest, acceptRequest, rejectRequest, latency,
    warning, cancelSelfDestruct, transferMode, setTransferMode
  } = useGhostStream();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-green-500/30">
      <Header />
      {warning && (
         <div className="fixed top-0 left-0 w-full z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-zinc-900 border-b border-yellow-500/30 p-4 shadow-2xl shadow-yellow-900/20">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    
                    {/* Message */}
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-full animate-pulse text-yellow-500">
                            <Timer size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Mission Complete</h3>
                            <p className="text-zinc-400 text-xs">Room auto-destructs in 10 seconds to protect privacy.</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={cancelSelfDestruct} // <--- THE FIX
                            className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2"
                        >
                            <PlayCircle size={16}/> Stay Connected
                        </button>
                        {/* Optional: Immediate Destroy Button */}
                        <button 
                            onClick={() => window.location.reload()} 
                            className="text-zinc-500 hover:text-red-400 text-sm font-medium px-2"
                        >
                            Leave Now
                        </button>
                    </div>

                </div>
            </div>
         </div>
      )}

      <div className="mb-6">
        <ModeSelector 
            currentMode={transferMode} 
            setMode={setTransferMode} 
            disabled={status !== 'connected'} // Disable if not connected
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
                sendFile={sendFile} 
                progress={progress} 
                transferSpeed={transferSpeed} 
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
  );
}