"use client";

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Radio } from 'lucide-react';
import { useState } from 'react';

interface PodcastPlayerProps {
  title: string;
  host: string;
  hostAvatar: string;
  isLive: boolean;
  imageHint: string;
}

export function PodcastPlayer({ title, host, hostAvatar, isLive, imageHint }: PodcastPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);

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
        </div>
      </CardContent>
    </Card>
  );
}
