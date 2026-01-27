import { FileText, Smartphone, Wifi, Check, X } from 'lucide-react';
import { IncomingRequest } from '../hooks/transfer/useReceiver';

interface Props {
  request: IncomingRequest;
  latency: number | null;
  onAccept: () => void;
  onReject: () => void;
}

export default function RequestModal({ request, latency, onAccept, onReject }: Props) {
  const getPingColor = (ms: number) => {
    if (ms < 100) return 'text-green-400';
    if (ms < 300) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl shadow-green-900/20">
        
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
           <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"/> 
           Incoming File Request
        </h3>

        <div className="bg-black/40 rounded-lg p-4 mb-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-500 uppercase tracking-wider font-bold">From Device</span>
                {latency && (
                    <div className={`text-xs font-mono flex items-center gap-1 ${getPingColor(latency)}`}>
                        <Wifi size={12}/> {latency}ms
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3 text-zinc-300">
                <div className="p-2 bg-zinc-800 rounded-full"><Smartphone size={18}/></div>
                <span className="font-medium">{request.device}</span>
            </div>
        </div>

        <div className="bg-black/40 rounded-lg p-4 mb-6 border border-white/5">
             <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-2">Content</div>
             <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800 rounded-full text-blue-400"><FileText size={18}/></div>
                <div>
                    <div className="font-medium text-white truncate max-w-[200px]">{request.fileName}</div>
                    <div className="text-xs text-zinc-500">
                        {(request.fileSize / 1024 / 1024).toFixed(2)} MB • {request.fileType.split('/')[1] || 'File'}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={onReject}
                className="py-3 rounded-xl bg-red-500/10 text-red-400 font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
                <X size={18} /> Decline
            </button>
            <button 
                onClick={onAccept}
                className="py-3 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
            >
                <Check size={18} /> Accept
            </button>
        </div>

      </div>
    </div>
  );
}