
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/Header';
import { LiveScreen } from '@/components/LiveScreen';
import { LiveChat } from '@/components/LiveChat';
import { HighlightTool } from '@/components/HighlightTool';
import { ParticipantsList } from '@/components/ParticipantsList';
import type { Message } from '@/services/chatRoomService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, MessageSquare, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getChatRoomStream, ChatRoom, getMessages, Participant, getParticipants, addParticipant } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
                <div className="lg:col-span-1">
                    <Card className="h-full flex flex-col min-h-[500px] lg:min-h-0">
                      <CardHeader>
                        <Skeleton className="h-8 w-1/2" />
                      </CardHeader>
                      <CardContent className="flex-1 flex items-center justify-center">
                        <div className="w-full h-full p-4">
                          <Skeleton className="h-full w-full" />
                        </div>
                      </CardContent>
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
  const [permissionsReady, setPermissionsReady] = useState(false);
  const { toast } = useToast();

  const isHost = currentUser && chatRoom && currentUser.uid === chatRoom.hostId;
  const currentParticipant = participants.find(p => p.userId === currentUser?.uid);
  const canChat = isHost || currentParticipant?.status === 'approved';

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, authLoading, router]);

  // Step 1: Fetch the main chat room data
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
    }, (error) => {
        console.error("Error fetching chat room:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load chat room. You may not have permission to view it.' });
        router.push('/');
    });
  
    return () => unsubscribeChatRoom();
  }, [resolvedParams.id, currentUser, router, toast]);

  // Step 2: Once chat room data is loaded, manage participants and permissions
  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoomId || !currentUser || !chatRoom || !currentUser.profile) return;

    const unsubscribeParticipants = getParticipants(chatRoomId, async (newParticipants) => {
        setParticipants(newParticipants);
        const userInList = newParticipants.some(p => p.userId === currentUser.uid);

        if (chatRoom.hostId === currentUser.uid) {
            setPermissionsReady(true);
            return;
        }

        const current = newParticipants.find(p => p.userId === currentUser.uid);
        if (current?.status === 'approved') {
            setPermissionsReady(true);
        } else if (current) {
            setPermissionsReady(false);
        } else if (!userInList) {
             // If user is not in the list, add them with pending status for host approval.
             await addParticipant(chatRoomId, {
                userId: currentUser.uid,
                displayName: currentUser.profile.username,
                status: 'pending',
                requestCount: 1,
                emailVerified: currentUser.emailVerified,
            });
            setPermissionsReady(false);
        } else {
            setPermissionsReady(false);
        }
    }, (error) => {
        console.error("Error fetching participants:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not get participant list.'});
        setPermissionsReady(false); // Can't get participants, so can't proceed
    });

    return () => unsubscribeParticipants();
  }, [resolvedParams.id, currentUser, chatRoom, toast]);

  // Step 3: Once permissions are ready, fetch chat messages
  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    const current = participants.find(p => p.userId === currentUser?.uid);
    const isApproved = isHost || current?.status === 'approved';

    if (!chatRoomId || !isApproved) {
        if(chatLog.length > 0) setChatLog([]);
        return;
    };

    const unsubscribeMessages = getMessages(chatRoomId, setChatLog, (error) => {
        console.error("Error fetching messages:", error);
    });
    return () => unsubscribeMessages();
  }, [resolvedParams.id, isHost, participants, currentUser, chatLog.length]);

  if (authLoading || pageLoading || !currentUser || !chatRoom || !permissionsReady) {
    if (!authLoading && !pageLoading && currentUser && chatRoom && !permissionsReady && currentParticipant?.status === 'pending') {
         // Show a waiting screen for users pending approval
         return (
            <div className="min-h-screen flex flex-col">
                <Header />
                 <main className="flex-1 container py-8 flex items-center justify-center">
                    <Card className="w-full max-w-md text-center p-8">
                        <CardHeader>
                            <CardTitle>Awaiting Approval</CardTitle>
                            <CardDescription>The host has been notified of your request to join. Please wait a moment.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                        </CardContent>
                    </Card>
                </main>
            </div>
        )
    }
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
    participants: participants,
  };


  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container py-4 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
        <div className="lg:col-span-2 space-y-4">
          <LiveScreen {...chatRoomDetails} />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="flex flex-col h-[80vh] max-h-[80vh]">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Live Chat</CardTitle>
              </CardHeader>
              <LiveChat 
                  chatRoom={chatRoom} 
                  canChat={canChat} 
                  participant={currentParticipant}
                  isHost={isHost}
                  messages={chatLog}
              />
              <div className="mt-auto border-t">
                  <Accordion type="single" collapsible className="w-full">
                      {isHost && (
                          <AccordionItem value="participants" className="border-b-0">
                              <AccordionTrigger className="px-6 py-4">
                                  <span className="flex items-center gap-2 text-base font-semibold"><Users className="h-5 w-5" /> Participants</span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="px-2">
                                  <ParticipantsList chatRoomId={chatRoom.id} participants={participants} />
                                </div>
                              </AccordionContent>
                          </AccordionItem>
                      )}
                      <AccordionItem value="summary" className="border-b-0">
                          <AccordionTrigger className="px-6 py-4">
                              <span className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-5 w-5" /> AI Summary</span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="px-4 pb-2">
                              <HighlightTool chatLog={fullChatLog} />
                            </div>
                          </AccordionContent>
                      </AccordionItem>
                  </Accordion>
              </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
