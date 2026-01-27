import { useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { calculateFileHash } from '../../utils/crypto';
import { getDeviceName } from '../../utils/device';
import { MODES, TransferMode } from '../../utils/modes';
import { logTransfer } from '../../utils/analyticsDB';

interface SenderProps {
  peerRef: React.MutableRefObject<PeerInstance | null>;
  addLog: (msg: string) => void;
  transferMode: TransferMode;
  setProgress: (p: number) => void;
  setTransferSpeed: (s: string) => void;
  onComplete: () => void;
}

export const useSender = ({ peerRef, addLog, transferMode, setProgress, setTransferSpeed, onComplete }: SenderProps) => {
  const pendingFile = useRef<File | null>(null);
  const transferStartTime = useRef<number>(0);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });
  const lastUIUpdate = useRef<number>(0);

  const sendFile = async (file: File) => {
    if (!peerRef.current) return;
    addLog(`🔒 Preparing ${file.name}...`);
    pendingFile.current = file;
    transferStartTime.current = performance.now();

    try {
      let fileHash = '';
      if (window.crypto && window.crypto.subtle) {
         fileHash = await calculateFileHash(file);
         addLog(`🔒 Hash generated: ${fileHash.slice(0, 8)}...`);
      } else {
         addLog("⚠️ HTTP detected. Sending without hash...");
      }

      const header = { 
        type: 'header', name: file.name, size: file.size, 
        typeStr: file.type, hash: fileHash, device: getDeviceName() 
      };
      
      addLog(`📤 Proposing: ${file.name}...`);
      peerRef.current.send(JSON.stringify(header));
    } catch (e) {
      console.error(e);
      addLog("❌ Error preparing file.");
    }
  };

  const startStreaming = (startingOffset: number) => {
    const file = pendingFile.current;
    if (!file || !peerRef.current) return;

    const settings = MODES[transferMode as keyof typeof MODES];
    addLog(startingOffset > 0 ? `⏩ Resuming (${settings.label})` : `🚀 Starting (${settings.label})`);

    lastSpeedRef.current = { bytes: startingOffset, time: Date.now() };
    let offset = startingOffset;

    const readSlice = (o: number) => {
      const slice = file.slice(o, o + settings.chunkSize);
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (!event.target?.result || !peerRef.current) return;
        const chunk = new Uint8Array(event.target.result as ArrayBuffer);
        const canSendMore = peerRef.current.write(chunk);
        offset += chunk.byteLength;

        const now = Date.now();
        if (now - lastUIUpdate.current > settings.uiInterval || offset >= file.size) {
            setProgress(Math.round((offset / file.size) * 100));
            updateSpeed(offset);
            lastUIUpdate.current = now;
        }

        if (offset < file.size) {
          canSendMore ? readSlice(offset) : peerRef.current.once('drain', () => readSlice(offset));
        } else {
          finishTransfer();
        }
      };
      reader.readAsArrayBuffer(slice);
    };
    readSlice(startingOffset);
  };

  const updateSpeed = (currentBytes: number) => {
    const now = Date.now();
    const timeDiff = (now - lastSpeedRef.current.time) / 1000;
    if (timeDiff > 0.5) {
      const speed = ((currentBytes - lastSpeedRef.current.bytes) / 1024 / 1024) / timeDiff;
      setTransferSpeed(`${speed.toFixed(2)} MB/s`);
      lastSpeedRef.current = { bytes: currentBytes, time: now };
    }
  };

  const finishTransfer = () => {
    addLog("✅ File Sent!");
    setTransferSpeed('Done');
    
    const duration = Math.max((performance.now() - transferStartTime.current) / 1000, 0.1);
    const fileSizeMB = pendingFile.current ? pendingFile.current.size / 1024 / 1024 : 0;
    
    if (pendingFile.current) {
        logTransfer({
            fileName: pendingFile.current.name, fileSize: pendingFile.current.size,
            speed: fileSizeMB / duration, timestamp: Date.now(), status: 'sent'
        });
        window.dispatchEvent(new Event('transfer-updated'));
    }

    setProgress(0);
    pendingFile.current = null;
    onComplete();
  };

  return { sendFile, startStreaming };
};