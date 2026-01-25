// src/hooks/useFileTransfer.ts
import { useState, useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { calculateFileHash } from '../utils/crypto';
import { logTransfer } from '../utils/analyticsDB';
import { v4 as uuidv4 } from 'uuid';

interface UseFileTransferProps {
  peerRef: React.MutableRefObject<PeerInstance | null>;
  addLog: (msg: string) => void;
}

export interface ChatMessage {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: number;
}

export const useFileTransfer = ({ peerRef, addLog }: UseFileTransferProps) => {
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');

  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string; expectedHash?: string } | null>(null);
  const suspendedFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string } | null>(null);
  const pendingFile = useRef<File | null>(null);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const sendFile = async (file: File) => {
    if (!peerRef.current) return;
    
    pendingFile.current = file;
    addLog(`🔒 Hashing file... (0%)`);
    
    try {
      const fileHash = await calculateFileHash(file);
      addLog(`🔒 Hash generated: ${fileHash.slice(0, 8)}...`);
      addLog(`📤 Proposing: ${file.name}`);
      
      peerRef.current.send(JSON.stringify({ 
        type: 'header', 
        name: file.name, 
        size: file.size, 
        hash: fileHash 
      }));
    } catch (err) {
      addLog("❌ Error calculating hash");
      console.error(err);
    }
  };

  const startStreamingFile = (startingOffset: number) => {
    const file = pendingFile.current;
    if (!file || !peerRef.current) return;

    addLog(startingOffset > 0 
      ? `⏩ Resuming transfer from ${(startingOffset / 1024 / 1024).toFixed(2)} MB` 
      : `🚀 Starting transfer...`);

    lastSpeedRef.current = { bytes: startingOffset, time: Date.now() };
    
    const chunkSize = 64 * 1024;
    let offset = startingOffset;

    const readSlice = (o: number) => {
      const slice = file.slice(o, o + chunkSize);
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (!event.target?.result || !peerRef.current) return;
        const chunk = new Uint8Array(event.target.result as ArrayBuffer);
        
        const canSendMore = peerRef.current.write(chunk);
        
        offset += chunk.byteLength;
        setProgress(Math.round((offset / file.size) * 100));
        updateSpeed(offset);

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
    
    const duration = (Date.now() - lastSpeedRef.current.time + 1000) / 1000;
    const finalSpeed = pendingFile.current ? (pendingFile.current.size / 1024 / 1024) / duration : 0;

    if (pendingFile.current) {
        logTransfer({
            fileName: pendingFile.current.name,
            fileSize: pendingFile.current.size,
            speed: parseFloat(transferSpeed.replace(' MB/s', '')) || 0,
            timestamp: Date.now(),
            status: 'sent'
        });
    }

    setProgress(0);
    pendingFile.current = null;
  };

  const sendChat = (text: string) => {
    if (!peerRef.current) return;

    const msg = { type: 'chat', text, timestamp: Date.now() };
    peerRef.current.send(JSON.stringify(msg));

    setMessages(prev => [...prev, { 
        id: uuidv4(), 
        text, 
        isMe: true, 
        timestamp: Date.now() 
    }]);
  };

  const handleReceiveData = async (data: any) => {
    const strData = data.toString();

    if (strData.includes('"type":"chat"')) {
      try {
        const msg = JSON.parse(strData);
        setMessages(prev => [...prev, { 
            id: uuidv4(), 
            text: msg.text, 
            isMe: false, 
            timestamp: msg.timestamp 
        }]);
      } catch (e) { console.error("Chat parse error", e); }
      return;
    }

    if (strData.includes('"type":"header"')) {
      handleIncomingHeader(JSON.parse(strData));
      return;
    }

    if (strData.includes('"type":"resume_ack"')) {
      startStreamingFile(JSON.parse(strData).offset);
      return;
    }

    if (receivingFile.current) {
      processChunk(data);
    }
  };

  const handleIncomingHeader = (header: any) => {
    const fileId = `${header.name}-${header.size}`;
    let resumeOffset = 0;

    if (suspendedFile.current && suspendedFile.current.id === fileId) {
      addLog(`🔄 Resuming from ${Math.round((suspendedFile.current.received / suspendedFile.current.size) * 100)}%`);
      resumeOffset = suspendedFile.current.received;
      receivingFile.current = suspendedFile.current;
      suspendedFile.current = null;
    } else {
      addLog(`📥 Incoming: ${header.name}`);
      receivingFile.current = { 
        name: header.name, size: header.size, received: 0, 
        chunks: [], id: fileId, expectedHash: header.hash 
      };
    }
    
    peerRef.current?.send(JSON.stringify({ type: 'resume_ack', offset: resumeOffset }));
    lastSpeedRef.current = { bytes: resumeOffset, time: Date.now() };
  };

  const processChunk = async (data: any) => {
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
    addLog("🔍 Verifying Integrity...");
    
    const file = receivingFile.current;
    const blob = new Blob(file.chunks);
    
    let isSuccess = false;

    try {
      const calculatedHash = await calculateFileHash(blob);
      if (file.expectedHash && calculatedHash !== file.expectedHash) {
        addLog("❌ INTEGRITY FAILED! File corrupt.");
        alert("Hash Mismatch!");
      } else {
        addLog("✅ Verified!");
        triggerDownload(blob, file.name);
        isSuccess = true;
      }
    } catch (e) {
      console.error(e);
      addLog("⚠️ Verification Error");
    }

    logTransfer({
        fileName: file.name,
        fileSize: file.size,
        speed: parseFloat(transferSpeed.replace(' MB/s', '')) || 0,
        timestamp: Date.now(),
        status: isSuccess ? 'received' : 'failed'
    });

    receivingFile.current = null;
    suspendedFile.current = null;
    setProgress(0);
    setTransferSpeed('Complete');
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    addLog("💾 Downloaded!");
  };

  const suspendTransfer = () => {
    if (receivingFile.current) {
      addLog(`⚠️ Saving progress at ${Math.round((receivingFile.current.received / receivingFile.current.size) * 100)}%`);
      suspendedFile.current = { ...receivingFile.current };
      receivingFile.current = null;
    } else {
      setProgress(0);
    }
    setTransferSpeed('');
  };

  return {
    progress,
    transferSpeed,
    sendFile,
    handleReceiveData,
    suspendTransfer,
    messages,
    sendChat
  };
};