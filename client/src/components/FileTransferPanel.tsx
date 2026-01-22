import { Upload, FileText } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  sendFile: (file: File) => void;
  progress: number;
  transferSpeed: string;
}

export default function FileTransferPanel({ sendFile, progress, transferSpeed }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      sendFile(e.target.files[0]);
      e.target.value = ''; 
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-green-500/50 transition-all bg-zinc-900/20 group relative overflow-hidden">
        <input ref={fileInputRef} type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleFileChange} />
        <div className="p-4 bg-zinc-800 rounded-full group-hover:scale-110 transition-transform">
          <Upload className="text-zinc-400 group-hover:text-white" />
        </div>
        <div className="text-center">
          <p className="font-medium">Click or Drag file here</p>
          <p className="text-sm text-zinc-500">Supports 1GB+ sizes</p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
        <div className="flex justify-between mb-2">
          <span className="text-zinc-400 text-sm flex items-center gap-2"><FileText size={14}/> Current Transfer</span>
          <span className="text-green-400 font-mono text-sm">{transferSpeed}</span>
        </div>
        <div className="h-4 bg-black rounded-full overflow-hidden border border-white/5">
          <div className="h-full bg-green-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-end mt-2">
          <span className="text-xs text-zinc-500">{progress}% Complete</span>
        </div>
      </div>
    </div>
  );
}