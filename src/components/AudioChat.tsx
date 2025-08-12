
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
import { Mic, MicOff, PhoneOff, Phone, Rss } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from './ui/badge';

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
  const [isMuted, setIsMuted] = useState(false);
  const [speakingPeers, setSpeakingPeers] = useState<Record<string, boolean>>({});
  
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const peersRef = useRef<Record<string, Peer.Instance>>({});

  useEffect(() => {
    // Update the ref whenever the state changes
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
    setLocalStream(null);
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    setPeers({});
    setIsConnected(false);
    toast({ title: "Audio Disconnected" });
  }, [chatRoomId, currentUser, localStream]);
  
  useEffect(() => {
    return () => {
      // Ensure cleanup runs on component unmount
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
  }, [chatRoomId, currentUser]);


  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;

    // Listen for signals from other peers
    const unsubscribe = listenForSignals(chatRoomId, currentUser.uid, (senderId, signal) => {
        let peer = peersRef.current[senderId];
        if (!peer) {
            // This is a new connection from another peer
            peer = createPeer(senderId, false, localStream);
            setPeers(prev => ({ ...prev, [senderId]: peer }));
        }
        peer.signal(signal);
    });

    return () => unsubscribe();

  }, [isConnected, localStream, currentUser, chatRoomId, createPeer]);
  
  useEffect(() => {
    if (!isConnected || !localStream || !currentUser) return;
    
    // Call new participants joining the room
    const approvedParticipants = participants.filter(p => p.status === 'approved' && p.userId !== currentUser.uid);
    
    approvedParticipants.forEach(p => {
        if (!peersRef.current[p.userId]) {
            console.log(`Attempting to initiate call with ${p.displayName}`);
            const newPeer = createPeer(p.userId, true, localStream);
            setPeers(prev => ({...prev, [p.userId]: newPeer}));
        }
    });

    // Clean up connections for participants who have left
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


  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  const connectedParticipants = participants.filter(p => p.status === 'approved' && (peers[p.userId] || p.userId === currentUser?.uid));

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
       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
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
       
       <div className="mt-auto flex items-center justify-center space-x-4 pt-4 border-t">
          <Button onClick={toggleMute} variant={isMuted ? 'destructive' : 'outline'} size="lg" className="rounded-full h-14 w-14">
            {isMuted ? <MicOff /> : <Mic />}
          </Button>
          <Button onClick={handleLeave} variant="destructive" size="lg" className="rounded-full h-14 w-14">
            <PhoneOff />
          </Button>
        </div>

      {/* Hidden audio elements for remote streams */}
      {Object.keys(peers).map(peerId => (
        <audio key={peerId} ref={el => { if (el) audioRefs.current[peerId] = el; }} autoPlay playsInline />
      ))}
    </div>
  );
}
