import { Zap, Shield } from 'lucide-react';

export default function Header() {
  return (
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
  );
}