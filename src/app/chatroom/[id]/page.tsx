
"use client";

import { useState, useEffect, use } from 'react';
import { Header } from '@/components/Header';
import { LiveScreen } from '@/components/LiveScreen';
import { LiveChat } from '@/components/LiveChat';
import { ParticipantsList } from '@/components/ParticipantsList';
import type { Message } from '@/services/chatRoomService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { MicOff, Sparkles, Users, MessageSquare, ShieldQuestion, UserX, ArrowLeft, Expand, Shrink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { getChatRoomStream, ChatRoom, getMessages, Participant, getParticipants, getParticipantStream, requestToJoinChat } from '@/services/chatRoomService';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HighlightTool } from '@/components/HighlightTool';
import { cn } from '@/lib/utils';


function ChatRoomPageSkeleton() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-4 md:py-8 grid lg:grid-cols-3 gap-4 md:gap-8 px-2 md:px-8">
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

function AwaitingApprovalScreen() {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-8 flex items-center justify-center px-2 md:px-8">
                <Card className="w-full max-w-md text-center p-8">
                    <CardHeader>
                        <ShieldQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <CardTitle>Awaiting Approval</CardTitle>
                        <CardDescription>Your request to join has been sent to the host. Please wait for them to approve you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href="/">Back to Homepage</Link>
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

function AccessDeniedScreen({ onReRequest }: { onReRequest: () => void }) {
    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-8 flex items-center justify-center px-2 md:px-8">
                <Card className="w-full max-w-md text-center p-8">
                    <CardHeader>
                        <UserX className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <CardTitle>Access Denied</CardTitle>
                        <CardDescription>The host has denied your request to join this session.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                         <Button onClick={onReRequest}>Request to Join Again</Button>
                         <Button asChild variant="outline">
                            <Link href="/">Back to Homepage</Link>
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

function RemovedScreen({ onReRequest }: { onReRequest: () => void }) {
     return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 container py-8 flex items-center justify-center px-2 md:px-8">
                <Card className="w-full max-w-md text-center p-8">
                    <CardHeader>
                        <UserX className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <CardTitle>You Have Been Removed</CardTitle>
                        <CardDescription>The host has removed you from this session. You can request to join again.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                         <Button onClick={onReRequest}>Request to Join Again</Button>
                         <Button asChild variant="outline">
                            <Link href="/">Back to Homepage</Link>
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}


export default function ChatRoomPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const [chatRoom, setChatRoom] = useState<ChatRoom | null>(null);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipantRecord, setMyParticipantRecord] = useState<Participant | null>(null);
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const { toast } = useToast();
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  
  const chatRoomId = resolvedParams.id;
  const isHost = currentUser && chatRoom && currentUser.uid === chatRoom.hostId;
  const isApprovedParticipant = !isHost && myParticipantRecord?.status === 'approved';

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [authLoading, currentUser, router]);
  
  useEffect(() => {
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
        setPageLoading(false);
    });
  
    return () => unsubscribeChatRoom();
  }, [chatRoomId, currentUser, router, toast]);
  
  useEffect(() => {
    if (!chatRoomId || !currentUser || isHost) {
        if (isHost) setPageLoading(false);
        return;
    };
    
    const unsubscribeParticipant = getParticipantStream(chatRoomId, currentUser.uid, (participant) => {
      setMyParticipantRecord(participant);
      if (!participant) {
        requestToJoinChat(chatRoomId, currentUser.uid).catch(err => {
          console.error("Failed to add participant:", err);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not send join request.' });
        });
      }
      setPageLoading(false);
    });

    return () => unsubscribeParticipant();

  }, [chatRoomId, currentUser, isHost, toast]);

  useEffect(() => {
    if (!chatRoomId) return;

    const unsubscribeParticipants = getParticipants(chatRoomId, (allParticipants) => {
        setParticipants(allParticipants);
    }, (error) => {
         console.error("Error fetching participants:", error);
         toast({ variant: 'destructive', title: 'Error', description: 'Could not load participant list.' });
    });

    return () => unsubscribeParticipants();
  }, [chatRoomId, toast]);


  useEffect(() => {
    if (!currentUser || !chatRoomId || (!isHost && !isApprovedParticipant)) return;

    const unsubscribeMessages = getMessages(chatRoomId, setChatLog, (error) => {
        console.error("Error fetching messages:", error);
        toast({variant: 'destructive', title: 'Error', description: 'Could not load messages.'})
    });
    return () => unsubscribeMessages();
  }, [chatRoomId, currentUser, isHost, isApprovedParticipant, toast]);
  
  const handleReRequest = async () => {
    if (!currentUser) return;
    try {
        await requestToJoinChat(chatRoomId, currentUser.uid);
        toast({ title: 'Request Sent', description: 'Your request to join has been sent to the host.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  }

  if (authLoading || pageLoading || !chatRoom || (!isHost && !myParticipantRecord)) {
    return <ChatRoomPageSkeleton />;
  }
  
  if (!currentUser) {
    return <ChatRoomPageSkeleton />;
  }

  // Handle different screens based on non-host participant status
  if (!isHost && myParticipantRecord) {
      if (myParticipantRecord.status === 'pending') {
          return <AwaitingApprovalScreen />;
      }
      if (myParticipantRecord.status === 'denied') {
          return <AccessDeniedScreen onReRequest={handleReRequest} />;
      }
      if (myParticipantRecord.status === 'removed') {
          return <RemovedScreen onReRequest={handleReRequest} />;
      }
  }

  if (!chatRoom.isLive && !isHost) {
      return (
          <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 container py-8 flex items-center justify-center px-2 md:px-8">
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

  const fullChatLog = chatLog.map(msg => `${msg.user}: ${msg.text}`).join('\n');
  const chatRoomDetails = {
    id: chatRoomId,
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
      <main className={cn(
          "flex-1 container py-4 md:py-8 gap-4 md:gap-8 px-2 md:px-8",
          isChatFullscreen ? "grid grid-cols-1 p-0 md:p-0" : "grid grid-cols-1 lg:grid-cols-3"
      )}>
        <div className={cn("lg:col-span-2 space-y-4", isChatFullscreen && "hidden")}>
          <LiveScreen {...chatRoomDetails} />
        </div>
        <div className={cn(
            "lg:col-span-1 flex flex-col gap-4",
            isChatFullscreen && "col-span-1"
        )}>
           <Card className={cn(
               "flex flex-col",
               isChatFullscreen 
                   ? "h-[calc(100vh-4rem)] rounded-none border-0" 
                   : "h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)] lg:h-auto lg:max-h-[calc(100vh-7rem)]"
           )}>
              <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/> Live Chat</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setIsChatFullscreen(!isChatFullscreen)}>
                    {isChatFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                  </Button>
              </CardHeader>
              <LiveChat 
                  chatRoom={chatRoom}
                  messages={chatLog}
                  participant={myParticipantRecord}
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
                                  <ParticipantsList chatRoomId={chatRoomId} participants={participants} hostId={chatRoom.hostId} />
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
