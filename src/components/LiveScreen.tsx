
"use client";

import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Share2, MicOff, Loader2, Star, MessageSquare, Mic, ArrowLeft, Waves, ListChecks, HelpCircle, Expand, Shrink, Plus, X, Radio } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { endChatRoom, Participant, startChatRoom, ChatRoom, clearFeaturedMessage } from '@/services/chatRoomService';
import { useRouter } from 'next/navigation';
import type { Message } from '@/services/chatRoomService';
import { LiveQuiz } from './LiveQuiz';
import { useAuth } from '@/context/AuthContext';
import { Quiz, Poll } from '@/services/pollService';
import { LivePoll } from './LivePoll';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogTrigger } from './ui/dialog';
import { cn } from '@/lib/utils';
import { AudioChat } from './AudioChat';


interface LiveScreenProps extends ChatRoom {
  isHost?: boolean;
  participants: Participant[];
  className?: string;
}

export function LiveScreen({ id: chatRoomId, title, host, hostId, isLive, imageHint, isHost = false, featuredMessage, hostReply, participants, activeQuiz, activePoll, className }: LiveScreenProps) {
  const [isEnding, setIsEnding] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const hostProfile = participants.find(p => p.userId === hostId);
  const featuredParticipant = featuredMessage ? participants.find(p => p.userId === featuredMessage.userId) : null;
  const [currentTab, setCurrentTab] = useState<'interaction' | 'featured' | 'audio'>('interaction');
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (activeQuiz || activePoll) {
        setCurrentTab('interaction');
    } else if (featuredMessage) {
        setCurrentTab('featured');
    }
  }, [activeQuiz, activePoll, featuredMessage]);


  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Link Copied!",
        description: "The chat room link has been copied to your clipboard.",
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
  
  const handleClearFeatured = async () => {
    try {
        await clearFeaturedMessage(chatRoomId);
        toast({ title: 'Featured message cleared.' });
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: e.message || "Could not clear featured message." });
    }
  }

  const handleEndChatRoom = async () => {
    setIsEnding(true);
    try {
        await endChatRoom(chatRoomId);
        toast({ title: "Chat Room Ended", description: "This chat room session has been successfully ended."});
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: "Could not end the chat room."});
    } finally {
        setIsEnding(false);
    }
  }

  const handleStartChatRoom = async () => {
    setIsStarting(true);
    try {
        await startChatRoom(chatRoomId);
        toast({ title: "Session is Live!", description: "The chat room is now live again."});
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: "Could not restart the chat room."});
    } finally {
        setIsStarting(false);
    }
  }

  const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const renderNoInteractionContent = () => (
    <div className="text-center text-muted-foreground space-y-2">
        <MessageSquare className="mx-auto h-12 w-12 text-primary/20" />
        <p className="font-bold">The Screen is Live!</p>
        {isHost ? (
            <p className="text-sm">Create a quiz or poll to engage your audience.</p>
        ) : (
            <p className="text-sm">The host can start a quiz or poll at any time.</p>
        )}
    </div>
  );


  return (
    <Card className={cn(
        "overflow-hidden shadow-lg flex flex-col transition-all duration-300",
        isFullScreen ? "fixed inset-0 z-[100] rounded-none h-screen" : "relative h-full min-h-[650px]",
        className
    )}>
       <CardHeader className="flex flex-row items-start justify-between gap-4 p-4 md:p-6">
        <div className="flex flex-row items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src={hostProfile?.photoURL} alt={host} />
              <AvatarFallback>{getInitials(host)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-xl md:text-2xl font-headline">{title}</CardTitle>
              <CardDescription>Hosted by {host}</CardDescription>
            </div>
            {isLive && (
              <div className="items-center gap-2 text-primary font-semibold hidden sm:flex">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                <span>LIVE</span>
              </div>
            )}
        </div>
         <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(!isFullScreen)}>
                {isFullScreen ? <Shrink className="h-5 w-5"/> : <Expand className="h-5 w-5"/>}
            </Button>
            {!isFullScreen && (
                <Button variant="outline" size="sm" onClick={() => router.back()} className="rounded-full flex-shrink-0">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            )}
         </div>
      </CardHeader>
      <CardContent className="bg-card/50 p-4 md:p-6 flex flex-col flex-1 min-h-0">
       {isLive ? (
        <div className="flex flex-col flex-1">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="interaction">
                        {activeQuiz || activePoll ? <ListChecks className="mr-2" /> : <HelpCircle className="mr-2" />}
                        Interaction
                    </TabsTrigger>
                     <TabsTrigger value="audio">
                        <Radio className="mr-2" />
                        Audio
                    </TabsTrigger>
                    <TabsTrigger value="featured">
                        <Star className="mr-2" />
                        Featured
                    </TabsTrigger>
                </TabsList>
                 <TabsContent value="interaction" className="flex-1 flex flex-col justify-center items-center pt-4">
                    {activeQuiz ? (
                        <LiveQuiz
                          chatRoomId={chatRoomId}
                          isHost={isHost}
                          currentUserId={currentUser!.uid}
                          participants={participants}
                          activeQuiz={activeQuiz}
                          renderNoQuizContent={renderNoInteractionContent}
                        />
                    ) : activePoll ? (
                         <LivePoll
                          chatRoomId={chatRoomId}
                          isHost={isHost}
                          currentUserId={currentUser!.uid}
                          activePoll={activePoll}
                          renderNoPollContent={renderNoInteractionContent}
                        />
                    ) : (
                         <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                            {renderNoInteractionContent()}
                            {isHost && (
                                <div className="flex gap-4 mt-4">
                                     <LivePoll
                                        chatRoomId={chatRoomId} isHost={isHost} currentUserId={currentUser!.uid} activePoll={null}
                                        renderNoPollContent={() => <></>}
                                     />
                                      <LiveQuiz
                                        chatRoomId={chatRoomId} isHost={isHost} currentUserId={currentUser!.uid} participants={participants} activeQuiz={null}
                                        renderNoQuizContent={() => <></>}
                                     />
                                </div>
                            )}
                        </div>
                    )}
                 </TabsContent>
                  <TabsContent value="audio" className="flex-1 flex flex-col justify-center items-center pt-4">
                     {currentUser && (
                       <AudioChat 
                          chatRoomId={chatRoomId}
                          isHost={isHost}
                          participants={participants}
                       />
                     )}
                  </TabsContent>
                 <TabsContent value="featured" className="flex-1 flex flex-col justify-center items-center pt-4">
                    {featuredMessage && featuredParticipant ? (
                        <div className="w-full space-y-4 animate-in fade-in-50 duration-500 relative">
                          {isHost && (
                            <Button variant="ghost" size="icon" className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background" onClick={handleClearFeatured}>
                                <X className="h-4 w-4" />
                            </Button>
                          )}
                          <div className="flex items-start space-x-3">
                              <Avatar className="h-8 w-8 border">
                                  <AvatarImage src={featuredParticipant.photoURL} alt={featuredParticipant.displayName} />
                                  <AvatarFallback>{getInitials(featuredMessage.user)}</AvatarFallback>
                              </Avatar>
                              <div className="bg-muted p-3 rounded-lg rounded-tl-none flex-1">
                                  <p className="text-sm font-bold text-muted-foreground">{featuredMessage.user}</p>
                                  {featuredMessage.text && <p className="text-base">{featuredMessage.text}</p>}
                              </div>
                          </div>
                          {hostReply && hostProfile && (
                              <div className="flex items-start space-x-3">
                                    <Avatar className="h-8 w-8 border-2 border-primary">
                                      <AvatarImage src={hostProfile.photoURL} alt={hostProfile.displayName} />
                                      <AvatarFallback className="text-primary font-bold">{getInitials(host)}</AvatarFallback>
                                  </Avatar>
                                  <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg rounded-tl-none flex-1">
                                      <p className="text-sm font-bold text-primary">{host} (Host)</p>
                                      <p className="text-base font-medium text-foreground">{hostReply}</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                       <div className="text-center text-muted-foreground space-y-2">
                            <Star className="mx-auto h-12 w-12 text-amber-500/20" />
                            <p className="font-bold">No Featured Message</p>
                            {isHost ? (
                                <p className="text-sm">Click the <Star className="inline h-4 w-4 text-amber-500" /> icon next to a message to feature it.</p>
                            ) : (
                                <p className="text-sm">The host can feature important messages here.</p>
                            )}
                        </div>
                  )}
                 </TabsContent>
            </Tabs>
           
            <div className="flex items-center space-x-4 pt-4 mt-auto justify-center">
                <Button variant="outline" onClick={handleShare}>
                    <Share2 className="mr-2" />
                    Share
                </Button>
                {isHost && (
                    <Button variant="destructive" onClick={handleEndChatRoom} disabled={isEnding}>
                    {isEnding ? <Loader2 className="animate-spin" /> : <MicOff />}
                        End Chat Room
                    </Button>
                )}
            </div>
        </div>
       ) : (
        <div className="flex flex-col items-center justify-center text-center space-y-4 flex-1">
            <Waves size={80} className="text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">This chat room has ended.</p>
            {isHost && (
                <Button onClick={handleStartChatRoom} disabled={isStarting}>
                    {isStarting ? <Loader2 className="animate-spin" /> : <Mic />}
                    Go Live Again
                </Button>
            )}
        </div>
       )}
      </CardContent>
    </Card>
  );
}
