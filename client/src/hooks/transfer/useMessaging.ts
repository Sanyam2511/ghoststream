import { useState } from 'react';
import { Instance as PeerInstance } from 'simple-peer';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string; text: string; isMe: boolean; timestamp: number;
}

export const useMessaging = (peerRef: React.MutableRefObject<PeerInstance | null>) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latency, setLatency] = useState<number | null>(null);

  const sendChat = (text: string) => {
    if (!peerRef.current) return;
    const msg = { type: 'chat', text, timestamp: Date.now() };
    peerRef.current.send(JSON.stringify(msg));
    setMessages(prev => [...prev, { id: uuidv4(), text, isMe: true, timestamp: Date.now() }]);
  };

  const receiveChat = (msg: any) => {
    setMessages(prev => [...prev, { id: uuidv4(), text: msg.text, isMe: false, timestamp: msg.timestamp }]);
  };

  const ping = () => {
    if (!peerRef.current) return;
    peerRef.current.send(JSON.stringify({ type: 'ping', time: Date.now() }));
  };

  const handlePingPong = (strData: string) => {
    if (strData.includes('"type":"ping"')) {
        const msg = JSON.parse(strData);
        peerRef.current?.send(JSON.stringify({ type: 'pong', time: msg.time }));
        return true;
    }
    if (strData.includes('"type":"pong"')) {
        const msg = JSON.parse(strData);
        setLatency(Date.now() - msg.time);
        return true;
    }
    return false;
  };

  return { messages, sendChat, receiveChat, latency, ping, handlePingPong };
};