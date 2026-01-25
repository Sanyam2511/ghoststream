// src/components/ChatPanel.tsx
import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';

interface ChatMessage {
  id: string;
  text: string;
  isMe: boolean;
  timestamp: number;
}

interface Props {
  messages: ChatMessage[];
  sendChat: (text: string) => void;
}

export default function ChatPanel({ messages, sendChat }: Props) {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChat(input);
    setInput('');
  };

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl flex flex-col h-[300px] backdrop-blur-sm">
      <div className="p-4 border-b border-white/5 flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
        <MessageSquare size={14} /> Encrypted Chat
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 italic mt-10">No messages yet...</div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] px-3 py-2 rounded-lg text-xs break-words ${
                msg.isMe 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-zinc-800 text-zinc-300 border border-white/10'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-white/5 flex gap-2">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-green-500/50"
        />
        <button 
          onClick={handleSend}
          className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}