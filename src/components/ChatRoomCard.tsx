
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from './ui/button';
import { Trash2, Calendar } from 'lucide-react';
import { ChatRoom } from '@/services/chatRoomService';
import { format } from 'date-fns';


interface ChatRoomCardProps extends ChatRoom {
    isOwner: boolean;
    onDelete: () => void;
}


export function ChatRoomCard({ id, title, host, imageUrl, isLive, imageHint, isOwner, onDelete, scheduledAt }: ChatRoomCardProps) {
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  }
  
  const isScheduled = scheduledAt && new Date() < scheduledAt.toDate();

  return (
    <Card className="hover:border-primary transition-colors duration-300 overflow-hidden h-full flex flex-col group">
       <Link href={`/chatroom/${id}`} className="flex flex-col h-full">
            <CardHeader className="p-0 relative">
            <Image
                src={imageUrl || 'https://placehold.co/400x400.png'}
                alt={title}
                width={400}
                height={400}
                className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                data-ai-hint={imageHint}
            />
            {isLive && (
                <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground border-primary-foreground/20 shadow-lg">
                <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                LIVE
                </Badge>
            )}
             {isScheduled && !isLive && (
                 <Badge variant="secondary" className="absolute top-2 right-2  shadow-lg">
                    <Calendar className="mr-2 h-4 w-4" />
                   {format(scheduledAt.toDate(), "MMM d, h:mm a")}
                </Badge>
             )}

            </CardHeader>
            <div className="p-4 flex-1 flex flex-col">
                <CardTitle className="text-lg font-headline truncate">{title}</CardTitle>
                <p className="text-muted-foreground text-sm mt-1 flex-1">{host}</p>
            </div>
            
        </Link>
        <CardFooter className="p-2 justify-end mt-auto">
            {isOwner && (
                <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4"/>
                    <span className="sr-only">Delete Chat Room</span>
                </Button>
            )}
        </CardFooter>
    </Card>
  );
}

    