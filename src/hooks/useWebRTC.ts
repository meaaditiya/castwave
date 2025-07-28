
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from './use-toast';
import {
    collection,
    doc,
    onSnapshot,
    addDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Peer from 'simple-peer';

// Public STUN servers
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

// This hook manages a simplified WebRTC connection.
// In this version:
// - A user designated as a "speaker" will initiate the call and broadcast their audio.
// - Other users ("listeners") will receive the audio.
// - Signaling is done via a "webrtc_signals" collection in Firestore.
export const useWebRTC = (chatRoomId: string, userId: string | null, isSpeaker: boolean) => {
    const { toast } = useToast();
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);

    // Function to clean up peer connection and streams
    const cleanup = useCallback(async () => {
        console.log('Cleaning up WebRTC connection...');
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        setRemoteStream(null);
        // Clear any leftover signaling documents for this user
        if (userId) {
             const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
             const q = query(signalsRef, where('target', '==', userId));
             const snapshot = await getDocs(q);
             const batch = writeBatch(db);
             snapshot.docs.forEach(d => batch.delete(d.ref));
             await batch.commit();
        }

    }, [chatRoomId, userId]);


    useEffect(() => {
        if (!chatRoomId || !userId) return;

        const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');

        const initialize = async () => {
            if (isSpeaker) {
                 // Speaker logic: get mic and create offer
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    localStreamRef.current = stream;

                    const peer = new Peer({
                        initiator: true,
                        trickle: false, // Simplifies signaling by sending all ICE candidates at once
                        config: servers,
                        stream: stream,
                    });
                    peerRef.current = peer;

                    peer.on('signal', async (data) => {
                        // Create an offer for any listener that joins
                        await addDoc(signalsRef, {
                            type: 'offer',
                            signal: JSON.stringify(data),
                            sender: userId,
                            target: 'listener', // Generic target for any listener
                        });
                    });

                    peer.on('stream', (stream) => {
                        // Speakers don't need to handle incoming streams in this model
                    });

                    peer.on('close', cleanup);
                    peer.on('error', (err) => {
                        console.error('WebRTC Peer Error (Speaker):', err);
                        toast({ variant: 'destructive', title: 'Audio Connection Error' });
                        cleanup();
                    });

                } catch (err) {
                    console.error('Failed to get user media', err);
                    toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to speak.' });
                }
            } else {
                // Listener logic: wait for an offer
                const unsubscribe = onSnapshot(query(signalsRef, where('type', '==', 'offer')), (snapshot) => {
                    if (!snapshot.empty && !peerRef.current) {
                        const offerDoc = snapshot.docs[0];
                        const { signal, sender } = offerDoc.data();
                        
                        const peer = new Peer({
                            initiator: false,
                            trickle: false,
                            config: servers,
                        });
                        peerRef.current = peer;

                        peer.on('signal', async (data) => {
                             // Send answer back to the specific speaker
                            await addDoc(signalsRef, {
                                type: 'answer',
                                signal: JSON.stringify(data),
                                sender: userId,
                                target: sender, // Target the specific speaker
                            });
                        });
                        
                        peer.on('stream', (stream) => {
                            setRemoteStream(stream);
                        });

                        peer.on('close', cleanup);
                        peer.on('error', (err) => {
                            console.error('WebRTC Peer Error (Listener):', err);
                            cleanup();
                        });
                        
                        // Accept the offer
                        peer.signal(JSON.parse(signal));
                    }
                });
                return unsubscribe;
            }
        };

        initialize();

        // Listen for the answer if we are a speaker
        let unsubscribeAnswer: (() => void) | undefined;
        if (isSpeaker) {
            unsubscribeAnswer = onSnapshot(query(signalsRef, where('type', '==', 'answer'), where('target', '==', userId)), (snapshot) => {
                if (!snapshot.empty) {
                    snapshot.docs.forEach(async docSnap => {
                         if (peerRef.current && !peerRef.current.destroyed) {
                             const { signal } = docSnap.data();
                             peerRef.current.signal(JSON.parse(signal));
                             // Clean up the answer doc after processing
                             await deleteDoc(docSnap.ref);
                         }
                    })
                }
            });
        }

        return () => {
            if (unsubscribeAnswer) unsubscribeAnswer();
            cleanup();
        };

    }, [chatRoomId, userId, isSpeaker, toast, cleanup]);

    return { remoteStream };
};
