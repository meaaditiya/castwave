"use client";

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { sendMessage, getMessages } from '@/services/podcastService';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  user: string;
  text: string;
  timestamp?: any;
}

interface LiveChatProps {
  podcastId: string;
}

const userColors = [
    'text-primary', 'text-accent', 'text-green-400', 'text-yellow-400', 'text-red-400', 'text-blue-400'
]

const getUserColor = (userName: string) => {
    if (!userName) return userColors[0];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return userColors[Math.abs(hash % userColors.length)];
}

export function LiveChat({ podcastId }: LiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!podcastId) return;
    setLoading(true);
    const unsubscribe = getMessages(podcastId, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [podcastId]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !currentUser.email) {
      if(!currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to chat.' });
      }
      return
    };

    try {
      await sendMessage(podcastId, { user: currentUser.email, text: newMessage });
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
    }
  };

  return (
    <div className="flex flex-col h-full p-1 sm:p-4">
       {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className="flex items-start space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${getUserColor(msg.user)}/20 border ${getUserColor(msg.user)}/50`}>
                    {msg.user?.substring(0,1) || 'A'}
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
      )}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t pt-4">
        <Input
          placeholder={currentUser ? "Join the conversation..." : "You must be logged in to chat."}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!currentUser}
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!currentUser || !newMessage.trim()}>
          <Send />
        </Button>
      </form>
    </div>
  );
}
