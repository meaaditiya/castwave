
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

    const cleanup = useCallback(async () => {
        console.log('Cleaning up all WebRTC connections...');
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
        Object.values(peersRef.current).forEach(peer => {
            if (!peer.destroyed) {
                peer.destroy();
            }
        });
        peersRef.current = {};
        setRemoteStreams({});
        setConnectionStatus({});

        if (currentUserId) {
            try {
                const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
                const q = query(signalsRef, where('target', '==', currentUserId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            } catch (e) {
                console.error("Error cleaning up signals:", e);
            }
        }
    }, [chatRoomId, currentUserId]);


    const createPeer = useCallback((peerUserId: string, initiator: boolean) => {
        if (!localStreamRef.current || !currentUserId || peersRef.current[peerUserId]) return;

        console.log(`Creating peer connection to ${peerUserId}. Initiator: ${initiator}`);
        setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connecting' }));

        const peer = new Peer({
            initiator,
            trickle: true,
            config: servers,
            stream: localStreamRef.current,
        });

        peer.on('signal', async (data) => {
            const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
            try {
                await addDoc(signalsRef, {
                    signal: JSON.stringify(data),
                    sender: currentUserId,
                    target: peerUserId,
                });
            } catch (error) {
                console.error("Failed to send signal:", error);
            }
        });

        peer.on('stream', (stream) => {
            console.log('Received remote stream from', peerUserId);
            setRemoteStreams(prev => ({ ...prev, [peerUserId]: stream }));
        });

        peer.on('connect', () => {
            console.log('Connected to', peerUserId);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connected' }));
        });

        peer.on('close', () => {
            console.log('Connection closed with', peerUserId);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'disconnected' }));
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[peerUserId];
                return newStreams;
            });
            if (peersRef.current[peerUserId]) {
                delete peersRef.current[peerUserId];
            }
        });

        peer.on('error', (err) => {
            console.error(`Peer error with ${peerUserId}:`, err);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'failed' }));
            if (!peer.destroyed) {
                peer.destroy();
            }
        });

        peersRef.current[peerUserId] = peer;
    }, [chatRoomId, currentUserId]);

    const initializeLocalStream = useCallback(async () => {
        if (localStreamRef.current) return localStreamRef.current;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStreamRef.current = stream;
            if (!isCurrentUserSpeaker) {
                stream.getTracks().forEach(track => track.enabled = false);
            }
            return stream;
        } catch (err) {
            console.error('Failed to get user media', err);
            toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to speak.' });
            return null;
        }
    }, [isCurrentUserSpeaker, toast]);

    useEffect(() => {
        if (!currentUserId) return;

        const initializeConnections = async () => {
            await initializeLocalStream();
            if (!localStreamRef.current) return;

            const speakerIds = speakers.map(s => s.userId);
            
            // Connect to all speakers if you are not one of them
            if (!isCurrentUserSpeaker) {
                speakers.forEach(speaker => {
                    if (speaker.userId !== currentUserId) {
                        // Listeners are not initiators, they wait for offers.
                    }
                });
            } else { // If you are a speaker
                speakers.forEach(speaker => {
                    if (speaker.userId !== currentUserId && !peersRef.current[speaker.userId]) {
                        createPeer(speaker.userId, true); // Speakers initiate connections to other speakers
                    }
                });
            }

            // Cleanup old peer connections that are no longer for current speakers
            Object.keys(peersRef.current).forEach(peerId => {
                if (!speakerIds.includes(peerId)) {
                    if (peersRef.current[peerId] && !peersRef.current[peerId].destroyed) {
                        peersRef.current[peerId].destroy();
                    }
                    delete peersRef.current[peerId];
                }
            });
        };

        initializeConnections();

    }, [currentUserId, isCurrentUserSpeaker, speakers, createPeer, initializeLocalStream]);

    useEffect(() => {
        if (!currentUserId) return;

        const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
        const q = query(signalsRef, where('target', '==', currentUserId));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (!localStreamRef.current) {
                await initializeLocalStream();
            }
            if (!localStreamRef.current) {
                console.error("Cannot process signals without a local stream.");
                return;
            }

            const changes = snapshot.docChanges().filter(change => change.type === 'added');
            if (changes.length === 0) return;

            for (const change of changes) {
                const data = change.doc.data();
                const signal = JSON.parse(data.signal);
                const senderId = data.sender;

                let peer = peersRef.current[senderId];

                // If a peer connection doesn't exist and we receive an offer, create a new peer.
                // This is the case for listeners or speakers who didn't initiate.
                if (signal.type === 'offer' && !peer) {
                    console.log(`Received offer from ${senderId}, creating peer...`);
                    createPeer(senderId, false);
                    peer = peersRef.current[senderId]; // The peer is now created and in the ref
                }
                
                // Signal the peer if it exists and is not destroyed
                if (peer && !peer.destroyed) {
                    peer.signal(signal);
                } else {
                     console.warn(`Could not signal peer ${senderId}. It might have been destroyed.`);
                }
                
                // Delete the signal document after processing to prevent re-processing
                try {
                    await deleteDoc(change.doc.ref);
                } catch (error) {
                    console.error("Failed to delete signal doc:", error);
                }
            }
        }, (error) => {
            console.error("Firestore signal listener error:", error);
        });

        // Main cleanup on component unmount
        return () => {
            unsubscribe();
            cleanup();
        };
    }, [chatRoomId, currentUserId, cleanup, createPeer, initializeLocalStream]);

    return { remoteStreams, connectionStatus };
};
