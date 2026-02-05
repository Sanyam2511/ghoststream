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
  const isStreaming = useRef(false); // Safety flag to stop loops

  const sendFile = async (file: File, isLast: boolean) => {
    if (!peerRef.current) return;
    
    currentFile.current = file;
    isStreaming.current = true;
    addLog(`✨ Preparing: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

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
    addLog(`📡 Header sent. Waiting for acceptance...`);
  };

  const startStreaming = async (offset = 0) => {
    if (!currentFile.current || !peerRef.current) return;
    
    const file = currentFile.current;
    // Use smaller chunks for stability (16KB is safe for WebRTC)
    const chunkSize = 16 * 1024; 
    let offsetCursor = offset;
    
    addLog(`🚀 Starting Stream for ${file.name}...`);

    const readNextChunk = () => {
      // 1. Stop if connection died or transfer finished
      if (!isStreaming.current || !peerRef.current?.connected) return;

      // 2. Completion Check
      if (offsetCursor >= file.size) {
        setTransferSpeed('Finished');
        setProgress(100);
        isStreaming.current = false;
        onComplete();
        return;
      }

      // 3. Read Slice
      const slice = file.slice(offsetCursor, offsetCursor + chunkSize);
      const reader = new FileReader();

      reader.onload = (e) => {
        if (!isStreaming.current || !peerRef.current) return;
        
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // 4. CRITICAL: Use .write() instead of .send()
        // .write returns FALSE if the buffer is full
        const canContinue = peerRef.current.write(Buffer.from(arrayBuffer));
        
        offsetCursor += arrayBuffer.byteLength;
        
        // 5. Update UI (throttled)
        const percent = (offsetCursor / file.size) * 100;
        // Only update React state every ~1% or so to save CPU
        if (Math.floor(percent) % 2 === 0 || percent >= 100) {
            setProgress(Math.round(percent));
            
            // Calculate simple speed estimation
            const mbSent = offsetCursor / 1024 / 1024;
            setTransferSpeed(`${mbSent.toFixed(1)} MB sent`);
        }

        // 6. Backpressure Logic
        if (canContinue) {
             // Buffer is empty, keep reading (small delay to let UI breathe)
             setTimeout(readNextChunk, 0);
        } else {
             // Buffer is FULL. Wait for 'drain' event before reading more.
             // This pauses the loop until the network catches up.
             peerRef.current.once('drain', readNextChunk);
        }
      };
      
      reader.readAsArrayBuffer(slice);
    };

    // Kickoff
    readNextChunk();
  };

  return { sendFile, startStreaming };
};