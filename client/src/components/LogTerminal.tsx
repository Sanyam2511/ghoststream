export default function LogTerminal({ logs }: { logs: string[] }) {
  return (
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
  );
}