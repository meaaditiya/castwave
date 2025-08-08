
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
import { Loader2, MessageSquare, MicOff, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getChatRoomStream, ChatRoom, getMessages, Participant, getParticipants } from '@/services/chatRoomService';
import { getParticipantStatus } from '@/ai/flows/get-participant-status';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const { toast } = useToast();
  
  const isHost = currentUser && chatRoom && currentUser.uid === chatRoom.hostId;
  const canChat = isHost || currentParticipant?.status === 'approved';

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [authLoading, currentUser, router]);

  // Step 1: Fetch the main chat room data stream.
  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoomId || !currentUser) return; 
  
    setPageLoading(true);
  
    const unsubscribeChatRoom = getChatRoomStream(chatRoomId, (chatRoomData) => {
      if (chatRoomData) {
        setChatRoom(chatRoomData);
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
  
  // Step 2: Once chat room data is loaded, manage participants.
  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!chatRoom || !currentUser || !currentUser.profile) return;

    // Determine if the current user is the host of this chat room.
    const localIsHost = chatRoom.hostId === currentUser.uid;

    if (localIsHost) {
        // If the user is the host, they get a stream of all participants for the management UI.
        const unsubscribe = getParticipants(chatRoomId, (allParticipants) => {
            setParticipants(allParticipants);
            // Find the host in the list to set their own participant object.
            const hostParticipant = allParticipants.find(p => p.userId === currentUser.uid);
            if (hostParticipant) setCurrentParticipant(hostParticipant);
            setPageLoading(false);
        }, (error) => {
             console.error("Error fetching participants for host:", error);
             toast({ variant: 'destructive', title: 'Error', description: 'Could not load participant list.' });
             setPageLoading(false);
        });
        return unsubscribe; // Clean up the listener when the component unmounts.
    } else {
        // If the user is NOT the host, use the secure server-side flow to check their status.
        // This is the critical change to prevent permission-denied errors.
        const checkStatus = async () => {
            try {
                const result = await getParticipantStatus({ 
                    chatRoomId, 
                    userId: currentUser.uid,
                    displayName: currentUser.profile!.username,
                    photoURL: currentUser.profile!.photoURL,
                    emailVerified: currentUser.emailVerified,
                });

                if (result.participant) {
                    setCurrentParticipant(result.participant);
                } else {
                    // This case should theoretically not be reached as the flow now handles creation.
                    throw new Error("Participant status could not be resolved.");
                }

            } catch (error) {
                 console.error("Error fetching own participant data:", error);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not verify your status in the room.' });
            } finally {
                setPageLoading(false);
            }
        };
        checkStatus();
        // Note: This is a one-time check, not a stream. If a user's status changes while they are on this page (e.g., they get approved),
        // they will need to refresh to see the change. A future improvement could be to implement a secure stream for individual status.
    }
  }, [chatRoom, currentUser, resolvedParams.id, toast]);

  // Step 3: Once permissions are ready (i.e., we have participant status), fetch chat messages.
  useEffect(() => {
    const chatRoomId = resolvedParams.id;
    if (!currentUser) return;

    // User can chat if they are the host or if their status is 'approved'.
    const isApproved = isHost || currentParticipant?.status === 'approved';

    // If not approved, don't attempt to fetch messages.
    if (!chatRoomId || !isApproved) {
        if(chatLog.length > 0) setChatLog([]); // Clear any old messages if permissions change.
        return;
    };

    const unsubscribeMessages = getMessages(chatRoomId, setChatLog, (error) => {
        console.error("Error fetching messages:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not load messages.'})
    });
    return () => unsubscribeMessages();
  }, [resolvedParams.id, isHost, currentParticipant, currentUser, chatLog.length, toast]);
  
  if (authLoading || pageLoading) {
    return <ChatRoomPageSkeleton />;
  }
  
  if (!currentUser) {
    // This should be handled by the redirect at the top, but as a fallback.
    return <ChatRoomPageSkeleton />;
  }

  // If the session has ended and the user is not the host, show a specific screen.
  if (chatRoom && !chatRoom.isLive && !isHost) {
      return (
          <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 container py-8 flex items-center justify-center">
                  <Card className="w-full max-w-md text-center p-8">
                      <CardHeader>
                          <MicOff className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                          <CardTitle>Session Has Ended</CardTitle>
                          <CardDescription>This session is no longer live. Check the homepage for other active sessions.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <Button asChild>
                              <Link href="/">Back to Homepage</Link>
                          </Button>
                      </CardContent>
                  </Card>
              </main>
          </div>
      )
  }

  // If the user's request is pending, show the "Awaiting Approval" screen.
  if (currentParticipant?.status === 'pending' && !isHost) {
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

  if (!chatRoom) {
      return <ChatRoomPageSkeleton />;
  }


  const fullChatLog = chatLog.map(msg => `${msg.user}: ${msg.text}`).join('\n');
  const chatRoomDetails = {
    id: chatRoom.id,
    title: chatRoom.title,
    host: chatRoom.host,
    hostId: chatRoom.hostId,
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
                  participant={currentParticipant ?? undefined}
                  isHost={isHost}
                  messages={chatLog}
                  participants={participants}
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
