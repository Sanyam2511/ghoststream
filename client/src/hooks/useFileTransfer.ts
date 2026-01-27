// src/hooks/useFileTransfer.ts
import { useState } from 'react';
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

export const useFileTransfer = ({ peerRef, addLog, onTransferComplete, transferMode, onRemoteCancel }: UseFileTransferProps) => {
  const [progress, setProgress] = useState(0);
  const [transferSpeed, setTransferSpeed] = useState('');

  const messaging = useMessaging(peerRef);
  
  const sender = useSender({
    peerRef,
    addLog,
    transferMode,
    setProgress,
    setTransferSpeed,
    onComplete: () => onTransferComplete?.()
  });

  const receiver = useReceiver({
    peerRef,
    addLog,
    setProgress,
    setTransferSpeed,
    onComplete: () => onTransferComplete?.()
  });

  const handleReceiveData = async (data: any) => {
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
        if (receiver.receivingFile.current) {
            receiver.processChunk(data);
            return;
        }
    }

    const strData = data.toString();

    if (strData.includes('"type":"system_cancel_destruct"')) {
        if (onRemoteCancel) onRemoteCancel();
        return;
    }

    if (strData.includes('"type":"chat"')) {
        try { messaging.receiveChat(JSON.parse(strData)); } catch(e) {}
        return;
    }
    if (messaging.handlePingPong(strData)) return;

    if (strData.includes('"type":"header"')) {
        const header = JSON.parse(strData);
        receiver.setIncomingRequest({
            fileName: header.name, fileSize: header.size, 
            fileType: header.typeStr, device: header.device, hash: header.hash
        });
        messaging.ping();
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
    sendFile: sender.sendFile,
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