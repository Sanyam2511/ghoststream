"use client";
import { useGhostStream } from '../hooks/useGhostStream';
import Header from '../components/Header';
import ConnectionPanel from '../components/ConnectionPanel';
import FileTransferPanel from '../components/FileTransferPanel';
import LogTerminal from '../components/LogTerminal';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import ChatPanel from '../components/ChatPanel';
import RequestModal from '../components/RequestModal';

export default function Home() {
  const { 
    roomId, setRoomId, joinRoom, createSecureRoom, 
    status, logs, progress, transferSpeed, sendFile,
    messages, sendChat,incomingRequest, acceptRequest, rejectRequest, latency,
  } = useGhostStream();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-green-500/30">
      <Header />

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