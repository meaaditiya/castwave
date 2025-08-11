
"use client";

import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { useAuth } from '@/context/AuthContext';
import { listenForOffers, createAnswer, clearSignals } from '@/services/webrtcService';
import { Participant } from '@/services/chatRoomService';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MonitorUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';


interface WebRTCViewerProps {
  chatRoomId: string;
  participants: Participant[];
}

export function WebRTCViewer({ chatRoomId, participants }: WebRTCViewerProps) {
  const { currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  
  const hostProfile = hostId ? participants.find(p => p.userId === hostId) : null;

  useEffect(() => {
    if (!currentUser) return;
    
    const unsubscribe = listenForOffers(chatRoomId, (offer) => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }

      setHostId(offer.userId);
      
      const peer = new Peer({
        initiator: false,
        trickle: false,
      });

      peer.on('signal', (data) => {
        createAnswer(chatRoomId, offer.userId, currentUser.uid, data);
      });

      peer.on('stream', (remoteStream) => {
        setStream(remoteStream);
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      });
      
      peer.on('close', () => {
        setStream(null);
        setHostId(null);
        peerRef.current = null;
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setStream(null);
        setHostId(null);
      });

      peer.signal(offer.signal);
      peerRef.current = peer;
    });

    return () => {
      unsubscribe();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (hostId) {
          clearSignals(chatRoomId, hostId);
      }
    };
  }, [chatRoomId, currentUser, hostId]);

  if (!stream) {
    // If there's no stream, we just render nothing so the main UI can show.
    return null;
  }

  const getInitials = (name: string) => {
    if (!name) return "..";
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }


  return (
    <div className="space-y-2 relative animate-in fade-in-50">
        <video ref={videoRef} autoPlay playsInline className="w-full rounded-md border bg-black"></video>
         {hostProfile && (
             <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 text-white p-2 rounded-lg">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={hostProfile.photoURL} alt={hostProfile.displayName} />
                    <AvatarFallback>{getInitials(hostProfile.displayName)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-bold">
                    {hostProfile.displayName} is sharing their screen
                </p>
            </div>
         )}
    </div>
  );
}

