
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
import type { Participant } from '@/services/chatRoomService';

const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected' | 'new';

export const useWebRTC = (
    chatRoomId: string,
    currentUserId: string | null,
    isCurrentUserSpeaker: boolean,
    speakers: Participant[]
) => {
    const { toast } = useToast();
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});
    const peersRef = useRef<Record<string, Peer.Instance>>({});
    const localStreamRef = useRef<MediaStream | null>(null);

    // 1. Cleanup Function: Destroys all peers and stops media tracks.
    const cleanup = useCallback(async () => {
        console.log(`[WebRTC] Cleaning up connections for user: ${currentUserId}`);
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        Object.entries(peersRef.current).forEach(([peerId, peer]) => {
            if (peer && !peer.destroyed) {
                peer.destroy();
            }
        });
        peersRef.current = {};
        setRemoteStreams({});
        setConnectionStatus({});

        // Clean up signals from Firestore for the current user
        if (chatRoomId && currentUserId) {
            try {
                const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
                const q = query(signalsRef, where('sender', '==', currentUserId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`[WebRTC] Cleaned up signals for ${currentUserId}`);
                }
            } catch (error) {
                console.error("[WebRTC] Error during signal cleanup:", error);
            }
        }
    }, [chatRoomId, currentUserId]);


    const getLocalStream = useCallback(async () => {
        if (!isCurrentUserSpeaker) {
            if (localStreamRef.current) {
                console.log("[WebRTC] Not a speaker, stopping local stream.");
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            return null;
        }

        if (localStreamRef.current) {
            return localStreamRef.current;
        }
        
        console.log("[WebRTC] Is a speaker, initializing local stream.");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to participate.' });
            console.error('[WebRTC] getUserMedia error:', err);
            return null;
        }
    }, [isCurrentUserSpeaker, toast]);

    const createPeer = useCallback((peerUserId: string, initiator: boolean, stream: MediaStream) => {
        if (!currentUserId) return;
        // Prevent creating a peer if one already exists and is not destroyed
        if (peersRef.current[peerUserId] && !peersRef.current[peerUserId].destroyed) {
            console.log(`[WebRTC] Peer already exists for ${peerUserId}. Aborting creation.`);
            return;
        }
        
        console.log(`[WebRTC] Creating Peer. MyID: ${currentUserId} -> PeerID: ${peerUserId}. Initiator: ${initiator}`);
        setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connecting' }));
        
        const peer = new Peer({
            initiator,
            trickle: true,
            config: servers,
            stream: stream,
        });

        peer.on('signal', async (data) => {
            try {
                await addDoc(collection(db, 'chatRooms', chatRoomId, 'webrtc_signals'), {
                    signal: JSON.stringify(data),
                    sender: currentUserId,
                    target: peerUserId,
                });
            } catch (error) {
                console.error(`[WebRTC] Failed to send signal to ${peerUserId}:`, error);
            }
        });

        peer.on('stream', (stream) => {
            console.log('[WebRTC] Received remote stream from:', peerUserId);
            setRemoteStreams(prev => ({ ...prev, [peerUserId]: stream }));
        });

        peer.on('connect', () => {
            console.log('[WebRTC] CONNECTED to:', peerUserId);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connected' }));
        });
        
        peer.on('error', (err) => {
            console.error(`[WebRTC] Peer error with ${peerUserId}:`, err);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'failed' }));
            // Clean up on error
             if (peersRef.current[peerUserId]) {
                peersRef.current[peerUserId].destroy();
                delete peersRef.current[peerUserId];
            }
        });
        
        peer.on('close', () => {
            console.log(`[WebRTC] Connection closed with ${peerUserId}`);
            setConnectionStatus(prev => {
                const newStatus = { ...prev };
                delete newStatus[peerUserId];
                return newStatus;
            });
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[peerUserId];
                return newStreams;
            });
             if (peersRef.current[peerUserId]) {
                delete peersRef.current[peerUserId];
            }
        });

        peersRef.current[peerUserId] = peer;
    }, [chatRoomId, currentUserId]);


    // Manage connections based on speaker list changes
    useEffect(() => {
        if (!currentUserId) return;

        const handleConnections = async () => {
            const stream = await getLocalStream();

            if (isCurrentUserSpeaker && stream) {
                 const otherSpeakers = speakers.filter(s => s.userId !== currentUserId && s.status === 'speaker');

                // Connect to all other speakers
                otherSpeakers.forEach(speaker => {
                    const isInitiator = currentUserId < speaker.userId;
                    createPeer(speaker.userId, isInitiator, stream);
                });
            }

            // Clean up connections to users who are no longer speakers
            Object.keys(peersRef.current).forEach(peerId => {
                if (!speakers.some(s => s.userId === peerId && s.status === 'speaker')) {
                    if (peersRef.current[peerId]) {
                         peersRef.current[peerId].destroy();
                         delete peersRef.current[peerId];
                    }
                }
            });
        };

        handleConnections();

    }, [currentUserId, speakers, isCurrentUserSpeaker, getLocalStream, createPeer]);
    

    // Firestore signaling listener
    useEffect(() => {
        if (!currentUserId || !chatRoomId) return () => {};

        const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
        const q = query(signalsRef, where('target', '==', currentUserId));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const changes = snapshot.docChanges().filter(change => change.type === 'added');

            for (const change of changes) {
                const signalData = change.doc.data();
                const senderId = signalData.sender;
                const signal = JSON.parse(signalData.signal);

                let peer = peersRef.current[senderId];
                
                if (signal.type === 'offer') {
                    // If we get an offer, we must not be the initiator.
                    // If a peer object already exists (e.g., from our own initiation attempt), destroy it to accept the incoming offer.
                    if (peer) {
                        console.warn(`[WebRTC] Received an offer from ${senderId}, but a peer already exists. Destroying old peer to accept offer.`);
                        peer.destroy();
                    }
                    const stream = await getLocalStream();
                    if (stream) {
                         createPeer(senderId, false, stream);
                         peer = peersRef.current[senderId];
                    }
                }
                
                // Only signal if the peer exists and is not yet destroyed.
                if (peer && !peer.destroyed) {
                    peer.signal(signal);
                } else {
                     console.log(`[WebRTC] Received signal from ${senderId}, but peer is not ready or has been destroyed.`);
                }
                
                // We must delete the signal after processing
                await deleteDoc(change.doc.ref);
            }
        });

        return () => unsubscribe();
    }, [chatRoomId, currentUserId, createPeer, getLocalStream]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        }
    }, [cleanup]);

    return { remoteStreams, connectionStatus };
};

    