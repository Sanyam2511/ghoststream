// src/hooks/transfer/useReceiver.ts
import { useState, useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { calculateFileHash } from '../../utils/crypto';
import { logTransfer } from '../../utils/analyticsDB';

interface ReceiverProps {
  peerRef: React.MutableRefObject<PeerInstance | null>;
  addLog: (msg: string) => void;
  setProgress: (p: number) => void;
  setTransferSpeed: (s: string) => void;
  onComplete: (isLast: boolean) => void; 
}

export interface IncomingRequest {
  fileName: string;
  fileSize: number;
  device: string;
  fileType: string;
  hash: string;
  isLast: boolean;
}

export const useReceiver = ({ peerRef, addLog, setProgress, setTransferSpeed, onComplete }: ReceiverProps) => {
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  
  const receivingFile = useRef<{ 
      name: string; 
      size: number; 
      received: number; 
      chunks: (ArrayBuffer | Uint8Array)[]; 
      id: string; 
      expectedHash?: string;
      isLast: boolean;
  } | null>(null);

  const suspendedFile = useRef<{ 
      name: string; 
      size: number; 
      received: number; 
      chunks: (ArrayBuffer | Uint8Array)[]; 
      id: string; 
      expectedHash?: string;
      isLast: boolean;
  } | null>(null);
  
  const transferStartTime = useRef<number>(0);

  const reset = () => {
      receivingFile.current = null;
      setIncomingRequest(null);
      setProgress(0);
      setTransferSpeed('');
  };

  const handleIncomingHeader = (header: any) => {
    const fileId = `${header.name}-${header.size}`;
    let resumeOffset = 0;
    transferStartTime.current = performance.now();

    if (suspendedFile.current && suspendedFile.current.id === fileId) {
      addLog(`🔄 Resuming from ${Math.round((suspendedFile.current.received / suspendedFile.current.size) * 100)}%`);
      resumeOffset = suspendedFile.current.received;
      receivingFile.current = suspendedFile.current;
      suspendedFile.current = null;
    } else {
      addLog(`📥 Incoming: ${header.name}`);
      receivingFile.current = { 
        name: header.name, 
        size: header.size, 
        received: 0, 
        chunks: [], 
        id: fileId, 
        expectedHash: header.hash,
        isLast: header.isLast 
      };
    }
    
    peerRef.current?.send(JSON.stringify({ type: 'resume_ack', offset: resumeOffset }));
  };

  const processChunk = async (data: ArrayBuffer | Uint8Array) => {
    if (!receivingFile.current) return;
    const file = receivingFile.current;
    
    file.chunks.push(data);
    file.received += data.byteLength;
    setProgress(Math.round((file.received / file.size) * 100));

    if (file.received >= file.size) {
      await finalizeDownload();
    }
  };

  const finalizeDownload = async () => {
    if (!receivingFile.current) return;
    const file = receivingFile.current;
    const blob = new Blob(file.chunks as any); 
    
    let isSuccess = false;

    addLog("🔍 Verifying Integrity...");
    try {
        if (file.expectedHash && window.crypto && window.crypto.subtle) {
            const hash = await calculateFileHash(blob);
            if (hash !== file.expectedHash) {
                addLog("❌ INTEGRITY FAILED!");
                alert("Hash Mismatch!");
            } else {
                addLog("✅ Verified!");
                triggerDownload(blob, file.name);
                isSuccess = true;
            }
        } else {
            triggerDownload(blob, file.name);
            isSuccess = true;
        }
    } catch (e) { addLog("⚠️ Verification Error"); }

    const duration = Math.max((performance.now() - transferStartTime.current) / 1000, 0.1);
    const speed = (file.size / 1024 / 1024) / duration;

    logTransfer({
        fileName: file.name, fileSize: file.size,
        speed, timestamp: Date.now(), status: isSuccess ? 'received' : 'failed'
    });
    window.dispatchEvent(new Event('transfer-updated'));

    const wasLastFile = file.isLast;

    receivingFile.current = null;
    suspendedFile.current = null;
    setProgress(0);
    setTransferSpeed(wasLastFile ? 'Complete' : 'Waiting for next...');
    onComplete(wasLastFile);
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    addLog("💾 Downloaded!");
  };

  const acceptRequest = () => {
    if (!incomingRequest) return;
    handleIncomingHeader({ 
        name: incomingRequest.fileName, 
        size: incomingRequest.fileSize, 
        hash: incomingRequest.hash,
        isLast: incomingRequest.isLast
    });
    setIncomingRequest(null);
  };

  const rejectRequest = () => {
    if (incomingRequest && peerRef.current) {
        peerRef.current.send(JSON.stringify({ 
            type: 'transfer_rejected', 
            fileName: incomingRequest.fileName 
        }));
    }
    setIncomingRequest(null);
    addLog("⛔ You rejected the file.");
  };

  const suspendTransfer = () => {
    if (receivingFile.current) {
        addLog(`⚠️ Saving progress...`);
        suspendedFile.current = { ...receivingFile.current };
        receivingFile.current = null;
    }
  };

  return {
    incomingRequest, setIncomingRequest,
    acceptRequest, rejectRequest,
    handleIncomingHeader, processChunk,
    suspendTransfer,
    receivingFile, reset
  };
};