
"use client";

import { useState, useEffect, useRef } from 'react';
import Peer from 'simple-peer';
import { useAuth } from '@/context/AuthContext';
import {
  initiateCall,
  listenForCalls,
  answerCall,
  listenForAnswers,
  addIceCandidate,
  listenForIceCandidates,
  hangUp,
  listenForHangUps,
} from '@/services/rtcService';
import { Button } from './ui/button';
import { Mic, MicOff, PhoneOff, Phone, Loader2, UserCircle, Rss } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Participant } from '@/services/chatRoomService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

  useEffect(() => {
    // Clean up peers on component unmount
    return () => {
      if (currentUser) {
        hangUp(chatRoomId, currentUser.uid, Object.keys(peers));
      }
      localStream?.getTracks().forEach(track => track.stop());
      Object.values(peers).forEach(peer => peer.destroy());
    };
  }, [localStream, peers, chatRoomId, currentUser]);


  useEffect(() => {
    if (!isConnected || !currentUser) return;
  
    // Listen for new users to call
    const callNewUsers = async () => {
      const approvedParticipants = participants.filter(p => p.status === 'approved' && p.userId !== currentUser.uid);
      for (const p of approvedParticipants) {
        if (!peers[p.userId] && p.userId !== currentUser.uid) {
           console.log(`Attempting to call ${p.displayName} (${p.userId})`);
           createPeer(p.userId, true);
        }
      }
    };
    callNewUsers();

  }, [participants, isConnected, currentUser]);


  useEffect(() => {
    if (!isConnected || !currentUser || !localStream) return;

    // Listen for incoming calls
    const unsubscribeCalls = listenForCalls(chatRoomId, currentUser.uid, async (callerId, offer) => {
      console.log(`Incoming call from ${callerId}`);
      if (!peers[callerId]) {
        const newPeer = createPeer(callerId, false);
        newPeer.signal(offer);
      }
    });

    // Listen for hang-ups
    const unsubscribeHangUps = listenForHangUps(chatRoomId, (peerId) => {
        if (peers[peerId]) {
            console.log(`Peer ${peerId} hung up.`);
            peers[peerId].destroy();
            setPeers(prev => {
                const newPeers = { ...prev };
                delete newPeers[peerId];
                return newPeers;
            });
        }
    });


    return () => {
      unsubscribeCalls();
      unsubscribeHangUps();
    };
  }, [isConnected, currentUser, localStream, peers]);

  const createPeer = (peerId: string, initiator: boolean) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: localStream!,
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        initiateCall(chatRoomId, currentUser!.uid, peerId, data);
      } else if (data.type === 'answer') {
        answerCall(chatRoomId, currentUser!.uid, peerId, data);
      } else if (data.candidate) {
        addIceCandidate(chatRoomId, currentUser!.uid, peerId, data);
      }
    });

    peer.on('stream', (stream) => {
      console.log('Got stream from', peerId);
      if (audioRefs.current[peerId]) {
        audioRefs.current[peerId].srcObject = stream;
      }
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkSpeaking = () => {
          analyser.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          if (sum > 500) { // Threshold may need adjustment
              setSpeakingPeers(prev => ({...prev, [peerId]: true}));
              setTimeout(() => setSpeakingPeers(prev => ({...prev, [peerId]: false})), 500);
          }
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
       toast({ variant: 'destructive', title: "Connection Error", description: `Could not connect to a user.`})
    });
    
    // Listen for the answer from the peer we called
    if (initiator) {
        const unsubAnswer = listenForAnswers(chatRoomId, peerId, (answer) => {
            if (!peer.destroyed) {
                peer.signal(answer);
                unsubAnswer(); // Stop listening after getting the answer
            }
        });
    }

    // Listen for ICE candidates from this specific peer
    const unsubIce = listenForIceCandidates(chatRoomId, peerId, (candidate) => {
       if (!peer.destroyed) {
           peer.signal(candidate);
       } else {
           unsubIce();
       }
    });

    setPeers(prev => ({ ...prev, [peerId]: peer }));
    return peer;
  };

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

  const handleLeave = () => {
    if (currentUser) {
      hangUp(chatRoomId, currentUser.uid, Object.keys(peers));
    }
    localStream?.getTracks().forEach(track => track.stop());
    Object.values(peers).forEach(peer => peer.destroy());
    setLocalStream(null);
    setPeers({});
    setIsConnected(false);
  };

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
        {connectedParticipants.map(p => (
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
