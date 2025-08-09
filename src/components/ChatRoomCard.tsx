
"use client";

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Trash2, Calendar, Play, Loader2 } from 'lucide-react';
import { ChatRoom } from '@/services/chatRoomService';
import { format } from 'date-fns';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface ChatRoomCardProps extends ChatRoom {
    isOwner: boolean;
    onDelete: () => void;
    onStartSession: () => void;
}

export function ChatRoomCard({ id, title, host, imageUrl, isLive, imageHint, isOwner, onDelete, onStartSession, scheduledAt, hostPhotoURL }: ChatRoomCardProps) {
  const [isJoining, setIsJoining] = useState(false);
  
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

  return (
    <Card className="relative hover:border-primary/50 hover:shadow-lg transition-all duration-300 overflow-hidden h-full flex flex-col group shadow-md border-border bg-card">
       <Link href={`/chatroom/${id}`} className="flex flex-col h-full flex-1" onClick={handleJoinClick}>
            <CardHeader className="p-0 relative">
                <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-background relative overflow-hidden group-hover:from-primary/30 transition-all duration-300">
                    <div className="absolute inset-0 bg-card/20"></div>
                    <div className="relative z-10 text-center px-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/30 transition-all duration-300">
                            <div className="w-8 h-8 rounded-full bg-primary/40 group-hover:scale-110 transition-transform duration-300"></div>
                        </div>
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
            <CardContent className="p-4 flex-1 flex flex-col bg-card">
                <CardTitle className="text-lg font-semibold tracking-tight truncate group-hover:text-primary text-card-foreground transition-colors duration-200">{title}</CardTitle>
                <div className="flex items-center gap-2 mt-1 flex-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={hostPhotoURL} alt={host} />
                      <AvatarFallback>{getInitials(host)}</AvatarFallback>
                    </Avatar>
                    <p className="text-muted-foreground text-sm">By {host}</p>
                </div>
            </CardContent>
        </Link>
        <CardFooter className="p-2 border-t bg-muted/50 flex items-center min-h-[52px]">
            <div className="flex items-center w-full">
                <div className="flex-1">
                    {isOwner && isReadyToStart && (
                        <Button onClick={handleStartClick} size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-sm">
                            <Play className="mr-2 h-4 w-4" /> Start Session Now
                        </Button>
                    )}
                </div>
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
