
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ThumbsUp, ThumbsDown, Star, ArrowDown, MessageCircle, X, Reply } from 'lucide-react';
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
  canChat: boolean;
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


function ChatMessage({ message, parentMessage, onReply, onFeature, onVote, canChat, isHost, participantMap }: {
    message: Message,
    parentMessage?: Message,
    onReply: (message: Message) => void,
    onFeature: (message: Message) => void,
    onVote: (messageId: string, voteType: 'upvotes' | 'downvotes') => void,
    canChat: boolean,
    isHost: boolean,
    participantMap: Map<string, Participant>
}) {
    const { currentUser } = useAuth();
    const userProfile = participantMap.get(message.userId);

    const formatTimestamp = (timestamp: any) => {
        if (!timestamp) return '';
        try {
            const date = timestamp.toDate();
            return format(date, 'h:mm a');
        } catch (error) {
            return '';
        }
    };

    return (
        <div className="flex items-start space-x-3 group w-full">
            <Link href={`/profile/${message.userId}`} passHref>
                <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={userProfile?.photoURL} alt={message.user} />
                    <AvatarFallback className={`${getUserColor(message.user)}/20 border ${getUserColor(message.user)}/50`}>
                        {getInitials(message.user)}
                    </AvatarFallback>
                </Avatar>
            </Link>
            <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                 {parentMessage && (
                    <div className="pl-2 text-xs text-muted-foreground mt-1 mb-1">
                         <div className="flex items-center gap-1">
                            <Reply className="h-3 w-3"/>
                            <span className="font-semibold">{parentMessage.user}</span>
                        </div>
                        <p className="pl-4 break-words border-l-2 ml-[5px] pl-2 border-muted/50">{parentMessage.text}</p>
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/profile/${message.userId}`} passHref>
                        <span className={`font-bold text-sm ${getUserColor(message.user)} cursor-pointer hover:underline break-words`}>{message.user}</span>
                    </Link>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(message.timestamp)}</span>
                    <div className="flex items-center">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onReply(message)} disabled={!canChat}>
                            <MessageCircle className="h-4 w-4" />
                        </Button>
                        {isHost && (
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-500" onClick={() => onFeature(message)}>
                                <Star className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {message.text && 
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                        {message.text}
                    </p>
                }
                <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onVote(message.id!, 'upvotes')} disabled={!canChat || message.voters?.[currentUser?.uid!]}>
                            <ThumbsUp className={`h-4 w-4 ${message.voters?.[currentUser?.uid!] === 'upvotes' ? 'text-primary' : ''}`} />
                        </Button>
                        <span className="text-xs">{message.upvotes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onVote(message.id!, 'downvotes')} disabled={!canChat || message.voters?.[currentUser?.uid!]}>
                            <ThumbsDown className={`h-4 w-4 ${message.voters?.[currentUser?.uid!] === 'downvotes' ? 'text-destructive' : ''}`} />
                        </Button>
                        <span className="text-xs">{message.downvotes}</span>
                    </div>
                </div>

            </div>
        </div>
    )
}


export function LiveChat({ chatRoom, messages, participant, canChat }: LiveChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [messageToFeature, setMessageToFeature] = useState<Message | null>(null);
  const [hostReply, setHostReply] = useState('');
  const [isFeaturing, setIsFeaturing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isHost = currentUser?.uid === chatRoom.hostId;
  
  const participantMap = useMemo(() => {
    const map = new Map<string, Participant>();
    // Since non-hosts don't get the full list, we'll build what we can
    if (participant) map.set(participant.userId, participant);
    return map;
  }, [participant]);
  
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    messages.forEach(message => {
        if (message.id) {
            map.set(message.id, message);
        }
    });
    return map;
}, [messages]);


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

    let messageText = newMessage.trim();
    if (replyingTo && messageText.startsWith(`@${replyingTo.user} `)) {
        messageText = messageText.substring(`@${replyingTo.user} `.length);
    }

    try {
        await sendMessage(chatRoom.id, {
            user: currentUser.profile.username,
            userId: currentUser.uid,
            text: messageText,
            parentId: replyingTo ? replyingTo.id : undefined,
        });
        setNewMessage('');
        setReplyingTo(null);
        setShowNewMessageButton(false);
        scrollToBottom('smooth');
    } catch (error: any)
{
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

  const handleReplyClick = (message: Message) => {
    setReplyingTo(message);
    setNewMessage(`@${message.user} `);
    inputRef.current?.focus();
  }
  
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
            {messages && messages.map((msg) => (
                <ChatMessage 
                    key={msg.id}
                    message={msg}
                    parentMessage={msg.parentId ? messageMap.get(msg.parentId) : undefined}
                    onReply={handleReplyClick}
                    onFeature={setMessageToFeature}
                    onVote={handleVote}
                    canChat={canChat}
                    isHost={isHost}
                    participantMap={participantMap}
                />
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

      {chatRoom.isLive || isHost ? (
        <div className="border-t pt-2 mt-auto">
            {replyingTo && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded-t-md flex justify-between items-center">
                    <span>Replying to <span className="font-bold">{replyingTo.user}</span></span>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setReplyingTo(null); setNewMessage(''); }}>
                        <X className="h-3 w-3"/>
                    </Button>
                </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                ref={inputRef}
                placeholder={canChat ? "Join the conversation..." : "Waiting for host approval..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={!canChat || isSending}
                className={replyingTo ? 'rounded-t-none' : ''}
                />
                <Button type="submit" size="icon" aria-label="Send message" disabled={!canChat || isSending || !newMessage.trim()}>
                {isSending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
            </form>
        </div>
      ) : null}

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
