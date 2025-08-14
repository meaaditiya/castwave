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
import { Mic, MicOff, PhoneOff, Phone, Rss, Volume2, VolumeX, Hand, Volume, Volume1, ScreenShare, Share, StopCircle, SmilePlus, Video, VideoOff, Camera, Expand, Shrink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant, updateParticipantMuteStatus, updateParticipantHandRaiseStatus, sendReaction } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

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
  const [isSelfMuted, setIsSelfMuted] = useState(true);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [videoStreams, setVideoStreams] = useState<Record<string, MediaStream>>({});
  const [fullscreenUser, setFullscreenUser] = useState<string | null>(null);

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const [myParticipantInfo, setMyParticipantInfo] = useState<Participant | null>(null);

  // Pre-join state
  const [showPrejoin, setShowPrejoin] = useState(true);
  const [prejoinSettings, setPrejoinSettings] = useState({ audio: true, video: false });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localPreviewStream = useRef<MediaStream | null>(null);


  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (currentUser) {
        const me = participants.find(p => p.userId === currentUser.uid);
        setMyParticipantInfo(me || null);
        if (me) {
            setIsSelfMuted(me.isMuted ?? true);
        }

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

  const startLocalStream = useCallback(async (video: boolean) => {
    try {
      if (localPreviewStream.current) {
        localPreviewStream.current.getTracks().forEach(track => track.stop());
      }
      if (!video) {
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        localPreviewStream.current = null;
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      localPreviewStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
        console.error("Error accessing media devices for preview:", error);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Could not access camera for preview.' });
        setPrejoinSettings(s => ({...s, video: false}));
    }
  }, [toast]);
  
  useEffect(() => {
      let isMounted = true;
      const setupPreview = async () => {
          if (showPrejoin && isMounted) {
              await startLocalStream(prejoinSettings.video);
          }
      };
      setupPreview();
      return () => {
          isMounted = false;
           if (localPreviewStream.current) {
            localPreviewStream.current.getTracks().forEach(track => track.stop());
            localPreviewStream.current = null;
          }
      };
  }, [showPrejoin, prejoinSettings.video, startLocalStream]);


  const handleJoin = async () => {
    if (localPreviewStream.current) {
        localPreviewStream.current.getTracks().forEach(track => track.stop());
        localPreviewStream.current = null;
    }
    
    setShowPrejoin(false);
    
    let stream: MediaStream;
    try {
      if (prejoinSettings.audio || prejoinSettings.video) {
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: prejoinSettings.audio, 
            video: prejoinSettings.video 
        });
      } else {
        stream = new MediaStream(); // Create an empty stream if no devices are requested
      }

      setLocalStream(stream);
      setIsVideoOn(prejoinSettings.video && stream.getVideoTracks().length > 0);
      setIsSelfMuted(!prejoinSettings.audio || stream.getAudioTracks().length === 0);
      setIsConnected(true);
      toast({ title: "Connected!", description: "You have joined the call." });

    } catch (error) {
      console.error('Error accessing media:', error);
      toast({ variant: 'destructive', title: 'Media Access Denied', description: 'Please enable camera/microphone permissions in your browser.' });
      stream = new MediaStream();
      setLocalStream(stream);
      setIsVideoOn(false);
      setIsSelfMuted(true);
      setIsConnected(true);
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
    setShowPrejoin(true);
    setIsVideoOn(false);
    toast({ title: "Disconnected" });
  }, [chatRoomId, currentUser, localStream, toast]);
  
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
            const newPeer = createPeer(p.userId, true, localStream);
            setPeers(prev => ({...prev, [p.userId]: newPeer}));
        }
    });

    const approvedParticipantIds = new Set(approvedParticipants.map(p => p.userId));
    Object.keys(peersRef.current).forEach(peerId => {
      if (!approvedParticipantIds.has(peerId)) {
        peersRef.current[peerId].destroy();
        setPeers(prev => { const newPeers = { ...prev }; delete newPeers[peerId]; return newPeers; });
      }
    });

  }, [participants, isConnected, localStream, currentUser, createPeer]);
  
  useEffect(() => {
    if (localStream) {
        const isHostMuted = myParticipantInfo?.isMuted ?? false;
        const finalMuteState = isSelfMuted || (!isHost && isHostMuted);

        localStream.getAudioTracks().forEach(track => {
            track.enabled = !finalMuteState;
        });
    }
  }, [isSelfMuted, myParticipantInfo, localStream, isHost]);


  const toggleSelfMute = async () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    const newMuteState = !isSelfMuted;

    if (audioTrack) {
        if (!myParticipantInfo?.isMuted || isHost) {
             audioTrack.enabled = !newMuteState;
             setIsSelfMuted(newMuteState);
        } else {
            toast({ title: "You are muted by the host.", description: "You cannot unmute yourself."});
        }
    } else if (newMuteState === false) { // Trying to unmute but no track exists
         try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newAudioTrack = audioStream.getAudioTracks()[0];
            localStream.addTrack(newAudioTrack);
            Object.values(peersRef.current).forEach(peer => peer.addTrack(newAudioTrack, localStream));
            setIsSelfMuted(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Mic Access Denied", description: "Please enable mic permissions."});
        }
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    
    if (videoTrack) {
        const newVideoState = !isVideoOn;
        videoTrack.enabled = newVideoState;
        setIsVideoOn(newVideoState);
    } else if (!isVideoOn) {
         try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = videoStream.getAudioTracks()[0];
            localStream.addTrack(newVideoTrack);
            Object.values(peersRef.current).forEach(peer => peer.addTrack(newVideoTrack, localStream));
            setIsVideoOn(true);
        } catch (error) {
            toast({ variant: 'destructive', title: "Camera Access Denied", description: "Please enable camera permissions."});
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

  const isActuallyMuted = isSelfMuted || (!isHost && (myParticipantInfo?.isMuted ?? false));
  
  useEffect(() => {
    const assignStream = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
      if (el && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    };
    
    // Assign local stream to my video element
    if (currentUser && videoRefs.current[currentUser.uid]) {
        assignStream(videoRefs.current[currentUser.uid], isVideoOn ? localStream : null);
    }
    
    // Assign remote streams to other video elements
    Object.keys(videoRefs.current).forEach(userId => {
        if (userId !== currentUser?.uid) {
            assignStream(videoRefs.current[userId], videoStreams[userId] || null);
        }
    });

  }, [videoStreams, localStream, isVideoOn, currentUser, peers, participants]);

  const sortedParticipants = participants.filter(p => p.status === 'approved').sort((a, b) => {
    const aIsSpeaking = speakingPeers[a.userId];
    const bIsSpeaking = speakingPeers[b.userId];
    if (aIsSpeaking && !bIsSpeaking) return -1;
    if (!aIsSpeaking && bIsSpeaking) return 1;
    if (a.userId === currentUser?.uid) return -1;
    if (b.userId === currentUser?.uid) return 1;
    return 0;
  });


  if (showPrejoin) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="relative w-48 h-36">
                <video ref={localVideoRef} autoPlay muted className={cn("w-full h-full bg-black rounded-md object-cover", !prejoinSettings.video && "hidden")} />
                {!prejoinSettings.video && <div className="w-full h-full bg-muted rounded-md flex items-center justify-center"><Camera className="h-10 w-10 text-muted-foreground" /></div>}
            </div>
            <div className="flex gap-4 items-center">
                <div className="flex items-center space-x-2">
                    <Switch id="audio-prejoin" checked={prejoinSettings.audio} onCheckedChange={(checked) => setPrejoinSettings(s => ({...s, audio: checked}))} />
                    <Label htmlFor="audio-prejoin">Mic</Label>
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="video-prejoin" checked={prejoinSettings.video} onCheckedChange={(checked) => {
                        setPrejoinSettings(s => ({...s, video: checked}));
                        startLocalStream(checked);
                    }} />
                    <Label htmlFor="video-prejoin">Camera</Label>
                </div>
            </div>

            <Button onClick={handleJoin} size="lg"><Phone className="mr-2" /> Join Now</Button>
        </div>
    );
  }


  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Rss className="w-16 h-16 text-primary/20" />
        <h3 className="text-xl font-bold">Join Session</h3>
        <p className="text-muted-foreground">Click to join the live session.</p>
        <Button onClick={() => setShowPrejoin(true)}><Phone className="mr-2" /> Join</Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className={cn("w-full h-full flex flex-col", fullscreenUser && "bg-black")}>
       <div className={cn("grid flex-1 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4", fullscreenUser && "hidden")}>
        {sortedParticipants.map(p => {
            const hasVideo = (p.userId === currentUser?.uid && isVideoOn && localStream?.getVideoTracks().length > 0) || (videoStreams[p.userId] && videoStreams[p.userId].getVideoTracks().length > 0);
            
            return (
            <div key={p.userId} className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all aspect-square justify-center overflow-hidden",
                speakingPeers[p.userId] && !hasVideo && "bg-primary/20 border-primary shadow-lg scale-105",
                p.handRaised && "border-yellow-500 border-2"
            )}>
                 {hasVideo ? (
                    <video 
                        ref={el => videoRefs.current[p.userId] = el}
                        autoPlay 
                        playsInline
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
                
                {hasVideo && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="outline" className="absolute top-1 right-1 h-7 w-7 p-0 z-10" onClick={() => setFullscreenUser(p.userId)}>
                                <Expand className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Fullscreen</TooltipContent>
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

        {fullscreenUser && (
            <div className="flex-1 relative mb-4">
                 <video 
                    ref={el => videoRefs.current[fullscreenUser] = el}
                    autoPlay
                    playsInline
                    muted={fullscreenUser === currentUser?.uid} 
                    className="w-full h-full object-contain"
                />
                 <Button size="icon" variant="destructive" className="absolute top-4 right-4 z-20" onClick={() => setFullscreenUser(null)}>
                    <Shrink className="h-5 w-5" />
                 </Button>
            </div>
        )}
       
       <div className="mt-auto flex items-center justify-center flex-wrap gap-2 md:gap-4 pt-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={toggleSelfMute} variant={isActuallyMuted ? 'destructive' : 'outline'} size="lg" className="rounded-full h-14 w-14" disabled={!isHost && (myParticipantInfo?.isMuted ?? false)}>
                    {isActuallyMuted ? <MicOff /> : <Mic />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isActuallyMuted ? (myParticipantInfo?.isMuted && !isHost ? 'Muted by Host' : 'Muted') : 'Unmute'}</TooltipContent>
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
