"use client";

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';

export interface Message {
  user: string;
  text: string;
}

interface LiveChatProps {
  messages: Message[];
  onSendMessage: (message: Message) => void;
}

const userColors = [
    'text-primary', 'text-accent', 'text-green-400', 'text-yellow-400', 'text-red-400', 'text-blue-400'
]

const getUserColor = (userName: string) => {
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return userColors[Math.abs(hash % userColors.length)];
}

export function LiveChat({ messages, onSendMessage }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage({ user: 'You', text: newMessage });
      setNewMessage('');
    }
  };

  return (
    <div className="flex flex-col h-full p-1 sm:p-4">
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className="flex items-start space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${getUserColor(msg.user)}/20 border ${getUserColor(msg.user)}/50`}>
                    {msg.user.substring(0,1)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className={`font-bold text-sm ${getUserColor(msg.user)}`}>{msg.user}</span>
                <p className="text-sm text-foreground/90">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t pt-4">
        <Input
          placeholder="Join the conversation..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <Button type="submit" size="icon" aria-label="Send message">
          <Send />
        </Button>
      </form>
    </div>
  );
}
