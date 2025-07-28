
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
    writeBatch,
    getDocs,
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

type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected';

export const useWebRTC = (
    chatRoomId: string,
    currentUserId: string | null,
    isCurrentUserSpeaker: boolean,
    speakers: Participant[]
) => {
    const { toast } = useToast();
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Record<string, Peer.Instance>>({});
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});

    const cleanup = useCallback(async () => {
        console.log(`[WebRTC] Cleanup initiated for user ${currentUserId}`);
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        Object.values(peersRef.current).forEach(peer => {
            if (peer && !peer.destroyed) {
                peer.destroy();
            }
        });
        peersRef.current = {};
        setRemoteStreams({});
        setConnectionStatus({});

        if (chatRoomId && currentUserId) {
            const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
            const q = query(signalsRef, where('sender', '==', currentUserId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
    }, [chatRoomId, currentUserId]);

    const getLocalStream = useCallback(async () => {
        if (!isCurrentUserSpeaker) {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            return null;
        }
        if (localStreamRef.current) return localStreamRef.current;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Access Required', description: 'Please allow microphone access to speak.' });
            console.error('[WebRTC] getUserMedia error:', err);
            return null;
        }
    }, [isCurrentUserSpeaker, toast]);

    const createPeer = useCallback((peerUserId: string, initiator: boolean, stream: MediaStream) => {
        if (!currentUserId || peersRef.current[peerUserId]) return;

        console.log(`[WebRTC] Creating Peer for ${peerUserId}. Initiator: ${initiator}`);
        setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connecting' }));

        const peer = new Peer({ initiator, trickle: true, config: servers, stream });

        peer.on('signal', async (data) => {
            await addDoc(collection(db, 'chatRooms', chatRoomId, 'webrtc_signals'), {
                signal: JSON.stringify(data),
                sender: currentUserId,
                target: peerUserId,
            });
        });

        peer.on('stream', (remoteStream) => {
            console.log(`[WebRTC] Received remote stream from ${peerUserId}`);
            setRemoteStreams(prev => ({ ...prev, [peerUserId]: remoteStream }));
        });

        peer.on('connect', () => {
            console.log(`[WebRTC] CONNECTED to ${peerUserId}`);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connected' }));
        });

        peer.on('error', (err) => {
            console.error(`[WebRTC] Peer error with ${peerUserId}:`, err);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'failed' }));
            peersRef.current[peerUserId]?.destroy();
            delete peersRef.current[peerUserId];
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
            delete peersRef.current[peerUserId];
        });

        peersRef.current[peerUserId] = peer;
    }, [chatRoomId, currentUserId]);

    // Effect for handling connections based on speaker list
    useEffect(() => {
        if (!currentUserId) return;

        getLocalStream().then(stream => {
            if (isCurrentUserSpeaker && stream) {
                const otherSpeakers = speakers.filter(s => s.userId !== currentUserId && s.status === 'speaker');
                otherSpeakers.forEach(speaker => {
                    if (currentUserId < speaker.userId) { // Initiate connection
                        createPeer(speaker.userId, true, stream);
                    }
                });
            }

            // Cleanup connections for users who are no longer speakers
            Object.keys(peersRef.current).forEach(peerId => {
                if (!speakers.some(s => s.userId === peerId)) {
                    peersRef.current[peerId]?.destroy();
                    delete peersRef.current[peerId];
                }
            });
        });

    }, [currentUserId, speakers, isCurrentUserSpeaker, getLocalStream, createPeer]);

    // Effect for handling Firestore signaling
    useEffect(() => {
        if (!currentUserId || !chatRoomId) return;

        const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
        const q = query(signalsRef, where('target', '==', currentUserId));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                if (change.type === 'added') {
                    const signalData = change.doc.data();
                    const senderId = signalData.sender;
                    const signal = JSON.parse(signalData.signal);

                    if (signal.type === 'offer') {
                        const stream = await getLocalStream();
                        if (stream) {
                            createPeer(senderId, false, stream);
                        }
                    }

                    const peer = peersRef.current[senderId];
                    if (peer && !peer.destroyed) {
                        peer.signal(signal);
                    }
                    
                    await deleteDoc(change.doc.ref);
                }
            }
        });

        return () => unsubscribe();
    }, [chatRoomId, currentUserId, getLocalStream, createPeer]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        }
    }, [cleanup]);

    return { remoteStreams, connectionStatus };
};
