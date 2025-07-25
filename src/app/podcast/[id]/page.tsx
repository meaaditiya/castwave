"use client";

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { LiveChat } from '@/components/LiveChat';
import { HighlightTool } from '@/components/HighlightTool';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Message } from '@/components/LiveChat';
import { Card, CardHeader } from "@/components/ui/card";
import { MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getPodcastById, Podcast } from '@/services/podcastService';

export default function PodcastPage({ params }: { params: { id: string } }) {
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    const fetchPodcast = async () => {
      setPageLoading(true);
      try {
        const podcastData = await getPodcastById(params.id);
        if (podcastData) {
          setPodcast(podcastData);
        } else {
          // Handle podcast not found, maybe redirect
          toast({ variant: 'destructive', title: 'Error', description: 'Podcast not found.' });
          router.push('/');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setPageLoading(false);
      }
    };
    if (params.id) {
        fetchPodcast();
    }
  }, [params.id, router]);

  const handleSendMessage = (newMessage: Message) => {
    setChatLog(prev => [...prev, newMessage]);
  };
  
  if (authLoading || pageLoading || !currentUser || !podcast) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
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
                <LiveChat messages={chatLog} onSendMessage={handleSendMessage} podcastId={podcast.id} />
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
