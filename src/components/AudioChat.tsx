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
import { Mic, MicOff, PhoneOff, Phone, Rss, Volume2, VolumeX, ScreenShare, ScreenShareOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

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
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [screenSharerId, setScreenSharerId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer.Instance>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Record<string, Peer.Instance>>({});

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

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
    localScreenStream?.getTracks().forEach(track => track.stop());
    setLocalStream(null);
    setLocalScreenStream(null);
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    setPeers({});
    setIsConnected(false);
    toast({ title: "Audio Disconnected" });
  }, [chatRoomId, currentUser, localStream, localScreenStream]);
  
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
          const signalType = signal.renegotiate ? 'renegotiate' : (signal.sdp ? (signal.sdp.type === 'offer' ? 'offer' : 'answer') : 'candidate');
          sendSignal(chatRoomId, currentUser.uid, peerId, { ...signal, type: signalType });
      }
    });

    peer.on('stream', (remoteStream) => {
        // A simple way to differentiate: audio streams have audio but no video tracks.
        if (remoteStream.getVideoTracks().length > 0) {
            setRemoteScreenStream(remoteStream);
            const sharer = participants.find(p => remoteStream.id.includes(p.userId));
            if (sharer) setScreenSharerId(sharer.userId);
        } else {
             if (audioRefs.current[peerId]) {
                audioRefs.current[peerId].srcObject = remoteStream;
                audioRefs.current[peerId].muted = !isSpeakerOn;
                audioRefs.current[peerId].play().catch(e => console.error("Audio play failed", e));
            }
        }
    });
    
     peer.on('close', () => {
        console.log(`Connection closed with ${peerId}`);
        if(peerId === screenSharerId) {
            setRemoteScreenStream(null);
            setScreenSharerId(null);
        }
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
  }, [chatRoomId, currentUser, isSpeakerOn, participants, screenSharerId]);


  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;

    const unsubscribe = listenForSignals(chatRoomId, currentUser.uid, (senderId, signal) => {
        let peer = peersRef.current[senderId];
        if (!peer) {
            const shouldInitiate = currentUser.uid < senderId;
            if (shouldInitiate) return; 
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
            const newPeer = createPeer(p.userId, true, localStream);
            setPeers(prev => ({...prev, [p.userId]: newPeer}));
        }
    });

    const approvedParticipantIds = new Set(approvedParticipants.map(p => p.userId));
    Object.keys(peersRef.current).forEach(peerId => {
      if (!approvedParticipantIds.has(peerId)) {
        peersRef.current[peerId].destroy();
        setPeers(prev => {
          const newPeers = { ...prev };
          delete newPeers[peerId];
          return newPeers;
        });
      }
    });

  }, [participants, isConnected, localStream, currentUser, createPeer]);

  useEffect(() => {
    if (remoteScreenStream && videoRef.current) {
        videoRef.current.srcObject = remoteScreenStream;
    }
  }, [remoteScreenStream]);

  const toggleScreenShare = async () => {
    if (localScreenStream) {
        localScreenStream.getTracks().forEach(track => track.stop());
        Object.values(peersRef.current).forEach(peer => {
            if (peer.streams.includes(localScreenStream)) {
                peer.removeStream(localScreenStream);
            }
        });
        setLocalScreenStream(null);
        setScreenSharerId(null);
        toast({ title: 'Screen sharing stopped' });
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                toggleScreenShare(); // Stop sharing if user uses browser's stop button
            });
            Object.values(peersRef.current).forEach(peer => {
                peer.addStream(stream);
            });
            setLocalScreenStream(stream);
            if (currentUser) setScreenSharerId(currentUser.uid);
            toast({ title: 'You are now sharing your screen' });
        } catch (err) {
            console.error('Screen share error:', err);
            toast({ variant: 'destructive', title: 'Could not start screen share' });
        }
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
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
    <div className="w-full h-full flex flex-col">
       {remoteScreenStream || localScreenStream ? (
           <div className="mb-4 aspect-video bg-black rounded-lg relative">
              <video ref={videoRef} className="w-full h-full rounded-lg" autoPlay playsInline />
               <Badge className="absolute bottom-2 right-2">
                 {screenSharerId === currentUser?.uid ? 'You are sharing your screen' : `${participants.find(p => p.userId === screenSharerId)?.displayName || 'Someone'} is sharing their screen`}
               </Badge>
           </div>
       ) : null}
       <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4", (remoteScreenStream || localScreenStream) && "hidden")}>
        {participants.filter(p => p.status === 'approved').map(p => (
            <div key={p.userId} className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all",
                speakingPeers[p.userId] && "bg-primary/20 border-primary shadow-lg scale-105"
            )}>
                 <Avatar className="h-16 w-16">
                    <AvatarImage src={p.photoURL} alt={p.displayName}/>
                    <AvatarFallback>{getInitials(p.displayName)}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate w-full">{p.displayName}</p>
                {p.userId === currentUser?.uid && <Badge variant="outline">You</Badge>}
            </div>
        ))}
       </div>
       
       <div className="mt-auto flex items-center justify-center space-x-2 sm:space-x-4 pt-4 border-t">
          <Button onClick={toggleMute} variant={isMuted ? 'destructive' : 'outline'} size="lg" className="rounded-full h-14 w-14">
            {isMuted ? <MicOff /> : <Mic />}
          </Button>
           <Button onClick={toggleScreenShare} variant={localScreenStream ? 'default' : 'outline'} size="lg" className="rounded-full h-14 w-14">
            {localScreenStream ? <ScreenShareOff /> : <ScreenShare />}
          </Button>
          <Button onClick={handleLeave} variant="destructive" size="lg" className="rounded-full h-14 w-14">
            <PhoneOff />
          </Button>
          <Button onClick={toggleSpeaker} variant="outline" size="lg" className="rounded-full h-14 w-14">
            {isSpeakerOn ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>

      {Object.keys(peers).map(peerId => (
        <audio key={peerId} ref={el => { if (el) audioRefs.current[peerId] = el; }} autoPlay playsInline />
      ))}
    </div>
  );
}
