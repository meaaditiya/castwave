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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isSelfMuted, setIsSelfMuted] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(false);
  
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  const [videoStreams, setVideoStreams] = useState<Record<string, MediaStream>>({});
  const [fullscreenUser, setFullscreenUser] = useState<string | null>(null);
  const [myParticipantInfo, setMyParticipantInfo] = useState<Participant | null>(null);
  
  // Pre-join state
  const [showPrejoin, setShowPrejoin] = useState(true);
  const [prejoinSettings, setPrejoinSettings] = useState({ audio: true, video: false });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Refs for robust handling
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioVisualizersRef = useRef<Record<string, () => void>>({});
  const localPreviewStreamRef = useRef<MediaStream | null>(null);
  
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('default');

  useEffect(() => {
    const getDevices = async () => {
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true }); // Request permission
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
            setAudioOutputDevices(audioOutputs);
        } catch (error) {
            console.error("Could not enumerate audio devices:", error);
        }
    };
    getDevices();
  }, []);

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

  const cleanupPeer = useCallback((peerId: string) => {
    const peer = peersRef.current[peerId];
    if (peer && !peer.destroyed) {
        peer.destroy();
    }
    
    // Stop audio visualizer
    if (audioVisualizersRef.current[peerId]) {
        audioVisualizersRef.current[peerId]();
        delete audioVisualizersRef.current[peerId];
    }
    
    delete peersRef.current[peerId];
    setVideoStreams(prev => { const newStreams = {...prev}; delete newStreams[peerId]; return newStreams; });
    setSpeakingPeers(prev => { const newPeers = {...prev}; delete newPeers[peerId]; return newPeers; });
  }, []);

  const handleLeave = useCallback(() => {
    if (currentUser) {
      cleanUpSignals(chatRoomId, currentUser.uid);
    }
    
    localStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    
    Object.keys(peersRef.current).forEach(peerId => cleanupPeer(peerId));
    
    setIsConnected(false);
    setShowPrejoin(true);
    setIsVideoOn(false);
    toast({ title: "Disconnected" });

    // Clean up audio context
    if(audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  }, [chatRoomId, currentUser, localStream, toast, cleanupPeer]);

  const startLocalStream = useCallback(async (video: boolean) => {
    try {
      if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (!video) {
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        localPreviewStreamRef.current = null;
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      localPreviewStreamRef.current = stream;
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
      if (showPrejoin && isMounted) {
          startLocalStream(prejoinSettings.video);
      }
      return () => {
          isMounted = false;
           if (localPreviewStreamRef.current) {
            localPreviewStreamRef.current.getTracks().forEach(track => track.stop());
            localPreviewStreamRef.current = null;
          }
      };
  }, [showPrejoin, prejoinSettings.video, startLocalStream]);

  const handleJoin = async () => {
    if (localPreviewStreamRef.current) {
        localPreviewStreamRef.current.getTracks().forEach(track => track.stop());
        localPreviewStreamRef.current = null;
    }
    setShowPrejoin(false);
    
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
          audio: prejoinSettings.audio, 
          video: prejoinSettings.video 
      });
      setLocalStream(stream);
      setIsVideoOn(prejoinSettings.video && stream.getVideoTracks().length > 0);
      setIsSelfMuted(!prejoinSettings.audio || stream.getAudioTracks().length === 0);
      setIsConnected(true);
      toast({ title: "Connected!", description: "You have joined the call." });
    } catch (error) {
      console.error('Error accessing media:', error);
      toast({ variant: 'destructive', title: 'Media Access Denied', description: 'Please enable camera/microphone permissions in your browser.' });
      handleLeave();
    }
  };

  useEffect(() => {
    return () => {
      if (isConnected) {
        handleLeave();
      }
    };
  }, [isConnected, handleLeave]);

  const createPeer = useCallback((peerId: string, initiator: boolean, stream: MediaStream) => {
    if (peersRef.current[peerId]) {
        return peersRef.current[peerId];
    }
    
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: stream,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });

    peer.on('signal', (signal) => {
      if (currentUser) {
        sendSignal(chatRoomId, currentUser.uid, peerId, signal);
      }
    });

    peer.on('stream', (remoteStream) => {
      setVideoStreams(prev => ({...prev, [peerId]: remoteStream}));
      
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(remoteStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let animationFrameId: number;

      const checkSpeaking = () => {
          if (peer.destroyed) {
              cancelAnimationFrame(animationFrameId);
              return;
          }
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const isSpeaking = sum > 1000;

          setSpeakingPeers(prev => {
              if (!!prev[peerId] === isSpeaking) return prev;
              return { ...prev, [peerId]: isSpeaking }
          });
          animationFrameId = requestAnimationFrame(checkSpeaking);
      };
      checkSpeaking();

      audioVisualizersRef.current[peerId] = () => {
          cancelAnimationFrame(animationFrameId);
          source.disconnect();
      }
    });

    peer.on('iceStateChange', (state) => {
      if (state === 'failed' || state === 'disconnected') {
        console.warn(`ICE connection state for ${peerId} changed to ${state}. Cleaning up.`);
        cleanupPeer(peerId);
      }
    });
    
    peer.on('close', () => cleanupPeer(peerId));
    peer.on('error', (err) => {
      console.error(`Error with peer ${peerId}:`, err);
      cleanupPeer(peerId);
    });

    peersRef.current[peerId] = peer;
    return peer;
  }, [chatRoomId, currentUser, cleanupPeer]);

  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;

    const unsubscribe = listenForSignals(chatRoomId, currentUser.uid, (senderId, signal) => {
        let peer = peersRef.current[senderId];
        if (!peer) {
            peer = createPeer(senderId, false, localStream);
        }
        try { if (!peer.destroyed) peer.signal(signal); } catch(err) { console.error("Error signaling peer", err); }
    });

    return unsubscribe;
  }, [isConnected, localStream, currentUser, chatRoomId, createPeer]);
  
  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;
    
    const approvedParticipants = participants.filter(p => p.status === 'approved' && p.userId !== currentUser.uid && p.isPresent);
    
    approvedParticipants.forEach(p => {
        if (!peersRef.current[p.userId]) {
            createPeer(p.userId, true, localStream);
        }
    });

    const approvedParticipantIds = new Set(approvedParticipants.map(p => p.userId));
    Object.keys(peersRef.current).forEach(peerId => {
      if (!approvedParticipantIds.has(peerId)) {
        cleanupPeer(peerId);
      }
    });

  }, [participants, isConnected, localStream, currentUser, createPeer, cleanupPeer]);
  
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
    const newMuteState = !isSelfMuted;

    if (localStream.getAudioTracks().length > 0) {
        if (!myParticipantInfo?.isMuted || isHost) {
             setIsSelfMuted(newMuteState);
        } else {
            toast({ title: "You are muted by the host.", description: "You cannot unmute yourself."});
        }
    } else if (newMuteState === false) { // Trying to unmute but no track exists
         try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const newAudioTrack = audioStream.getAudioTracks()[0];
            localStream.addTrack(newAudioTrack);
            Object.values(peersRef.current).forEach(peer => {
                if(!peer.destroyed) peer.addTrack(newAudioTrack, localStream);
            });
            setIsSelfMuted(false);
        } catch (error) {
            toast({ variant: 'destructive', title: "Mic Access Denied", description: "Please enable mic permissions."});
        }
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    const newVideoState = !isVideoOn;
    
    if (localStream.getVideoTracks().length > 0) {
        localStream.getVideoTracks().forEach(track => track.enabled = newVideoState);
        setIsVideoOn(newVideoState);
    } else if (newVideoState) {
         try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newVideoTrack = videoStream.getTracks()[0];
            localStream.addTrack(newVideoTrack);
            Object.values(peersRef.current).forEach(peer => {
                if(!peer.destroyed) peer.addTrack(newVideoTrack, localStream)
            });
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
  
  const assignStream = useCallback(async (el: HTMLVideoElement | null, stream: MediaStream | undefined | null) => {
      if (el && stream) {
        if(el.srcObject !== stream) {
          el.srcObject = stream;
        }
        if (typeof (el as any).setSinkId === 'function') {
            try {
                await (el as any).setSinkId(selectedAudioOutput);
            } catch (err) {
                 console.warn("Error setting audio output:", err)
            }
        }
      } else if (el) {
        el.srcObject = null;
      }
    }, [selectedAudioOutput]);
  
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, videoEl]) => {
      if (id === currentUser?.uid) {
        assignStream(videoEl, isVideoOn ? localStream : null);
      } else {
        assignStream(videoEl, videoStreams[id]);
      }
    });

    if (fullscreenUser && videoRefs.current[fullscreenUser]) {
        const videoEl = videoRefs.current[fullscreenUser];
        if (fullscreenUser === currentUser?.uid) {
             assignStream(videoEl, isVideoOn ? localStream : null);
        } else {
             assignStream(videoEl, videoStreams[fullscreenUser]);
        }
    }
  }, [videoStreams, localStream, isVideoOn, currentUser?.uid, fullscreenUser, assignStream]);

  const sortedParticipants = participants.filter(p => p.status === 'approved' && p.isPresent).sort((a, b) => {
    if (a.userId === currentUser?.uid) return -1;
    if (b.userId === currentUser?.uid) return 1;
    const aIsSpeaking = speakingPeers[a.userId];
    const bIsSpeaking = speakingPeers[b.userId];
    if (aIsSpeaking && !bIsSpeaking) return -1;
    if (!aIsSpeaking && bIsSpeaking) return 1;
    return 0;
  });


  if (showPrejoin) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="relative w-48 h-36">
                <video ref={localVideoRef} autoPlay muted playsInline className={cn("w-full h-full bg-black rounded-md object-cover", !prejoinSettings.video && "hidden")} />
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

  const VideoGrid = (
    <div className={cn(
        "grid flex-1 gap-4 mb-4",
        "grid-cols-2 sm:grid-cols-3 md:grid-cols-4",
        fullscreenUser && "hidden"
    )}>
    {sortedParticipants.map(p => {
        const hasVideo = (p.userId === currentUser?.uid && isVideoOn && localStream?.getVideoTracks().length > 0) || (videoStreams[p.userId] && videoStreams[p.userId].getVideoTracks().length > 0);
        
        return (
        <div key={p.userId} className={cn(
            "relative group flex flex-col items-center rounded-lg border text-center transition-all aspect-square justify-center overflow-hidden bg-card",
            speakingPeers[p.userId] && !hasVideo && "bg-primary/20 border-primary shadow-lg scale-105",
            p.handRaised && "border-yellow-500 border-2"
        )}>
             {hasVideo ? (
                <video
                    id={`video-${p.userId}`}
                    ref={el => videoRefs.current[p.userId] = el}
                    autoPlay 
                    playsInline
                    muted={p.userId === currentUser?.uid || !isSpeakerOn} 
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
                        <span className="absolute top-1 left-1"><Hand className="h-5 w-5 text-yellow-500 bg-black/50 rounded-full p-1" /></span>
                    </TooltipTrigger>
                    <TooltipContent>Wants to speak</TooltipContent>
                </Tooltip>
            )}
            
            <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                {hasVideo && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button size="sm" variant="secondary" className="h-7 w-7 p-0" onClick={() => setFullscreenUser(p.userId)}>
                                <Expand className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Fullscreen</TooltipContent>
                    </Tooltip>
                )}
                {isHost && p.userId !== currentUser?.uid && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                             <Button size="sm" variant="secondary" className="h-7 w-7 p-0" onClick={() => handleHostMute(p.userId, !p.isMuted)}>
                                {p.isMuted ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4"/>}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{p.isMuted ? 'Unmute User' : 'Mute User'}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        </div>
    )})}
   </div>
  );

  return (
    <TooltipProvider>
    <div className={cn("w-full h-full flex flex-col group/container", fullscreenUser && "bg-black")}>
       {VideoGrid}

        {fullscreenUser && (
            <div className="flex-1 relative mb-4">
                 <video 
                    id={`video-${fullscreenUser}`}
                    ref={el => videoRefs.current[fullscreenUser] = el}
                    autoPlay
                    playsInline
                    muted={fullscreenUser === currentUser?.uid || !isSpeakerOn}
                    className="w-full h-full object-contain"
                />
                 <div className="absolute top-4 right-4 z-20 opacity-0 group-hover/container:opacity-100 transition-opacity">
                    <Button size="icon" variant="secondary" onClick={() => setFullscreenUser(null)}>
                        <Shrink className="h-5 w-5" />
                    </Button>
                 </div>
            </div>
        )}
       
       <div className="mt-auto flex items-center justify-center flex-wrap gap-2 md:gap-4 pt-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={toggleSelfMute} variant={isActuallyMuted ? 'destructive' : 'secondary'} size="lg" className="rounded-full h-14 w-14" disabled={!isHost && (myParticipantInfo?.isMuted ?? false)}>
                    {isActuallyMuted ? <MicOff /> : <Mic />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isActuallyMuted ? (myParticipantInfo?.isMuted && !isHost ? 'Muted by Host' : 'Muted') : 'Unmute'}</TooltipContent>
          </Tooltip>
          
          <Tooltip>
             <TooltipTrigger asChild>
                <Button onClick={toggleVideo} variant={isVideoOn ? "default" : "secondary"} size="lg" className="rounded-full h-14 w-14">
                    {isVideoOn ? <VideoOff /> : <Video />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isVideoOn ? 'Stop Video' : 'Start Video'}</TooltipContent>
          </Tooltip>

          <Popover>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button variant="secondary" size="lg" className="rounded-full h-14 w-14">
                            {isSpeakerOn ? <Volume2 /> : <VolumeX />}
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Speaker Settings</TooltipContent>
            </Tooltip>
            <PopoverContent>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="speaker-mute">Speaker</Label>
                        <Switch id="speaker-mute" checked={isSpeakerOn} onCheckedChange={setIsSpeakerOn} />
                    </div>
                    {audioOutputDevices.length > 0 && (
                         <div className="space-y-2">
                            <Label htmlFor="audio-output">Output Device</Label>
                            <Select value={selectedAudioOutput} onValueChange={setSelectedAudioOutput}>
                                <SelectTrigger id="audio-output">
                                    <SelectValue placeholder="Select output device" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    {audioOutputDevices.map(device => (
                                        <SelectItem key={device.deviceId} value={device.deviceId}>{device.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </PopoverContent>
          </Popover>

           {!isHost && (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={handleHandRaise} variant={myParticipantInfo?.handRaised ? "default" : "secondary"} size="lg" className="rounded-full h-14 w-14">
                        <Hand />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{myParticipantInfo?.handRaised ? 'Lower Hand' : 'Raise Hand'}</TooltipContent>
            </Tooltip>
           )}

            <Tooltip>
             <TooltipTrigger asChild>
                <Button onClick={handleLeave} variant="destructive" size="lg" className="rounded-full h-14 w-14">
                    <PhoneOff />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Leave Call</TooltipContent>
          </Tooltip>
         
             <Popover>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="secondary" size="lg" className="rounded-full h-14 w-14">
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
                        <Button onClick={() => handleBulkMute(true)} variant="secondary" size="lg" className="rounded-full h-14 w-14"><Volume1 /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Mute All</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={() => handleBulkMute(false)} variant="secondary" size="lg" className="rounded-full h-14 w-14"><Volume /></Button>
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
