
"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { LiveChat } from '@/components/LiveChat';
import { HighlightTool } from '@/components/HighlightTool';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Message } from '@/components/LiveChat';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getPodcastById, Podcast, getMessages } from '@/services/podcastService';
import { useToast } from '@/hooks/use-toast';

function PodcastPageSkeleton() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-8 grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                     <Card>
                        <CardHeader className="flex flex-row items-center gap-4 p-6">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 border-t">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <Skeleton className="h-20 w-20 rounded-full" />
                                <Skeleton className="h-4 w-48" />
                                <div className="flex items-center space-x-4">
                                    <Skeleton className="h-11 w-32" />
                                    <Skeleton className="h-11 w-32" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="h-full flex flex-col min-h-[500px] lg:min-h-0">
                        <CardHeader>
                           <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="chat" disabled><MessageSquare className="mr-2 h-4 w-4" />Live Chat</TabsTrigger>
                                <TabsTrigger value="highlights" disabled><Sparkles className="mr-2 h-4 w-4" />AI Highlights</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <div className="flex-1 flex items-center justify-center">
                            <Skeleton className="h-48 w-full m-4" />
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}


export default function PodcastPage({ params }: { params: { id: string } }) {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const { toast } = useToast();
  const podcastId = params.id;

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    const fetchPodcast = async () => {
      setPageLoading(true);
      try {
        const podcastData = await getPodcastById(podcastId);
        if (podcastData) {
          setPodcast(podcastData);
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Podcast not found.' });
          router.push('/');
        }
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load podcast.' });
      } finally {
        setPageLoading(false);
      }
    };
    if (podcastId) {
        fetchPodcast();
    }
  }, [podcastId, router, toast]);

  useEffect(() => {
    if (!podcastId) return;
    const unsubscribe = getMessages(podcastId, setChatLog);
    return () => unsubscribe();
  }, [podcastId]);
  
  if (authLoading || pageLoading || !currentUser || !podcast) {
    return <PodcastPageSkeleton />;
  }

  const fullChatLog = chatLog.map(msg => `${msg.user}: ${msg.text}`).join('\n');
  const podcastDetails = {
    id: podcast.id,
    title: podcast.title,
    host: podcast.host,
    hostAvatar: 'https://placehold.co/100x100.png',
    isLive: podcast.isLive,
    imageHint: 'scientist portrait'
  };


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <PodcastPlayer {...podcastDetails} />
        </div>
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col min-h-[500px] lg:min-h-0">
            <Tabs defaultValue="chat" className="w-full h-full flex flex-col">
              <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4" />Live Chat</TabsTrigger>
                  <TabsTrigger value="highlights"><Sparkles className="mr-2 h-4 w-4" />AI Highlights</TabsTrigger>
                </TabsList>
              </CardHeader>
              <TabsContent value="chat" className="flex-1 overflow-auto">
                <LiveChat podcastId={podcast.id} />
              </TabsContent>
              <TabsContent value="highlights" className="flex-1 overflow-auto">
                <HighlightTool chatLog={fullChatLog} />
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </main>
    </div>
  );
}
