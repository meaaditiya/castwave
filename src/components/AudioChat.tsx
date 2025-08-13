
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { useAuth } from '@/context/AuthContext';
import {
  sendSignal,
  listenForSignals,
  cleanUpSignals,
} from '@/services/rtcService';
import { Button } from './ui/button';
import { Mic, MicOff, PhoneOff, Phone, Rss, Volume2, VolumeX, Hand, Volume, Volume1, ScreenShare, Share, StopCircle, SmilePlus, Video, VideoOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant, updateParticipantMuteStatus, updateParticipantHandRaiseStatus, sendReaction } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';

interface AudioChatProps {
  chatRoomId: string;
  isHost: boolean;
  participants: Participant[];
}

const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

const Reactions = ({ onSelect }: { onSelect: (emoji: string) => void }) => {
    const emojis = ['👍', '❤️', '😂', '😮', '👏', '🎉'];
    return (
        <div className="flex gap-2">
            {emojis.map(emoji => (
                <Button key={emoji} variant="outline" size="icon" onClick={() => onSelect(emoji)} className="text-xl">
                    {emoji}
                </Button>
            ))}
        </div>
    )
}

export function AudioChat({ chatRoomId, isHost, participants }: AudioChatProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer.Instance>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isSelfMuted, setIsSelfMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [videoStreams, setVideoStreams] = useState<Record<string, MediaStream>>({});

  const videoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const [myParticipantInfo, setMyParticipantInfo] = useState<Participant | null>(null);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (currentUser) {
        const me = participants.find(p => p.userId === currentUser.uid);
        setMyParticipantInfo(me || null);

        participants.forEach(p => {
            if (p.lastReaction) {
                setReactions(prev => ({...prev, [p.userId]: p.lastReaction!}));
                 setTimeout(() => {
                    setReactions(prev => {
                        const newReactions = {...prev};
                        delete newReactions[p.userId];
                        return newReactions;
                    });
                }, 10000);
            }
        })
    }
  }, [participants, currentUser]);

  const handleJoin = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setIsConnected(true);
      toast({ title: "Audio Connected!", description: "You can now add video." });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please enable microphone permissions in your browser.' });
    }
  };

  const handleLeave = useCallback(() => {
    if (currentUser) {
      cleanUpSignals(chatRoomId, currentUser.uid);
    }
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    setPeers({});
    setVideoStreams({});
    setIsConnected(false);
    setIsVideoOn(false);
    toast({ title: "Audio & Video Disconnected" });
  }, [chatRoomId, currentUser, localStream]);
  
  useEffect(() => {
    return () => {
      if (isConnected) {
        handleLeave();
      }
    };
  }, [isConnected, handleLeave]);


  const createPeer = useCallback((peerId: string, initiator: boolean, stream: MediaStream) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    peer.on('signal', (signal) => {
      if (currentUser) {
        sendSignal(chatRoomId, currentUser.uid, peerId, signal);
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('Got stream from', peerId);
      setVideoStreams(prev => ({...prev, [peerId]: remoteStream}));
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkSpeaking = () => {
          if (peer.destroyed) return;
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const isSpeaking = sum > 1000;

          setSpeakingPeers(prev => {
              if (!!prev[peerId] === isSpeaking) return prev;
              return { ...prev, [peerId]: isSpeaking }
          });
          requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();
    });
    
     peer.on('close', () => {
        console.log(`Connection closed with ${peerId}`);
        setPeers(prev => { const newPeers = { ...prev }; delete newPeers[peerId]; return newPeers; });
        setVideoStreams(prev => { const newStreams = {...prev}; delete newStreams[peerId]; return newStreams; });
    });

    peer.on('error', (err) => {
      console.error(`Error with peer ${peerId}:`, err);
       setPeers(prev => { const newPeers = { ...prev }; delete newPeers[peerId]; return newPeers; });
       setVideoStreams(prev => { const newStreams = {...prev}; delete newStreams[peerId]; return newStreams; });
    });

    return peer;
  }, [chatRoomId, currentUser]);


  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;

    const unsubscribe = listenForSignals(chatRoomId, currentUser.uid, (senderId, signal) => {
        let peer = peersRef.current[senderId];
        if (!peer) {
            peer = createPeer(senderId, false, localStream);
            setPeers(prev => ({ ...prev, [senderId]: peer }));
        }
        try { peer.signal(signal); } catch(err) { console.error("Error signaling peer", err); }
    });

    return () => unsubscribe();

  }, [isConnected, localStream, currentUser, chatRoomId, createPeer]);
  
  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;
    
    const approvedParticipants = participants.filter(p => p.status === 'approved' && p.userId !== currentUser.uid);
    
    approvedParticipants.forEach(p => {
        const shouldInitiate = currentUser.uid < p.userId;
        if (shouldInitiate && !peersRef.current[p.userId]) {
            console.log(`Attempting to initiate call with ${p.displayName}`);
            const newPeer = createPeer(p.userId, true, localStream);
            setPeers(prev => ({...prev, [p.userId]: newPeer}));
        }
    });

    const approvedParticipantIds = new Set(approvedParticipants.map(p => p.userId));
    Object.keys(peersRef.current).forEach(peerId => {
      if (!approvedParticipantIds.has(peerId)) {
        console.log(`Cleaning up stale peer connection: ${peerId}`);
        peersRef.current[peerId].destroy();
        setPeers(prev => { const newPeers = { ...prev }; delete newPeers[peerId]; return newPeers; });
      }
    });

  }, [participants, isConnected, localStream, currentUser, createPeer]);
  
  useEffect(() => {
    if (localStream) {
        const isHostMuted = myParticipantInfo?.isMuted ?? false;
        const finalMuteState = (isHost && isSelfMuted) || (!isHost && (isSelfMuted || isHostMuted));

        localStream.getAudioTracks().forEach(track => {
            track.enabled = !finalMuteState;
        });
    }
  }, [isSelfMuted, myParticipantInfo, localStream, isHost]);


  const toggleSelfMute = () => {
    if (!myParticipantInfo?.isMuted || isHost) {
       setIsSelfMuted(prev => !prev);
    } else {
        setIsSelfMuted(true);
        toast({ title: "You are muted by the host.", description: "You cannot unmute yourself."});
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    if (isVideoOn) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.stop();
            localStream.removeTrack(videoTrack);
            Object.values(peersRef.current).forEach(peer => peer.removeTrack(videoTrack, localStream));
        }
        setIsVideoOn(false);
    } else {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoTrack = videoStream.getVideoTracks()[0];
            localStream.addTrack(videoTrack);
            Object.values(peersRef.current).forEach(peer => peer.addTrack(videoTrack, localStream));
            setIsVideoOn(true);
        } catch (error) {
            toast({ variant: 'destructive', title: "Camera Access Denied", description: "Please enable camera permissions in your browser."});
        }
    }
  };

  const handleHostMute = async (participantId: string, shouldMute: boolean) => {
    if (!isHost) return;
    try { await updateParticipantMuteStatus(chatRoomId, participantId, shouldMute); } 
    catch(e) { toast({variant: 'destructive', title: 'Error', description: 'Could not update mute status.'}) }
  }

  const handleBulkMute = async (shouldMute: boolean) => {
    if (!isHost) return;
    try {
        const participantIds = participants.filter(p => p.userId !== currentUser?.uid && p.status === 'approved').map(p => p.userId);
        await Promise.all(participantIds.map(id => updateParticipantMuteStatus(chatRoomId, id, shouldMute)));
        toast({title: `All participants have been ${shouldMute ? 'muted' : 'unmuted'}.`})
    } catch(e) { toast({variant: 'destructive', title: 'Error', description: 'Could not perform bulk mute/unmute.'}) }
  }
  
  const handleHandRaise = async () => {
    if (!currentUser) return;
    const newHandRaiseState = !myParticipantInfo?.handRaised;
    await updateParticipantHandRaiseStatus(chatRoomId, currentUser.uid, newHandRaiseState);
  }

  const handleSendReaction = async (emoji: string) => {
    if (!currentUser) return;
    await sendReaction(chatRoomId, currentUser.uid, emoji);
  };

  const isActuallyMuted = (isHost && isSelfMuted) || (!isHost && (isSelfMuted || (myParticipantInfo?.isMuted ?? false)));

  useEffect(() => {
    Object.entries(videoStreams).forEach(([id, stream]) => {
        if (videoRefs.current[id]) {
            videoRefs.current[id].srcObject = stream;
        }
    });
  }, [videoStreams]);


  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Rss className="w-16 h-16 text-primary/20" />
        <h3 className="text-xl font-bold">Join Live Audio</h3>
        <p className="text-muted-foreground">Participate in the conversation by joining the audio stream.</p>
        <Button onClick={handleJoin}><Phone className="mr-2" /> Join Audio</Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="w-full h-full flex flex-col">
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
        {participants.filter(p => p.status === 'approved').map(p => {
            const remoteStream = videoStreams[p.userId];
            const localVideoStream = isVideoOn && p.userId === currentUser?.uid ? localStream : null;
            const hasVideo = !!remoteStream || !!localVideoStream;
            
            return (
            <div key={p.userId} className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all aspect-square justify-center overflow-hidden",
                speakingPeers[p.userId] && !hasVideo && "bg-primary/20 border-primary shadow-lg scale-105",
                p.handRaised && "border-yellow-500 border-2"
            )}>
                 {hasVideo ? (
                    <video 
                        ref={el => {if(el) videoRefs.current[p.userId] = el}}
                        srcObject={remoteStream || localVideoStream} 
                        autoPlay 
                        muted={p.userId === currentUser?.uid} 
                        className="w-full h-full object-cover absolute top-0 left-0"
                    />
                 ) : (
                    <Avatar className="h-16 w-16">
                        <AvatarImage src={p.photoURL} alt={p.displayName}/>
                        <AvatarFallback>{getInitials(p.displayName)}</AvatarFallback>
                    </Avatar>
                 )}
                
                <div className="absolute bottom-2 left-2 right-2 bg-black/50 p-1 rounded-md text-white z-10">
                    <div className="flex items-center justify-center gap-1">
                        {(p.userId === currentUser?.uid ? isActuallyMuted : p.isMuted) && <MicOff className="h-4 w-4 text-red-300" />}
                        <p className="font-semibold text-sm truncate w-full">{p.displayName} {p.userId === currentUser?.uid ? "(You)" : ""}</p>
                    </div>
                </div>

                 {reactions[p.userId] && (
                    <div className="absolute top-0 right-0 -mt-4 -mr-2 text-4xl animate-in fade-in zoom-in-50 slide-in-from-bottom-5 duration-500 z-10"
                         onAnimationEnd={() => setReactions(prev => { const newReactions = {...prev}; delete newReactions[p.userId]; return newReactions;})}>
                        {reactions[p.userId]}
                    </div>
                )}
                {p.handRaised && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="absolute top-1 right-1"><Hand className="h-5 w-5 text-yellow-500 bg-black/50 rounded-full p-1" /></span>
                        </TooltipTrigger>
                        <TooltipContent>Wants to speak</TooltipContent>
                    </Tooltip>
                )}
                
                {isHost && p.userId !== currentUser?.uid && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                             <Button size="sm" variant="outline" className="absolute top-1 left-1 h-7 w-7 p-0 z-10" onClick={() => handleHostMute(p.userId, !p.isMuted)}>
                                {p.isMuted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4"/>}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{p.isMuted ? 'Unmute User' : 'Mute User'}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        )})}
       </div>
       
       <div className="mt-auto flex items-center justify-center flex-wrap gap-2 md:gap-4 pt-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={toggleSelfMute} variant={isActuallyMuted ? 'destructive' : 'outline'} size="lg" className="rounded-full h-14 w-14" disabled={!isHost && myParticipantInfo?.isMuted}>
                    {isActuallyMuted ? <MicOff /> : <Mic />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isActuallyMuted ? (myParticipantInfo?.isMuted && !isHost ? 'Muted by Host' : 'Muted') : 'Mute'}</TooltipContent>
          </Tooltip>
          
          <Tooltip>
             <TooltipTrigger asChild>
                <Button onClick={toggleVideo} variant={isVideoOn ? "default" : "outline"} size="lg" className="rounded-full h-14 w-14">
                    {isVideoOn ? <VideoOff /> : <Video />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isVideoOn ? 'Stop Video' : 'Start Video'}</TooltipContent>
          </Tooltip>

          <Tooltip>
             <TooltipTrigger asChild>
                <Button onClick={handleLeave} variant="destructive" size="lg" className="rounded-full h-14 w-14">
                    <PhoneOff />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Leave Call</TooltipContent>
          </Tooltip>
         
           {!isHost && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={handleHandRaise} variant={myParticipantInfo?.handRaised ? "default" : "outline"} size="lg" className="rounded-full h-14 w-14">
                        <Hand />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{myParticipantInfo?.handRaised ? 'Lower Hand' : 'Willing to Speak'}</TooltipContent>
            </Tooltip>
           )}

             <Popover>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="lg" className="rounded-full h-14 w-14">
                                <SmilePlus />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Send Reaction</TooltipContent>
                </Tooltip>
                <PopoverContent>
                    <Reactions onSelect={handleSendReaction} />
                </PopoverContent>
            </Popover>


            {isHost && (
            <>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={() => handleBulkMute(true)} variant="outline" size="lg" className="rounded-full h-14 w-14"><Volume1 /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Mute All</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={() => handleBulkMute(false)} variant="outline" size="lg" className="rounded-full h-14 w-14"><Volume /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Unmute All</TooltipContent>
                </Tooltip>
            </>
           )}
        </div>
    </div>
    </TooltipProvider>
  );
}

    