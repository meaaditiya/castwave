
"use client";

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Radio, Share2, MicOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { endPodcast } from '@/services/podcastService';
import { useRouter } from 'next/navigation';

interface PodcastPlayerProps {
  id: string;
  title: string;
  host: string;
  hostAvatar: string;
  isLive: boolean;
  imageHint: string;
  isHost?: boolean;
}

export function PodcastPlayer({ id, title, host, hostAvatar, isLive, imageHint, isHost = false }: PodcastPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const { toast } = useToast();
  const router = useRouter();


  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied!",
        description: "The podcast link has been copied to your clipboard.",
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

  const handleEndPodcast = async () => {
    setIsEnding(true);
    try {
        await endPodcast(id);
        toast({ title: "Podcast Ended", description: "This podcast session has been successfully ended."});
        router.push('/');
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: "Could not end the podcast."});
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
          <div className="flex items-center gap-2 text-accent font-semibold">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
            </span>
            <span>LIVE</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="bg-card/50 p-6 flex flex-col items-center justify-center space-y-4 border-t">
       {isLive ? (
        <>
            <div className="relative">
                <Radio size={80} className="text-primary/50" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 animate-pulse"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-primary/20 animate-pulse delay-150"></div>
                </div>
            </div>

            <p className="text-muted-foreground">Live broadcast in session</p>
            <div className="flex items-center space-x-4">
            <Button variant="outline" size="lg" onClick={() => setIsPlaying(p => !p)} className="w-32">
                {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button variant="outline" size="lg" onClick={handleShare}>
                <Share2 className="mr-2" />
                Share
            </Button>
            {isHost && (
                <Button variant="destructive" size="lg" onClick={handleEndPodcast} disabled={isEnding}>
                   {isEnding ? <Loader2 className="animate-spin" /> : <MicOff />}
                    End Podcast
                </Button>
            )}
            </div>
        </>
       ) : (
        <>
            <MicOff size={80} className="text-muted-foreground" />
            <p className="text-muted-foreground">This podcast has ended.</p>
        </>
       )}
      </CardContent>
    </Card>
  );
}
