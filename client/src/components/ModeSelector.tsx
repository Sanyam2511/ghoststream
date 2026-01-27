import { Zap, Shield, Smartphone } from 'lucide-react';
import { TransferMode, MODES } from '../utils/modes';

interface Props {
  currentMode: TransferMode;
  setMode: (mode: TransferMode) => void;
  disabled: boolean;
}

export default function ModeSelector({ currentMode, setMode, disabled }: Props) {
  return (
    <div className={`flex gap-2 bg-black/40 p-1 rounded-xl border border-white/10 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {(Object.keys(MODES) as TransferMode[]).map((key) => {
        const isActive = currentMode === key;
        const config = MODES[key];
        
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              isActive 
                ? 'bg-zinc-800 text-white shadow-lg border border-white/10' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={config.description}
          >
            {key === 'speed' && <Zap size={14} className={isActive ? "text-yellow-400" : ""} />}
            {key === 'balanced' && <Smartphone size={14} className={isActive ? "text-blue-400" : ""} />}
            {key === 'stable' && <Shield size={14} className={isActive ? "text-green-400" : ""} />}
            <span className="hidden md:inline">{config.label.split(' ')[1]}</span>
          </button>
        );
      })}
    </div>
  );
}