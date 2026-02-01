import { useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { calculateFileHash } from '../../utils/crypto';
import { TransferMode, MODES } from '../../utils/modes';

interface SenderProps {
  peerRef: React.MutableRefObject<PeerInstance | null>;
  addLog: (msg: string) => void;
  transferMode: TransferMode;
  setProgress: (p: number) => void;
  setTransferSpeed: (s: string) => void;
  onComplete: () => void;
}

export const useSender = ({ peerRef, addLog, transferMode, setProgress, setTransferSpeed, onComplete }: SenderProps) => {
  const fileReader = useRef<FileReader | null>(null);
  const currentFile = useRef<File | null>(null);

  const sendFile = async (file: File, isLast: boolean) => {
    if (!peerRef.current) return;
    
    currentFile.current = file;
    addLog(`✨ Preparing: ${file.name}`);
    const hash = await calculateFileHash(file);

    const header = {
      type: 'header',
      name: file.name,
      size: file.size,
      typeStr: file.type,
      hash: hash,
      isLast: isLast
    };

    peerRef.current.send(JSON.stringify(header));
    addLog(`📡 Sending Request...`);
  };

  const startStreaming = async (offset = 0) => {
    if (!currentFile.current || !peerRef.current) return;
    
    const file = currentFile.current;
    const chunkSize = MODES[transferMode].chunkSize;
    let offsetCursor = offset;
    
    addLog(`🚀 Starting Stream (${transferMode} mode)...`);

    const readNextChunk = () => {
      if (offsetCursor >= file.size) {
        setTransferSpeed('Finished');
        setProgress(100);
        onComplete();
        return;
      }

      const slice = file.slice(offsetCursor, offsetCursor + chunkSize);
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!peerRef.current?.connected) return;
        
        const arrayBuffer = e.target?.result as ArrayBuffer;
        peerRef.current.send(arrayBuffer);
        
        offsetCursor += arrayBuffer.byteLength;
        const percent = (offsetCursor / file.size) * 100;
        
        if (Math.random() < (transferMode === 'speed' ? 0.1 : 0.5)) {
            setProgress(Math.round(percent));
        }

        if ((peerRef.current as any)._channel.bufferedAmount > chunkSize * 2) {
             peerRef.current.once('drain', readNextChunk);
        } else {
             readNextChunk();
        }
      };
      
      reader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  };

  return { sendFile, startStreaming };
};