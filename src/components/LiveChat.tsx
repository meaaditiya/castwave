
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ThumbsUp, ThumbsDown, Star, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { sendMessage, voteOnMessage, featureMessage, updateTypingStatus, ChatRoom, Participant } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';
import type { Message } from '@/services/chatRoomService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { format } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';
import { TypingIndicator } from './TypingIndicator';
import { CardContent } from './ui/card';
import Link from 'next/link';

interface LiveChatProps {
  chatRoom: ChatRoom;
  messages: Message[];
  participant?: Participant | null; // The current user's participant record, if not host
}

const userColors = [
    'text-primary', 'text-accent-foreground', 'text-green-500', 'text-yellow-500', 'text-red-500', 'text-blue-500'
]

const getUserColor = (userName: string) => {
    if (!userName) return userColors[0];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return userColors[Math.abs(hash % userColors.length)];
}

const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export function LiveChat({ chatRoom, messages, participant }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [messageToFeature, setMessageToFeature] = useState<Message | null>(null);
  const [hostReply, setHostReply] = useState('');
  const [isFeaturing, setIsFeaturing] = useState(false);
  
  const isHost = currentUser?.uid === chatRoom.hostId;
  const canChat = isHost || participant?.status === 'approved';

  const participantMap = useMemo(() => {
    const map = new Map<string, Participant>();
    // Since non-hosts don't get the full list, we'll build what we can
    if (participant) map.set(participant.userId, participant);
    return map;
  }, [participant]);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    }
  }, []);
  
  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    const isAtBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 1;
    if (showNewMessageButton && isAtBottom) {
        setShowNewMessageButton(false);
    }
  }, [showNewMessageButton]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;
  
    // A bit of tolerance to consider it "at the bottom"
    const isScrolledToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 150;
  
    // If a new message comes in and we are already at the bottom, scroll down.
    if (isScrolledToBottom) {
      scrollToBottom('smooth');
    } else {
      // If we are not at the bottom, show the "new message" button.
      if(messages.length > 0) {
        setShowNewMessageButton(true);
      }
    }
  }, [messages, scrollToBottom]);


  const debouncedTypingUpdate = useDebouncedCallback((isTyping: boolean) => {
      if (!currentUser || !currentUser.profile) return;
      updateTypingStatus(chatRoom.id, currentUser.uid, currentUser.profile.username, isTyping);
  }, 3000);

  useEffect(() => {
    if (newMessage && canChat) {
        if (!currentUser || !currentUser.profile) return;
        updateTypingStatus(chatRoom.id, currentUser.uid, currentUser.profile.username, true);
        debouncedTypingUpdate(false);
    }
  }, [newMessage, canChat, chatRoom.id, currentUser, debouncedTypingUpdate]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.profile || !newMessage.trim() || !canChat) return;

    setIsSending(true);

    try {
        await sendMessage(chatRoom.id, {
            user: currentUser.profile.username,
            userId: currentUser.uid,
            text: newMessage.trim(),
        });
        setNewMessage('');
        setShowNewMessageButton(false);
        scrollToBottom('smooth');
    } catch (error: any) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not send message.' });
    } finally {
        setIsSending(false);
        if (currentUser && currentUser.profile) {
            updateTypingStatus(chatRoom.id, currentUser.uid, currentUser.profile.username, false);
        }
    }
  };

  const handleVote = async (messageId: string, voteType: 'upvotes' | 'downvotes') => {
    if (!currentUser || !canChat) return;
    try {
        await voteOnMessage(chatRoom.id, messageId, currentUser.uid, voteType);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to cast vote.'})
    }
  }

  const handleFeatureMessage = async () => {
    if (!messageToFeature) return;
    setIsFeaturing(true);
    try {
        await featureMessage(chatRoom.id, messageToFeature, hostReply);
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
  
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate();
      return format(date, 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  const typingUsers = Object.entries(chatRoom.typingUsers || {})
    .filter(([id]) => id !== currentUser?.uid)
    .map(([, name]) => name);

  return (
    <CardContent className="flex flex-col flex-1 p-2 sm:p-4 overflow-hidden relative">
       {!messages && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full pr-4" viewportRef={scrollViewportRef}>
            <div className="space-y-4">
            {messages && messages.map((msg) => {
                const userProfile = participantMap.get(msg.userId);
                return (
                <div key={msg.id} className="flex items-start space-x-3 group">
                    <Link href={`/profile/${msg.userId}`} passHref>
                        <Avatar className="h-8 w-8 cursor-pointer">
                            <AvatarImage src={userProfile?.photoURL} alt={msg.user} />
                            <AvatarFallback className={`${getUserColor(msg.user)}/20 border ${getUserColor(msg.user)}/50`}>
                                {getInitials(msg.user)}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <Link href={`/profile/${msg.userId}`} passHref>
                            <span className={`font-bold text-sm ${getUserColor(msg.user)} cursor-pointer hover:underline`}>{msg.user}</span>
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(msg.timestamp)}</span>
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                            {isHost && (
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-500" onClick={() => setMessageToFeature(msg)}>
                                    <Star className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {msg.text && <p className="text-sm text-foreground/90 whitespace-pre-wrap">{msg.text}</p>}
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
            )})}
            {messages && messages.length === 0 && canChat && (
                    <div className="text-center text-muted-foreground pt-10">
                        <p>No messages yet. Be the first to start the conversation!</p>
                    </div>
                )}
             {!canChat && (
                <div className="text-center text-muted-foreground pt-10">
                    <p>You must be approved by the host to send messages.</p>
                </div>
             )}
            </div>
        </ScrollArea>
        {showNewMessageButton && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
                <Button 
                    size="sm" 
                    className="rounded-full shadow-lg animate-in fade-in-50" 
                    onClick={() => {
                        scrollToBottom('smooth');
                        setShowNewMessageButton(false);
                    }}
                >
                    <ArrowDown className="mr-2 h-4 w-4" />
                    New Messages
                </Button>
            </div>
        )}
      </div>

      <div className="h-5 text-xs text-muted-foreground italic px-1 pt-1">
          {typingUsers.length > 0 && 
            <TypingIndicator users={typingUsers} />
          }
      </div>
      <div className="border-t pt-2 mt-auto">
        <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder={canChat ? "Join the conversation..." : "Waiting for host approval..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!canChat || isSending}
            />
            <Button type="submit" size="icon" aria-label="Send message" disabled={!canChat || isSending || !newMessage.trim()}>
              {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
        </form>
      </div>
       <Dialog open={!!messageToFeature} onOpenChange={(open) => !open && setMessageToFeature(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Feature a Message</DialogTitle>
            <DialogDescription>
              Write a reply to this message. It will be shown on the main screen for everyone to see. Leave the reply empty to just feature the message.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <blockquote className="border-l-2 pl-4 italic text-sm text-muted-foreground">
                "{messageToFeature?.text}"
            </blockquote>
            <Textarea
                placeholder="Your reply... (optional)"
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
    </CardContent>
  );
}
