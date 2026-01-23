import { Link2, Monitor, Lock, Copy, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

interface Props {
  status: string;
  roomId: string;
  setRoomId: (id: string) => void;
  joinRoom: () => void;
  createSecureRoom: () => void;
}

export default function ConnectionPanel({ status, roomId, setRoomId, joinRoom, createSecureRoom }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'full') {
      return (
          <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-8 backdrop-blur-sm text-center">
              <div className="flex justify-center mb-4"><AlertTriangle className="text-red-500" size={48} /></div>
              <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
              <p className="text-red-200">This room is full. One-time link has expired or is in use.</p>
              <button onClick={() => window.location.href = '/'} className="mt-6 bg-red-600 px-6 py-2 rounded-lg font-bold">Go Home</button>
          </div>
      )
  }

  if (status === 'idle' && roomId) {
      return (
        <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm flex flex-col items-center text-center">
             <div className="p-4 bg-yellow-500/20 rounded-full mb-4 animate-pulse">
                <Lock className="text-yellow-500" size={32} />
             </div>
             <h2 className="text-xl font-bold mb-2">Room Created</h2>
             <p className="text-zinc-400 text-sm mb-6 max-w-sm">
                Share this one-time link. The room will lock automatically after the peer joins.
             </p>
             
             <div className="flex gap-2 w-full max-w-md">
                <input 
                    readOnly 
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}?room=${roomId}`}
                    className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 outline-none w-full text-zinc-400 text-sm font-mono"
                />
                <button onClick={copyLink} className="bg-white text-black font-bold px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                    {copied ? 'Copied!' : <><Copy size={16}/> Copy</>}
                </button>
             </div>
        </div>
      );
  }

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-full ${status === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
            {status === 'connected' ? <Link2 size={24}/> : <Monitor size={24}/>}
          </div>
          <div>
            <h2 className="text-lg font-medium">GhostStream Secure</h2>
            <p className={`text-sm ${status === 'connected' ? 'text-green-400' : 'text-zinc-500'}`}>
              {status === 'connected' ? 'Encrypted P2P Link Active' : 'Create a secure room to start'}
            </p>
          </div>
        </div>
        
        {status !== 'connected' && (
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={createSecureRoom} className="w-full bg-blue-600 text-white font-bold px-8 py-3 rounded-lg hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20">
               <Lock size={18} /> New Secure Room
            </button>
          </div>
        )}
      </div>
    </div>
  );
}