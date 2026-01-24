"use client";
import { useGhostStream } from '../hooks/useGhostStream';
import Header from '../components/Header';
import ConnectionPanel from '../components/ConnectionPanel';
import FileTransferPanel from '../components/FileTransferPanel';
import LogTerminal from '../components/LogTerminal';
import AnalyticsDashboard from '../components/AnalyticsDashboard';

export default function Home() {
  const { 
    roomId, setRoomId, joinRoom, createSecureRoom, 
    status, logs, progress, transferSpeed, sendFile 
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
          <FileTransferPanel 
            sendFile={sendFile} 
            progress={progress} 
            transferSpeed={transferSpeed} 
          />
        )}

        <LogTerminal logs={logs} />
        <AnalyticsDashboard />
      </main>
    </div>
  );
}