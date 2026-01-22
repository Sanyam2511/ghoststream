import { Link2, Monitor } from 'lucide-react';

interface Props {
  status: string;
  roomId: string;
  setRoomId: (id: string) => void;
  joinRoom: () => void;
}

export default function ConnectionPanel({ status, roomId, setRoomId, joinRoom }: Props) {
  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
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
        
        {status !== 'connected' && (
          <div className="flex gap-2 w-full md:w-auto">
            <input 
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)} 
              placeholder="Room ID (e.g. 123)" 
              className="bg-black/50 border border-white/10 rounded-lg px-4 py-3 outline-none focus:border-green-500/50 transition-all w-full"
            />
            <button onClick={joinRoom} className="bg-white text-black font-bold px-6 rounded-lg hover:bg-gray-200 transition-colors">
              Join
            </button>
          </div>
        )}
      </div>
    </div>
  );
}