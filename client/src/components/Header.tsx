import { Zap, Shield, Activity, Wifi } from 'lucide-react';

interface HeaderProps {
  status: string;
  transferSpeed?: string; 
  queueCount?: number;    
}

export default function Header({ status, transferSpeed, queueCount }: HeaderProps) {
  
  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.2)] bg-zinc-900/90';
      case 'connecting': return 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] bg-zinc-900/90';
      case 'full': return 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)] bg-zinc-900/90';
      default: return 'border-white/10 bg-zinc-900/80';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'SECURE LINK ACTIVE';
      case 'connecting': return 'ESTABLISHING TUNNEL...';
      case 'full': return 'ROOM FULL';
      default: return 'WAITING FOR PEER';
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[850px] px-4 transition-all duration-500 ease-out">
      <header 
        className={`
          relative flex items-center justify-between px-6 py-3 rounded-full border backdrop-blur-xl transition-all duration-500
          ${getStatusColor()}
        `}
      >
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative">
             <div className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
             {status === 'connected' && <div className="absolute inset-0 w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75"/>}
          </div>
          
          <h1 className="text-sm font-bold tracking-widest text-zinc-100 flex items-center gap-2 whitespace-nowrap">
            GHOSTSTREAM 
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400 font-mono">
              v1.0
            </span>
          </h1>
        </div>

        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 opacity-50 whitespace-nowrap">
           {status === 'connected' ? <Wifi size={12}/> : <Activity size={12}/>}
           <span className="text-[10px] font-mono tracking-widest uppercase">
             {transferSpeed || getStatusText()}
           </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-zinc-400 shrink-0">
           {queueCount && queueCount > 0 ? (
             <span className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 whitespace-nowrap">
               <span className="animate-pulse">●</span> {queueCount} Queue
             </span>
           ) : (
             <div className="flex gap-4">
                <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-help whitespace-nowrap" title="End-to-End Encrypted">
                  <Shield size={12}/> <span className="hidden sm:inline">E2EE</span>
                </span>
                <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-help whitespace-nowrap" title="Direct P2P">
                  <Zap size={12}/> <span className="hidden sm:inline">P2P</span>
                </span>
             </div>
           )}
        </div>
      </header>
    </div>
  );
}