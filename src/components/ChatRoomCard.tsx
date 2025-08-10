
"use client";

import Link from 'next/link';
import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Trash2, Calendar, Play, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ChatRoom } from '@/services/chatRoomService';
import { format } from 'date-fns';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ChatRoomCardProps extends ChatRoom {
    isOwner: boolean;
    onDelete: () => void;
    onStartSession: () => void;
    onLike: (type: 'like' | 'dislike') => void;
    currentUserId?: string;
}

export function ChatRoomCard({ id, title, host, hostId, isLive, isOwner, onDelete, onStartSession, scheduledAt, hostPhotoURL, onLike, currentUserId, likers, likes }: ChatRoomCardProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  }

  const handleStartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onStartSession();
  }

  const handleLikeClick = async (e: React.MouseEvent, type: 'like' | 'dislike') => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) return;
    setIsLiking(true);
    await onLike(type);
    setIsLiking(false);
  }
  
  const handleJoinClick = () => {
    setIsJoining(true);
  };

  const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const scheduledTime = scheduledAt?.toDate();
  const isScheduled = scheduledTime && new Date() < scheduledTime;
  const isReadyToStart = scheduledTime && new Date() >= scheduledTime && !isLive;

  const formatIST = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Asia/Kolkata'
    };
    let formattedDate = new Intl.DateTimeFormat('en-IN', options).format(date);
    return `${formattedDate} IST`;
  };
  
  const hasLiked = currentUserId ? likers?.includes(currentUserId) : false;

  return (
    <Card className="relative hover:border-primary/50 hover:shadow-lg transition-all duration-300 overflow-hidden h-full flex flex-col group shadow-md border-border bg-card">
       <div className="relative flex-1 flex flex-col">
            <Link href={`/chatroom/${id}`} className="block" onClick={handleJoinClick}>
                <CardHeader className="p-0 relative">
                    <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-background relative overflow-hidden group-hover:from-primary/30 transition-all duration-300">
                        <div className="absolute inset-0 bg-card/20"></div>
                        <div className="relative z-10 text-center px-4">
                            <h3 className="text-lg font-bold text-card-foreground leading-tight line-clamp-2">{title}</h3>
                        </div>
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all duration-300"></div>
                        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all duration-300"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
                    </div>
                    <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                        {isLive && (
                            <Badge className="bg-red-500 hover:bg-red-600 text-white border-none shadow-lg backdrop-blur-sm">
                            <span className="relative flex h-2 w-2 mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            LIVE
                            </Badge>
                        )}
                        {isScheduled && (
                            <Badge variant="secondary" className="shadow-lg backdrop-blur-sm bg-card/90 text-card-foreground border border-border/20">
                                <Calendar className="mr-2 h-4 w-4" />
                                {formatIST(scheduledTime)}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
            </Link>
            <div className="absolute bottom-2 left-2 flex items-center gap-2 z-10">
                <Link href={`/profile/${hostId}`} className="flex items-center gap-2 group/avatar" onClick={(e) => e.stopPropagation()}>
                    <Avatar className="h-10 w-10 border-2 border-background shadow-md">
                    <AvatarImage src={hostPhotoURL} alt={host} />
                    <AvatarFallback>{getInitials(host)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-semibold text-white bg-black/50 px-2 py-1 rounded-md opacity-0 group-hover/avatar:opacity-100 transition-opacity">By {host}</p>
                </Link>
            </div>
       </div>

        <CardFooter className="p-2 border-t bg-muted/50 flex items-center min-h-[52px] mt-auto">
            <div className="flex items-center w-full">
                <div className="flex-1 flex gap-2 items-center">
                    <Button variant="ghost" size="sm" onClick={(e) => handleLikeClick(e, 'like')} disabled={isLiking || hasLiked}>
                        <ThumbsUp className={`mr-2 h-4 w-4 ${hasLiked ? 'text-primary' : ''}`} />
                        {likes || 0}
                    </Button>
                </div>
                 {isOwner && isReadyToStart && (
                    <Button onClick={handleStartClick} size="sm" className="bg-green-600 hover:bg-green-700 text-white border-none shadow-sm">
                        <Play className="mr-2 h-4 w-4" /> Start
                    </Button>
                )}
                {isOwner && (
                    <div className="flex-shrink-0 ml-auto">
                        <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-200">
                            <Trash2 className="h-4 w-4"/>
                            <span className="sr-only">Delete Chat Room</span>
                        </Button>
                    </div>
                )}
            </div>
        </CardFooter>
        {isJoining && (
            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-20 rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="font-semibold text-foreground">Taking you to the room...</p>
            </div>
        )}
    </Card>
  );
}
