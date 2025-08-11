
"use client";

import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { useAuth } from '@/context/AuthContext';
import { createOffer, listenForAnswers, clearSignals } from '@/services/webrtcService';
import { Button } from './ui/button';
import { PhoneOff, Mic, MicOff, MonitorUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

interface WebRTCStreamerProps {
  chatRoomId: string;
  onStreamEnd: () => void;
}

export function WebRTCStreamer({ chatRoomId, onStreamEnd }: WebRTCStreamerProps) {
  const { currentUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const peersRef = useRef<Record<string, Peer.Instance>>({});
  const { toast } = useToast();

  useEffect(() => {
    const startStream = async () => {
      if (!currentUser) return;
      
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        
        // Use a separate audio stream from the microphone for better quality
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        const combinedStream = new MediaStream([
          ...screenStream.getVideoTracks(),
          ...audioStream.getAudioTracks(),
        ]);

        setStream(combinedStream);
        if (videoRef.current) {
          videoRef.current.srcObject = combinedStream;
        }

        const peer = new Peer({ initiator: true, trickle: false, stream: combinedStream });

        peer.on('signal', async (offerSignal) => {
            await createOffer(chatRoomId, currentUser.uid, offerSignal);
        });

        listenForAnswers(chatRoomId, currentUser.uid, (answer) => {
            // Since we are the initiator, we just need to signal the answer
            peer.signal(answer.signal);
        });

        peersRef.current[currentUser.uid] = peer; // Store our own peer instance

      } catch (err) {
        console.error("Error starting stream:", err);
        toast({ variant: 'destructive', title: 'Stream Error', description: 'Could not start screen sharing.' });
        onStreamEnd();
      }
    };

    startStream();

    // Cleanup on component unmount
    return () => {
      handleStopStreaming();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatRoomId, currentUser]);


  const handleStopStreaming = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    if (currentUser) {
        clearSignals(chatRoomId, currentUser.uid);
    }
    onStreamEnd();
  };

  const toggleMute = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  if (!stream) {
    return (
        <Card className="border-dashed text-center">
             <CardHeader>
                <div className="flex justify-center mb-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <CardTitle>Starting Stream...</CardTitle>
                <CardDescription>
                    Please select a screen or window to share.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-2 relative">
      <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-md border bg-black"></video>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        <Button onClick={toggleMute} variant={isMuted ? "destructive" : "secondary"} size="icon" className="rounded-full">
          {isMuted ? <MicOff /> : <Mic />}
        </Button>
        <Button onClick={handleStopStreaming} variant="destructive" size="icon" className="rounded-full">
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
}
