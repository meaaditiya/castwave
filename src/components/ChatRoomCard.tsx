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
    <Card className="hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 overflow-hidden h-full flex flex-col group shadow-md border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
       <Link href={`/chatroom/${id}`} className="flex flex-col h-full">
            <CardHeader className="p-0 relative">
                <div className="w-full h-48 flex items-center justify-center bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 relative overflow-hidden group-hover:from-violet-600 group-hover:via-purple-600 group-hover:to-blue-600 transition-all duration-300">
                    <div className="absolute inset-0 bg-black/20"></div>
                    <div className="relative z-10 text-white text-center px-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
                            <div className="w-8 h-8 rounded-full bg-white/40 group-hover:scale-110 transition-transform duration-300"></div>
                        </div>
                        <h3 className="text-lg font-bold text-white/95 leading-tight line-clamp-2">{title}</h3>
                    </div>
                    <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all duration-300"></div>
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-all duration-300"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
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
                        <Badge variant="secondary" className="shadow-lg backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-white/20">
                            <Calendar className="mr-2 h-4 w-4" />
                            {formatIST(scheduledTime)}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col bg-white dark:bg-slate-900">
                <CardTitle className="text-lg font-semibold tracking-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 text-slate-900 dark:text-slate-100 transition-colors duration-200">{title}</CardTitle>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 flex-1">By {host}</p>
            </CardContent>
        </Link>
        <CardFooter className="p-2 border-t border-slate-200 dark:border-slate-700 mt-auto bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center justify-between w-full">
                <div className="flex-1">
                    {isOwner && isReadyToStart && (
                        <Button onClick={handleStartClick} size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-sm">
                            <Play className="mr-2 h-4 w-4" /> Start Session Now
                        </Button>
                    )}
                </div>
                {isOwner && (
                    <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 ml-auto transition-colors duration-200">
                        <Trash2 className="h-4 w-4"/>
                        <span className="sr-only">Delete Chat Room</span>
                    </Button>
                )}
            </div>
        </CardFooter>
    </Card>
  );
}
