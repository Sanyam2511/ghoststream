import { Upload, FileText, Layers, XOctagon } from 'lucide-react';
import { useRef } from 'react';

interface Props {
  sendFiles: (files: File[]) => void;
  progress: number;
  transferSpeed: string;
  queueCount: number;
  onCancel: () => void;
}

export default function FileTransferPanel({ sendFiles, progress, transferSpeed, queueCount, onCancel }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      sendFiles(filesArray);
      e.target.value = '';
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-green-500/50 transition-all bg-zinc-900/20 group relative overflow-hidden">
        <input 
            ref={fileInputRef} 
            type="file" 
            multiple
            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
            onChange={handleFileChange} 
        />
        
        <div className={`p-4 rounded-full transition-transform group-hover:scale-110 ${queueCount > 0 ? 'bg-blue-500/20' : 'bg-zinc-800'}`}>
          {queueCount > 0 ? (
             <Layers className="text-blue-400" />
          ) : (
             <Upload className="text-zinc-400 group-hover:text-white" />
          )}
        </div>
        
        <div className="text-center">
          {queueCount > 0 ? (
             <>
                <p className="font-bold text-white">Queue Active</p>
                <p className="text-sm text-blue-400">{queueCount} files remaining</p>
             </>
          ) : (
             <>
                <p className="font-medium">Click or Drag files here</p>
                <p className="text-sm text-zinc-500">Supports multiple files (1GB+)</p>
             </>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
        <div className="flex justify-between mb-2">
          <span className="text-zinc-400 text-sm flex items-center gap-2">
            <FileText size={14}/> 
            {queueCount > 0 ? `Transferring (${queueCount} left)...` : 'Current Transfer'}
          </span>
          <span className="text-green-400 font-mono text-sm">{transferSpeed}</span>
        </div>
        
        <div className="h-4 bg-black rounded-full overflow-hidden border border-white/5">
          <div 
            className="h-full bg-green-500 transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }} 
          />
        </div>
        
        <div className="flex justify-end mt-2">
          <span className="text-xs text-zinc-500">{progress}% Complete</span>
        </div>
      </div>

      {queueCount > 0 && (
            <button 
                onClick={onCancel}
                className="mt-4 w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors"
            >
                <XOctagon size={16} />
                Cancel & Clear Queue
            </button>
        )}
    </div>
  );
}