
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/Header';
import { LiveScreen } from '@/components/LiveScreen';
import { LiveChat } from '@/components/LiveChat';
import { HighlightTool } from '@/components/HighlightTool';
import { ParticipantsList } from '@/components/ParticipantsList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Message } from '@/services/chatRoomService';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getChatRoomStream, ChatRoom, getMessages, Participant, getParticipants, addParticipant } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';

function ChatRoomPageSkeleton() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-4 md:py-8 grid lg:grid-cols-3 gap-4 md:gap-8">
                <div className="lg:col-span-2 space-y-4">
                     <Card>
                        <CardHeader className="flex flex-row items-center gap-4 p-4 md:p-6">
                            <Skeleton className="h-16 w-16 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 border-t">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <Skeleton className="h-48 w-full" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card className="h-full flex flex-col min-h-[500px] lg:min-h-0">
                      <Tabs defaultValue="chat" className="w-full h-full flex flex-col">
                        <CardHeader>
                           <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="chat" disabled><MessageSquare className="mr-2 h-4 w-4" />Live Chat</TabsTrigger>
                                <TabsTrigger value="highlights" disabled><Sparkles className="mr-2 h-4 w-4" />AI Highlights</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <TabsContent value="chat" className="flex-1 flex items-center justify-center">
                            <div className="w-full h-full p-4">
                              <Skeleton className="h-full w-full" />
                            </div>
                        </TabsContent>
                       </Tabs>
                    </Card>
                </div>
            </main>
        </div>
    );
}


export default function ChatRoomPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const { toast } = useToast();

  const isHost = currentUser && chatRoom && currentUser.uid === chatRoom.hostId;
  const currentParticipant = participants.find(p => p.userId === currentUser?.uid);
  const canChat = isHost || currentParticipant?.status === 'approved';

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoomId || !currentUser) return;
  
    setPageLoading(true);
  
    const unsubscribeChatRoom = getChatRoomStream(chatRoomId, (chatRoomData) => {
      if (chatRoomData) {
        setChatRoom(chatRoomData);
        setPageLoading(false); 
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Chat Room not found.' });
        router.push('/');
      }
    });
  
    return () => unsubscribeChatRoom();
  }, [resolvedParams.id, currentUser, router, toast]);

  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoomId || !currentUser) return;

    const unsubscribeParticipants = getParticipants(chatRoomId, (newParticipants) => {
        setParticipants(newParticipants);

        const userInList = newParticipants.some(p => p.userId === currentUser.uid);

        if (!userInList && chatRoom?.hostId && currentUser.uid && !authLoading) {
            const status = chatRoom.hostId === currentUser.uid ? 'approved' : 'pending';
            addParticipant(chatRoomId, {
                userId: currentUser.uid,
                displayName: currentUser.email || 'Anonymous',
                status: status
            });
        }
    });

    return () => unsubscribeParticipants();
  }, [resolvedParams.id, currentUser, chatRoom, authLoading]);


  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoomId) return;
    const unsubscribeMessages = getMessages(chatRoomId, setChatLog);
    return () => unsubscribeMessages();
  }, [resolvedParams.id]);

  if (authLoading || pageLoading || !currentUser || !chatRoom) {
    return <ChatRoomPageSkeleton />;
  }

  const fullChatLog = chatLog.map(msg => `${msg.user}: ${msg.text}`).join('\n');
  const chatRoomDetails = {
    id: chatRoom.id,
    title: chatRoom.title,
    host: chatRoom.host,
    hostAvatar: 'https://placehold.co/100x100.png',
    isLive: chatRoom.isLive,
    imageHint: 'scientist portrait',
    isHost: isHost,
    featuredMessage: chatRoom.featuredMessage,
    hostReply: chatRoom.hostReply,
  };


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-4 md:py-8 grid lg:grid-cols-3 gap-4 md:gap-8">
        <div className="lg:col-span-2">
          <LiveScreen {...chatRoomDetails} />
        </div>
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col min-h-[500px] lg:min-h-0">
            <Tabs defaultValue="chat" className="w-full h-full flex flex-col">
              <CardHeader className="p-2 sm:p-4">
                 <TabsList className={`grid w-full ${isHost ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="chat"><MessageSquare className="mr-2 h-4 w-4" />Live Chat</TabsTrigger>
                  {isHost && <TabsTrigger value="participants"><Users className="mr-2 h-4 w-4" />Participants</TabsTrigger>}
                  <TabsTrigger value="highlights"><Sparkles className="mr-2 h-4 w-4" />AI Highlights</TabsTrigger>
                </TabsList>
              </CardHeader>
              <TabsContent value="chat" className="flex-1 overflow-auto">
                <LiveChat 
                    chatRoom={chatRoom} 
                    canChat={canChat} 
                    participantStatus={currentParticipant?.status}
                    isHost={isHost}
                    messages={chatLog}
                />
              </TabsContent>
               {isHost && (
                <TabsContent value="participants" className="flex-1 overflow-auto">
                    <ParticipantsList chatRoomId={chatRoom.id} participants={participants} />
                </TabsContent>
               )}
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
