"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PodcastCard } from '@/components/PodcastCard';
import { getPodcasts, Podcast } from '@/services/podcastService';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    // Show skeleton loaders for a minimum time to avoid flickering
    const timer = setTimeout(() => {
        const unsubscribe = getPodcasts((newPodcasts) => {
          setPodcasts(newPodcasts);
          setLoading(false);
        });

        return () => unsubscribe();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <h1 className="text-4xl font-headline font-bold mb-2">Active Podcasts</h1>
        <p className="text-muted-foreground mb-8">Join a live session and be part of the conversation.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading || authLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))
          ) : (
            podcasts.map(podcast => (
              <PodcastCard key={podcast.id} {...podcast} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
