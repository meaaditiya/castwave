
"use client";

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Hand, ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { sendMessage, requestToJoinChat, voteOnMessage, featureMessage } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { Message } from '@/services/chatRoomService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Textarea } from './ui/textarea';


interface LiveChatProps {
  chatRoomId: string;
  canChat: boolean;
  isHost: boolean;
  messages: Message[];
  participantStatus?: 'pending' | 'approved' | 'removed' | 'denied';
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

export function LiveChat({ chatRoomId, canChat, participantStatus, isHost, messages }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [messageToFeature, setMessageToFeature] = useState<Message | null>(null);
  const [hostReply, setHostReply] = useState('');
  const [isFeaturing, setIsFeaturing] = useState(false);

  useEffect(() => {
    if(messages.length > 0) setLoading(false)
  }, [messages])


  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleRequestJoin = async () => {
    if (!currentUser) return;
    setIsRequesting(true);
    try {
        await requestToJoinChat(chatRoomId, currentUser.uid, currentUser.email || 'Anonymous');
        toast({ title: "Request Sent", description: "The host has been notified." });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not send request.' });
    } finally {
        setIsRequesting(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !currentUser.email) {
      if(!currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to chat.' });
      }
      return
    };

    try {
      await sendMessage(chatRoomId, { 
          user: currentUser.email, 
          text: newMessage,
          upvotes: 0,
          downvotes: 0,
          voters: {}
      });
      setNewMessage('');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
    }
  };

  const handleVote = async (messageId: string, voteType: 'upvotes' | 'downvotes') => {
    if (!currentUser) return;
    try {
        await voteOnMessage(chatRoomId, messageId, currentUser.uid, voteType);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to cast vote.'})
    }
  }

  const handleFeatureMessage = async () => {
    if (!messageToFeature || !hostReply.trim()) return;
    setIsFeaturing(true);
    try {
        await featureMessage(chatRoomId, messageToFeature, hostReply);
        toast({ title: "Message Featured", description: "The message is now on the live screen."});
        setMessageToFeature(null);
        setHostReply('');
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to feature message.'})
    } finally {
        setIsFeaturing(false);
    }
  }

  const renderChatOverlay = () => {
    if (canChat || isHost || !currentUser) return null;

    let alertContent;
    switch (participantStatus) {
        case 'pending':
            alertContent = { title: "Request Pending", description: "Your request to join the chat is awaiting host approval." };
            break;
        case 'denied':
            alertContent = { title: "Request Denied", description: "The host has denied your request to join the chat." };
            break;
        case 'removed':
             alertContent = { title: "Removed from Chat", description: "The host has removed you from the chat." };
             break;
        default:
            return (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4">
                    <div className="text-center space-y-4">
                        <p>You need permission to join the chat.</p>
                        <Button onClick={handleRequestJoin} disabled={isRequesting}>
                           {isRequesting ? <Loader2 className="animate-spin" /> : <Hand />}
                           Request to Join Chat
                        </Button>
                    </div>
                </div>
            )
    }

    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 p-4">
            <Alert variant="default" className="max-w-sm">
                <Hand className="h-4 w-4" />
                <AlertTitle>{alertContent.title}</AlertTitle>
                <AlertDescription>{alertContent.description}</AlertDescription>
            </Alert>
        </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full p-1 sm:p-4">
       {renderChatOverlay()}
       {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start space-x-3 group">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={`${getUserColor(msg.user)}/20 border ${getUserColor(msg.user)}/50`}>
                    {msg.user?.substring(0,1) || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${getUserColor(msg.user)}`}>{msg.user}</span>
                     {isHost && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" onClick={() => setMessageToFeature(msg)}>
                            <Star className="h-4 w-4" />
                        </Button>
                     )}
                </div>
                <p className="text-sm text-foreground/90">{msg.text}</p>
                <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVote(msg.id!, 'upvotes')} disabled={!canChat || msg.voters?.[currentUser?.uid!]}>
                            <ThumbsUp className={`h-4 w-4 ${msg.voters?.[currentUser?.uid!] === 'upvotes' ? 'text-primary' : ''}`} />
                        </Button>
                        <span className="text-xs">{msg.upvotes}</span>
                    </div>
                     <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVote(msg.id!, 'downvotes')} disabled={!canChat || msg.voters?.[currentUser?.uid!]}>
                           <ThumbsDown className={`h-4 w-4 ${msg.voters?.[currentUser?.uid!] === 'downvotes' ? 'text-destructive' : ''}`} />
                        </Button>
                        <span className="text-xs">{msg.downvotes}</span>
                    </div>
                </div>
              </div>
            </div>
          ))}
           {messages.length === 0 && (
                <div className="text-center text-muted-foreground pt-10">
                    <p>No messages yet. Be the first to start the conversation!</p>
                </div>
            )}
        </div>
      </ScrollArea>
      )}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t pt-4">
        <Input
          placeholder={canChat ? "Join the conversation..." : "You must be approved to chat."}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={!canChat}
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={!canChat || !newMessage.trim()}>
          <Send />
        </Button>
      </form>
       <Dialog open={!!messageToFeature} onOpenChange={(open) => !open && setMessageToFeature(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feature a Message</DialogTitle>
            <DialogDescription>
              Write a reply to this message. It will be shown on the main screen for everyone to see.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <blockquote className="border-l-2 pl-4 italic text-sm text-muted-foreground">
                "{messageToFeature?.text}"
            </blockquote>
            <Textarea
                placeholder="Your reply..."
                value={hostReply}
                onChange={(e) => setHostReply(e.target.value)}
                className="mt-4"
                rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageToFeature(null)}>Cancel</Button>
            <Button onClick={handleFeatureMessage} disabled={isFeaturing}>
              {isFeaturing ? <Loader2 className="animate-spin" /> : "Feature Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
