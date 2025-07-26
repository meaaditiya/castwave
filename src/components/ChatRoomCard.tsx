
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Trash2, Calendar, Play } from 'lucide-react';
import { ChatRoom } from '@/services/chatRoomService';
import { format } from 'date-fns';

interface ChatRoomCardProps extends ChatRoom {
    isOwner: boolean;
    onDelete: () => void;
    onStartSession: () => void;
}

export function ChatRoomCard({ id, title, host, imageUrl, isLive, imageHint, isOwner, onDelete, onStartSession, scheduledAt }: ChatRoomCardProps) {
  
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
    <Card className="hover:border-primary transition-colors duration-300 overflow-hidden h-full flex flex-col group shadow-sm">
       <Link href={`/chatroom/${id}`} className="flex flex-col h-full">
            <CardHeader className="p-0 relative">
                <div className="overflow-hidden">
                    <Image
                        src={imageUrl || `https://placehold.co/600x400.png`}
                        alt={title}
                        width={600}
                        height={400}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        data-ai-hint={imageHint || 'abstract art'}
                    />
                </div>
                <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
                    {isLive && (
                        <Badge className="bg-red-600 text-white border-none shadow-lg">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        LIVE
                        </Badge>
                    )}
                    {isScheduled && (
                        <Badge variant="secondary" className="shadow-lg backdrop-blur-sm bg-background/70">
                            <Calendar className="mr-2 h-4 w-4" />
                            {formatIST(scheduledTime)}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col">
                <CardTitle className="text-lg font-semibold tracking-tight truncate group-hover:text-primary">{title}</CardTitle>
                <p className="text-muted-foreground text-sm mt-1 flex-1">By {host}</p>
            </CardContent>
        </Link>
        <CardFooter className="p-2 border-t mt-auto">
            <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                    {isOwner && isReadyToStart && (
                        <Button onClick={handleStartClick} size="sm" className="w-full">
                            <Play className="mr-2 h-4 w-4" /> Start Session Now
                        </Button>
                    )}
                </div>
                {isOwner && (
                    <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-auto">
                        <Trash2 className="h-4 w-4"/>
                        <span className="sr-only">Delete Chat Room</span>
                    </Button>
                )}
            </div>
        </CardFooter>
    </Card>
  );
}
