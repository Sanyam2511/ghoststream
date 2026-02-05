// src/hooks/useFileTransfer.ts
import { useState, useRef } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { TransferMode } from '../utils/modes';
import { useSender } from './transfer/useSender';
import { useReceiver } from './transfer/useReceiver';
import { useMessaging } from './transfer/useMessaging';

interface UseFileTransferProps {
  peerRef: React.MutableRefObject<PeerInstance | null>;
  addLog: (msg: string) => void;
  onTransferComplete?: () => void;
  onRemoteCancel?: () => void;
  transferMode: TransferMode;
}

export const useFileTransfer = ({ peerRef, addLog, onTransferComplete, onRemoteCancel, transferMode }: UseFileTransferProps) => {
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');
  
  const fileQueue = useRef<File[]>([]);
  const isProcessing = useRef(false);
  const [queueCount, setQueueCount] = useState(0);

  const messaging = useMessaging(peerRef);
  
  const parseData = (data: any): string => {
      if (typeof data === 'string') return data;
      if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
          try {
              return new TextDecoder().decode(data);
          } catch (e) {
              return ''; 
          }
      }
      return data.toString();
  };

  const handleSenderComplete = () => {
      fileQueue.current.shift();
      setQueueCount(fileQueue.current.length);

      if (fileQueue.current.length > 0) {
          processNextInQueue();
      } else {
          isProcessing.current = false;
          addLog("✅ All files sent successfully!");
          if (onTransferComplete) onTransferComplete();
      }
  };

  const sender = useSender({
    peerRef,
    addLog,
    transferMode,
    setProgress,
    setTransferSpeed,
    onComplete: handleSenderComplete
  });

  const receiver = useReceiver({
    peerRef,
    addLog,
    setProgress,
    setTransferSpeed,
    onComplete: (isLast: boolean) => {
        if (isLast) {
             addLog("🏁 Queue finished. Closing session soon...");
             if (onTransferComplete) onTransferComplete();
        } else {
             addLog("⏳ Waiting for next file in queue...");
        }
    }
  });

  const sendFiles = (files: File[]) => {
      if (files.length === 0) return;
      
      fileQueue.current.push(...files);
      setQueueCount(fileQueue.current.length);
      
      addLog(`📚 Queued ${files.length} files. Total: ${fileQueue.current.length}`);

      if (!isProcessing.current) {
          processNextInQueue();
      }
  };

  const processNextInQueue = () => {
      if (!peerRef.current || fileQueue.current.length === 0) {
          isProcessing.current = false;
          return;
      }
      
      isProcessing.current = true;
      const nextFile = fileQueue.current[0];

      setTimeout(() => {
          try {
             const currentIsLast = fileQueue.current.length === 1;
             sender.sendFile(nextFile, currentIsLast);
          } catch (err) {
             isProcessing.current = false;
             addLog("⚠️ Error starting transfer");
          }
      }, 500);
  };

  const handleReceiveData = async (data: any) => {
    if (receiver.receivingFile.current) {
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            receiver.processChunk(data);
            return;
        }
    }

    const strData = parseData(data);

    if (strData.includes('"type":"system_cancel_destruct"')) {
        if (onRemoteCancel) onRemoteCancel();
        return;
    }

    if (strData.includes('"type":"transfer_rejected"')) {
        addLog("⛔ Peer rejected the file. Skipping...");
        handleSenderComplete(); 
        return;
    }
    
    if (strData.includes('"type":"chat"')) {
        try { messaging.receiveChat(JSON.parse(strData)); } catch(e) {}
        return;
    }
    
    if (messaging.handlePingPong(strData)) return;

    if (strData.includes('"type":"header"')) {
        try {
            const header = JSON.parse(strData);
            if (onRemoteCancel) onRemoteCancel(); 

            receiver.setIncomingRequest({
                fileName: header.name, 
                fileSize: header.size, 
                fileType: header.typeStr, 
                device: header.device, 
                hash: header.hash,
                isLast: header.isLast
            });
            messaging.ping(); 
        } catch (e) {
            console.error("Failed to parse header", e);
        }
        return;
    }

    if (strData.includes('"type":"resume_ack"')) {
        sender.startStreaming(JSON.parse(strData).offset);
        return;
    }
  };

  return {
    progress,
    transferSpeed,
    sendFiles,
    queueCount,
    incomingRequest: receiver.incomingRequest,
    acceptRequest: receiver.acceptRequest,
    rejectRequest: receiver.rejectRequest,
    suspendTransfer: receiver.suspendTransfer,
    messages: messaging.messages,
    sendChat: messaging.sendChat,
    latency: messaging.latency,
    handleReceiveData
  };
};