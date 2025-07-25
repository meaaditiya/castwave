
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

const podcastDetails = {
  id: '2',
  title: 'The Future of AI',
  host: 'Dr. Evelyn Reed',
  hostAvatar: 'https://placehold.co/100x100.png',
  isLive: true,
  imageHint: 'scientist portrait'
};

const initialMessages: Message[] = [
    { user: 'Alice', text: "What are your thoughts on GPT-4's reasoning abilities?" },
    { user: 'Bob', text: 'I think the real breakthrough will be in unsupervised learning.' },
    { user: 'Charlie', text: 'How far are we from AGI, realistically?' },
    { user: 'David', text: 'I heard that new models are showing emergent properties. Is that true?' },
    { user: 'Sarah', text: "The concept of 'long context windows' seems to be a game-changer for conversational AI." },
    { user: 'Mike', text: "What are the ethical implications we should be most concerned about right now?" },
];

export default function PodcastPage({ params }: { params: { id: string } }) {
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  useEffect(() => {
    // Simulate messages loading after mount
    setChatLog(initialMessages);
  }, []);

  const handleSendMessage = (newMessage: Message) => {
    setChatLog(prev => [...prev, newMessage]);
  };
  
  if (loading || !currentUser) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  const fullChatLog = chatLog.map(msg => `${msg.user}: ${msg.text}`).join('\n');

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
                <LiveChat messages={chatLog} onSendMessage={handleSendMessage} />
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
