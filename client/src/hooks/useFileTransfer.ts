// src/hooks/useFileTransfer.ts
import { useState, useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { calculateFileHash } from '../utils/crypto';
import { logTransfer } from '../utils/analyticsDB';
import { v4 as uuidv4 } from 'uuid';
import { getDeviceName } from '../utils/device';

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

export interface IncomingRequest {
  fileName: string;
  fileSize: number;
  device: string;
  fileType: string;
  hash: string;
}

export const useFileTransfer = ({ peerRef, addLog }: UseFileTransferProps) => {
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const receivingFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string; expectedHash?: string } | null>(null);
  const suspendedFile = useRef<{ name: string; size: number; received: number; chunks: ArrayBuffer[]; id: string; expectedHash?: string } | null>(null);
  const pendingFile = useRef<File | null>(null);
  const lastSpeedRef = useRef<{ bytes: number; time: number }>({ bytes: 0, time: 0 });

  const transferStartTime = useRef<number>(0);

  const ping = () => {
      if (!peerRef.current) return;
      const start = Date.now();
      peerRef.current.send(JSON.stringify({ type: 'ping', time: start }));
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

  const sendFile = async (file: File) => {
    if (!peerRef.current) return;
    addLog(`🔒 Preparing ${file.name}...`);
    pendingFile.current = file;
    transferStartTime.current = Date.now();
    try {
        const fileHash = await calculateFileHash(file);
        addLog(`🔒 Hash generated: ${fileHash.slice(0, 8)}...`);

        const header = { 
            type: 'header', 
            name: file.name, 
            size: file.size, 
            typeStr: file.type,
            hash: fileHash,
            device: getDeviceName()
        };
        
        addLog(`📤 Proposing: ${file.name} to peer...`);
        peerRef.current.send(JSON.stringify(header));
    } catch (e) {
        console.error(e);
        addLog("❌ Error hashing file.");
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
          if (canSendMore) {
              readSlice(offset);
          } else {
              peerRef.current.once('drain', () => readSlice(offset));
          }
        } else {
          finishTransfer();
        }
      };
      reader.readAsArrayBuffer(slice);
    };
    readSlice(startingOffset);
  };

  const finishTransfer = () => {
    addLog("✅ File Sent!");
    setTransferSpeed('Done');
  
    const duration = (Date.now() - lastSpeedRef.current.time + 1000) / 1000;
    const fileSizeMB = pendingFile.current ? pendingFile.current.size / 1024 / 1024 : 0;
    const finalSpeed = duration > 0 ? (fileSizeMB / duration) : 0;
    
    if (pendingFile.current) {
        logTransfer({
            fileName: pendingFile.current.name,
            fileSize: pendingFile.current.size,
            speed: finalSpeed,
            timestamp: Date.now(),
            status: 'sent'
        });
        window.dispatchEvent(new Event('transfer-updated'));
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

    if (strData.includes('"type":"ping"')) {
        const msg = JSON.parse(strData);
        peerRef.current?.send(JSON.stringify({ type: 'pong', time: msg.time }));
        return;
    }
    if (strData.includes('"type":"pong"')) {
        const msg = JSON.parse(strData);
        setLatency(Date.now() - msg.time);
        return;
    }

    if (strData.includes('"type":"header"')) {
      const header = JSON.parse(strData);
      
      const fileId = `${header.name}-${header.size}`;
      if (suspendedFile.current && suspendedFile.current.id === fileId) {
          handleIncomingHeader(header); 
          return;
      }

      setIncomingRequest({
          fileName: header.name,
          fileSize: header.size,
          fileType: header.typeStr || 'unknown',
          device: header.device || 'Unknown Peer',
          hash: header.hash
      });
      ping(); 
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

  const acceptRequest = () => {
    if (!incomingRequest) return;
    
    const header = {
        name: incomingRequest.fileName,
        size: incomingRequest.fileSize,
        hash: incomingRequest.hash
    };
    
    handleIncomingHeader(header);
    setIncomingRequest(null);
  };

  const rejectRequest = () => {
    setIncomingRequest(null);
    addLog("⛔ Transfer Rejected.");
  };

  const handleIncomingHeader = (header: any) => {
    const fileId = `${header.name}-${header.size}`;
    let resumeOffset = 0;

    transferStartTime.current = Date.now();

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

    const duration = (Date.now() - transferStartTime.current) / 1000;
    const fileSizeMB = receivingFile.current ? receivingFile.current.size / 1024 / 1024 : 0;
    const finalSpeed = duration > 0 ? (fileSizeMB / duration) : 0;

    logTransfer({
        fileName: file.name,
        fileSize: file.size,
        speed: finalSpeed,
        timestamp: Date.now(),
        status: isSuccess ? 'received' : 'failed'
    });
    window.dispatchEvent(new Event('transfer-updated'));

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
    sendChat,
    incomingRequest,
    latency,         
    acceptRequest,  
    rejectRequest    
  };
};