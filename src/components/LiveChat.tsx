
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Hand, ThumbsUp, ThumbsDown, Star, ArrowDown, CheckCircle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { sendMessage, requestToJoinChat, voteOnMessage, featureMessage, updateTypingStatus, ChatRoom, Participant } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { Message } from '@/services/chatRoomService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { format } from 'date-fns';
import { useDebouncedCallback } from 'use-debounce';
import { TypingIndicator } from './TypingIndicator';
import { CardContent } from './ui/card';

interface LiveChatProps {
  chatRoom: ChatRoom;
  canChat: boolean;
  isHost: boolean;
  messages: Message[];
  participant?: Participant;
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

export function LiveChat({ chatRoom, canChat, participant, isHost, messages }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [messageToFeature, setMessageToFeature] = useState<Message | null>(null);
  const [hostReply, setHostReply] = useState('');
  const [isFeaturing, setIsFeaturing] = useState(false);

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

  const handleRequestJoin = async () => {
    if (!currentUser || !currentUser.profile) return;
    setIsRequesting(true);
    try {
        await requestToJoinChat(chatRoom.id, currentUser.uid, currentUser.profile.username, currentUser.emailVerified);
        toast({ title: "Request Sent", description: "The host has been notified." });
    } catch(e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: e.message || 'Could not send request.' });
    } finally {
        setIsRequesting(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.profile || !newMessage.trim()) return;

    setIsSending(true);

    try {
        await sendMessage(chatRoom.id, {
            user: currentUser.profile.username,
            userId: currentUser.uid,
            text: newMessage.trim(),
            userEmailVerified: currentUser.emailVerified,
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
    if (!currentUser) return;
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
    
  const renderChatOverlay = () => {
    if (canChat || isHost || !currentUser || !participant) return null;

    let alertContent;
    switch (participant.status) {
        case 'pending':
            alertContent = { title: "Request Pending", description: "Your request to join the chat is awaiting host approval." };
            break;
        case 'denied':
            const requestsLeft = 3 - (participant.requestCount || 0);
            if (requestsLeft > 0) {
                 return (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4">
                        <div className="text-center space-y-4">
                            <p className='font-semibold'>The host denied your request.</p>
                            <p className='text-sm text-muted-foreground'>You can request to join {requestsLeft} more {requestsLeft === 1 ? 'time' : 'times'}.</p>
                            <Button onClick={handleRequestJoin} disabled={isRequesting}>
                               {isRequesting ? <Loader2 className="animate-spin" /> : <Hand />}
                               Request to Join Again
                            </Button>
                        </div>
                    </div>
                )
            } else {
                 alertContent = { title: "Request Denied", description: "You have reached the maximum number of requests to join." };
            }
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
    <CardContent className="flex flex-col flex-1 p-2 sm:p-4 overflow-hidden relative">
       {renderChatOverlay()}
       {!messages && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full pr-4" viewportRef={scrollViewportRef}>
            <div className="space-y-4">
            {messages && messages.map((msg) => (
                <div key={msg.id} className="flex items-start space-x-3 group">
                <Avatar className="h-8 w-8">
                    <AvatarFallback className={`${getUserColor(msg.user)}/20 border ${getUserColor(msg.user)}/50`}>
                        {msg.user?.substring(0,1) || 'A'}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${getUserColor(msg.user)}`}>{msg.user}</span>
                        {msg.userEmailVerified ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                        <span className="text-xs text-muted-foreground">{formatTimestamp(msg.timestamp)}</span>
                        {isHost && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" onClick={() => setMessageToFeature(msg)}>
                                <Star className="h-4 w-4" />
                            </Button>
                        )}
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
            ))}
            {messages && messages.length === 0 && (
                    <div className="text-center text-muted-foreground pt-10">
                        <p>No messages yet. Be the first to start the conversation!</p>
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
              placeholder={canChat ? "Join the conversation..." : "You must be approved to chat."}
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
