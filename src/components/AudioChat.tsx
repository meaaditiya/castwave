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
import { Mic, MicOff, PhoneOff, Phone, Rss, Volume2, VolumeX, Hand, Volume, Volume1, ScreenShare, Share, StopCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant, updateParticipantMuteStatus, updateParticipantHandRaiseStatus } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

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

export function AudioChat({ chatRoomId, isHost, participants }: AudioChatProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer.Instance>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isSelfMuted, setIsSelfMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const [myParticipantInfo, setMyParticipantInfo] = useState<Participant | null>(null);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    if (currentUser) {
        const me = participants.find(p => p.userId === currentUser.uid);
        setMyParticipantInfo(me || null);
    }
  }, [participants, currentUser]);

  const handleJoin = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setLocalStream(stream);
      setIsConnected(true);
      toast({ title: "Audio Connected!", description: "You have joined the voice chat." });
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
    setIsConnected(false);
    toast({ title: "Audio Disconnected" });
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
      if (audioRefs.current[peerId]) {
        audioRefs.current[peerId].srcObject = remoteStream;
        audioRefs.current[peerId].muted = !isSpeakerOn;
        audioRefs.current[peerId].play().catch(e => console.error("Audio play failed", e));
      }
      
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
        setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[peerId];
            return newPeers;
        });
    });

    peer.on('error', (err) => {
      console.error(`Error with peer ${peerId}:`, err);
       setPeers(prev => {
            const newPeers = { ...prev };
            delete newPeers[peerId];
            return newPeers;
        });
    });

    return peer;
  }, [chatRoomId, currentUser, isSpeakerOn]);


  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;

    const unsubscribe = listenForSignals(chatRoomId, currentUser.uid, (senderId, signal) => {
        let peer = peersRef.current[senderId];
        if (!peer) {
            const shouldInitiate = currentUser.uid < senderId;
            // if we should not initiate, it means the other peer is initiating, so we set initiator to false
            peer = createPeer(senderId, false, localStream);
            setPeers(prev => ({ ...prev, [senderId]: peer }));
        }
        try {
          peer.signal(signal);
        } catch(err) {
            console.error("Error signaling peer", err);
        }
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
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[peerId];
          return newPeers;
        });
      }
    });

  }, [participants, isConnected, localStream, currentUser, createPeer]);
  
  // This effect synchronizes the local audio track's enabled state with the mute states
  useEffect(() => {
    if (localStream) {
        const isHostMuted = myParticipantInfo?.isMuted ?? false;
        const finalMuteState = isHostMuted || isSelfMuted;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !finalMuteState;
        });
    }
  }, [isSelfMuted, myParticipantInfo, localStream]);


  const toggleSelfMute = () => {
    // A user can always mute themselves. They can only unmute if not muted by host.
    if (!myParticipantInfo?.isMuted) {
       setIsSelfMuted(prev => !prev);
    } else {
        setIsSelfMuted(true); // Ensure self-mute is on if host-muted
    }
  };

  const toggleSpeaker = () => {
    const newSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(newSpeakerState);
    Object.values(audioRefs.current).forEach(audioEl => {
        if (audioEl) {
            audioEl.muted = !newSpeakerState;
        }
    });
  };

  const handleHostMute = async (participantId: string, shouldMute: boolean) => {
    if (!isHost) return;
    try {
        await updateParticipantMuteStatus(chatRoomId, participantId, shouldMute);
    } catch(e) {
        toast({variant: 'destructive', title: 'Error', description: 'Could not update mute status.'})
    }
  }

  const handleBulkMute = async (shouldMute: boolean) => {
    if (!isHost) return;
    try {
        const participantIds = participants.filter(p => p.userId !== currentUser?.uid && p.status === 'approved').map(p => p.userId);
        await Promise.all(participantIds.map(id => updateParticipantMuteStatus(chatRoomId, id, shouldMute)));
        toast({title: `All participants have been ${shouldMute ? 'muted' : 'unmuted'}.`})
    } catch(e) {
         toast({variant: 'destructive', title: 'Error', description: 'Could not perform bulk mute/unmute.'})
    }
  }
  
  const handleHandRaise = async () => {
    if (!currentUser) return;
    const newHandRaiseState = !myParticipantInfo?.handRaised;
    await updateParticipantHandRaiseStatus(chatRoomId, currentUser.uid, newHandRaiseState);
  }

  const isActuallyMuted = isSelfMuted || (myParticipantInfo?.isMuted ?? false);

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
        {participants.filter(p => p.status === 'approved').map(p => (
            <div key={p.userId} className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all",
                speakingPeers[p.userId] && "bg-primary/20 border-primary shadow-lg scale-105",
                p.handRaised && "border-yellow-500 border-2"
            )}>
                {p.handRaised && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="absolute top-1 right-1"><Hand className="h-5 w-5 text-yellow-500" /></span>
                        </TooltipTrigger>
                        <TooltipContent>Wants to speak</TooltipContent>
                    </Tooltip>
                )}
                <Avatar className="h-16 w-16">
                    <AvatarImage src={p.photoURL} alt={p.displayName}/>
                    <AvatarFallback>{getInitials(p.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-1">
                    {(p.userId === currentUser?.uid ? isActuallyMuted : p.isMuted) && <MicOff className="h-4 w-4 text-destructive" />}
                    <p className="font-semibold text-sm truncate w-full">{p.displayName}</p>
                </div>
                {p.userId === currentUser?.uid && <Badge variant="outline">You</Badge>}
                {isHost && p.userId !== currentUser?.uid && (
                     <Tooltip>
                        <TooltipTrigger asChild>
                             <Button size="sm" variant="outline" className="mt-1" onClick={() => handleHostMute(p.userId, !p.isMuted)}>
                                {p.isMuted ? <Volume2 /> : <MicOff />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{p.isMuted ? 'Unmute User' : 'Mute User'}</TooltipContent>
                    </Tooltip>
                )}
            </div>
        ))}
       </div>
       
       <div className="mt-auto flex items-center justify-center space-x-2 md:space-x-4 pt-4 border-t">
          <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={toggleSelfMute} variant={isActuallyMuted ? 'destructive' : 'outline'} size="lg" className="rounded-full h-14 w-14" disabled={myParticipantInfo?.isMuted && !isHost}>
                    {isActuallyMuted ? <MicOff /> : <Mic />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isActuallyMuted ? 'Muted' : 'Mute'}</TooltipContent>
          </Tooltip>

          <Tooltip>
             <TooltipTrigger asChild>
                <Button onClick={handleLeave} variant="destructive" size="lg" className="rounded-full h-14 w-14">
                    <PhoneOff />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Leave Call</TooltipContent>
          </Tooltip>
         
          <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={toggleSpeaker} variant="outline" size="lg" className="rounded-full h-14 w-14">
                    {isSpeakerOn ? <Volume2 /> : <VolumeX />}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{isSpeakerOn ? 'Speakers On' : 'Speakers Off'}</TooltipContent>
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

      {Object.keys(peers).map(peerId => (
        <audio key={peerId} ref={el => { if (el) audioRefs.current[peerId] = el; }} autoPlay playsInline />
      ))}
    </div>
    </TooltipProvider>
  );
}
