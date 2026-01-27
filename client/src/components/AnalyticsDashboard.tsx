import { useEffect, useState, useCallback } from 'react';
import { Activity, ArrowDown, ArrowUp, Database, Zap, Trash2 } from 'lucide-react';
import { getAnalytics, TransferRecord, clearAnalytics } from '../utils/analyticsDB';

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<{ totalTransfers: number, totalDataDisplay: string, avgSpeed: string, maxSpeed: string, records: TransferRecord[] } | null>(null);
  const refreshStats = useCallback(() => {
    getAnalytics().then(setStats);
  }, []);

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to wipe all transfer history?")) {
        await clearAnalytics();
        refreshStats();
    }
  };

  useEffect(() => {
    refreshStats();
    window.addEventListener('transfer-updated', refreshStats);
    return () => {
        window.removeEventListener('transfer-updated', refreshStats);
    };
  }, [refreshStats]);

  if (!stats) return null;

  return (
    <div className="mt-12 border-t border-white/10 pt-8">
        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Activity size={16}/> Transfer Analytics
        </h3>

        <button 
                onClick={handleClearHistory}
                className="text-sm flex items-center gap-1 text-zinc-600 mb-3 hover:text-red-500 transition-colors"
            >
                <Trash2 size={14} /> Clear History
        </button>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Data" value={stats.totalDataDisplay} icon={<Database size={18} className="text-purple-400"/>} />
            <StatCard label="Avg Speed" value={`${stats.avgSpeed} MB/s`} icon={<Zap size={18} className="text-yellow-400"/>} />
            <StatCard label="Fastest" value={`${stats.maxSpeed} MB/s`} icon={<Activity size={18} className="text-green-400"/>} />
            <StatCard label="Transfers" value={stats.totalTransfers.toString()} icon={<ArrowUp size={18} className="text-blue-400"/>} />
        </div>

        <div className="bg-zinc-900/30 rounded-xl overflow-hidden border border-white/5">
            <div className="px-4 py-3 bg-white/5 border-b border-white/5 text-xs font-medium text-zinc-400">
                Recent Activity
            </div>
            {stats.records.length === 0 ? (
                <div className="p-4 text-center text-zinc-600 text-sm">No transfers yet.</div>
            ) : (
                <div>
                    {stats.records.map((rec, i) => (
                        <div key={i} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${rec.status === 'sent' ? 'bg-blue-500/20 text-blue-400' : rec.status === 'received' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {rec.status === 'sent' ? <ArrowUp size={12}/> : rec.status === 'received' ? <ArrowDown size={12}/> : <Activity size={12}/>}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-zinc-200">{rec.fileName}</div>
                                    <div className="text-xs text-zinc-500">{(rec.fileSize / 1024 / 1024).toFixed(1)} MB • {new Date(rec.timestamp).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-mono text-zinc-300">{rec.speed.toFixed(1)} MB/s</div>
                                <div className={`text-[10px] uppercase font-bold ${rec.status === 'failed' ? 'text-red-500' : 'text-zinc-600'}`}>{rec.status}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-zinc-900/50 p-4 rounded-xl border border-white/5 flex flex-col gap-1">
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-zinc-500 font-medium">{label}</span>
                {icon}
            </div>
            <div className="text-2xl font-mono font-bold text-white">{value}</div>
        </div>
    );
}