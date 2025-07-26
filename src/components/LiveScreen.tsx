
"use client";

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, MicOff, Loader2, Star, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { endChatRoom } from '@/services/chatRoomService';
import { useRouter } from 'next/navigation';
import type { Message } from '@/services/chatRoomService';

interface LiveScreenProps {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  isLive: boolean;
  imageHint: string;
  isHost?: boolean;
  featuredMessage?: Message;
  hostReply?: string;
}

export function LiveScreen({ id, title, host, hostAvatar, isLive, imageHint, isHost = false, featuredMessage, hostReply }: LiveScreenProps) {
  const [isEnding, setIsEnding] = useState(false);
  const { toast } = useToast();
  const router = useRouter();


  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied!",
        description: "The chat room link has been copied to your clipboard.",
      });
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast({
        variant: 'destructive',
        title: "Failed to Copy",
        description: "Could not copy the link.",
      })
    });
  };

  const handleEndChatRoom = async () => {
    setIsEnding(true);
    try {
        await endChatRoom(id);
        toast({ title: "Chat Room Ended", description: "This chat room session has been successfully ended."});
        router.push('/');
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: "Could not end the chat room."});
        setIsEnding(false);
    }
  }

  return (
    <Card className="overflow-hidden shadow-2xl shadow-primary/10">
      <CardHeader className="flex flex-row items-center gap-4 p-6">
        <Avatar className="h-16 w-16 border-2 border-primary">
          <AvatarImage src={hostAvatar} alt={host} data-ai-hint={imageHint} />
          <AvatarFallback>{host.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <CardTitle className="text-2xl font-headline">{title}</CardTitle>
          <CardDescription>Hosted by {host}</CardDescription>
        </div>
        {isLive && (
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span>LIVE</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="bg-card/50 p-6 flex flex-col items-center justify-center space-y-4 border-t min-h-[300px]">
       {isLive ? (
        <>
            {featuredMessage ? (
                 <div className="w-full text-center space-y-4 animate-in fade-in-50">
                    <div className="bg-primary/10 p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground">{featuredMessage.user} asked:</p>
                        <p className="text-lg font-medium">"{featuredMessage.text}"</p>
                    </div>
                    {hostReply && (
                        <div className="bg-background p-4 rounded-lg border">
                            <p className="text-sm text-muted-foreground">{host} replied:</p>
                            <p className="text-xl font-bold text-primary">{hostReply}</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center text-muted-foreground space-y-2">
                    <Star className="mx-auto h-12 w-12 text-primary/20" />
                    <p>Featured messages will appear here.</p>
                </div>
            )}
           
            <div className="flex items-center space-x-4 pt-4">
                <Button variant="outline" size="lg" onClick={handleShare}>
                    <Share2 className="mr-2" />
                    Share
                </Button>
                {isHost && (
                    <Button variant="destructive" size="lg" onClick={handleEndChatRoom} disabled={isEnding}>
                    {isEnding ? <Loader2 className="animate-spin" /> : <MicOff />}
                        End Chat Room
                    </Button>
                )}
            </div>
        </>
       ) : (
        <>
            <MicOff size={80} className="text-muted-foreground" />
            <p className="text-muted-foreground">This chat room has ended.</p>
        </>
       )}
      </CardContent>
    </Card>
  );
}
