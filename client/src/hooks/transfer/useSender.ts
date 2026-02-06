// src/hooks/transfer/useSender.ts
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
  const currentFile = useRef<File | null>(null);
  const isStreaming = useRef(false);

  const stop = () => {
      isStreaming.current = false;
      currentFile.current = null;
  };

  const sendFile = async (file: File, isLast: boolean) => {
    if (!peerRef.current) return;
    
    currentFile.current = file;
    isStreaming.current = true;
    addLog(`EXEC : Preparing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

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
    addLog(`NET  : Header sent. Awaiting ACK...`);
  };

  const startStreaming = async (offset = 0) => {
    if (!currentFile.current || !peerRef.current) return;
    
    const file = currentFile.current;
    const chunkSize = 16 * 1024; 
    let offsetCursor = offset;
    
    addLog(`INIT : Starting Stream for ${file.name}...`);

    const readNextChunk = () => {
      if (!isStreaming.current || !peerRef.current?.connected) return;
      if (offsetCursor >= file.size) {
        setTransferSpeed('Finished');
        setProgress(100);
        isStreaming.current = false;
        onComplete();
        return;
      }

      const slice = file.slice(offsetCursor, offsetCursor + chunkSize);
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!isStreaming.current || !peerRef.current) return;
        
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const canContinue = peerRef.current.write(Buffer.from(arrayBuffer));
        
        offsetCursor += arrayBuffer.byteLength;
        const percent = (offsetCursor / file.size) * 100;
        if (Math.floor(percent) % 2 === 0 || percent >= 100) {
            setProgress(Math.round(percent));
            const mbSent = offsetCursor / 1024 / 1024;
            setTransferSpeed(`${mbSent.toFixed(1)} MB sent`);
        }

        if (canContinue) {
             setTimeout(readNextChunk, 0);
        } else {
             peerRef.current.once('drain', readNextChunk);
        }
      };
      
      reader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  };

  return { sendFile, startStreaming, stop};
};