
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
        console.log(`Cleaning up WebRTC connections for user: ${currentUserId}`);
        
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
                }
            } catch (error) {
                console.error("Error during signal cleanup:", error);
            }
        }
    }, [chatRoomId, currentUserId]);


    // 2. Local Stream Initialization and Management
    const manageLocalStream = useCallback(async () => {
        if (!isCurrentUserSpeaker) {
            if (localStreamRef.current) {
                console.log("Not a speaker, stopping local stream.");
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            return;
        }

        if (isCurrentUserSpeaker && !localStreamRef.current) {
            console.log("Is a speaker, initializing local stream.");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                localStreamRef.current = stream;
            } catch (err) {
                toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to participate.' });
                console.error('getUserMedia error:', err);
            }
        }
    }, [isCurrentUserSpeaker, toast]);

    // 3. Peer Creation Logic
    const createPeer = useCallback((peerUserId: string, initiator: boolean) => {
        if (!currentUserId || !localStreamRef.current) return;
        
        console.log(`Creating Peer. MyID: ${currentUserId} -> PeerID: ${peerUserId}. Initiator: ${initiator}`);
        setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connecting' }));
        
        const peer = new Peer({
            initiator,
            trickle: true,
            config: servers,
            stream: localStreamRef.current,
        });

        peer.on('signal', async (data) => {
            try {
                await addDoc(collection(db, 'chatRooms', chatRoomId, 'webrtc_signals'), {
                    signal: JSON.stringify(data),
                    sender: currentUserId,
                    target: peerUserId,
                });
            } catch (error) {
                console.error(`Failed to send signal to ${peerUserId}:`, error);
            }
        });

        peer.on('stream', (stream) => {
            console.log('Received remote stream from:', peerUserId);
            setRemoteStreams(prev => ({ ...prev, [peerUserId]: stream }));
        });

        peer.on('connect', () => {
            console.log('CONNECTED to:', peerUserId);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connected' }));
        });
        
        peer.on('error', (err) => {
            console.error(`Peer error with ${peerUserId}:`, err);
            setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'failed' }));
        });
        
        peer.on('close', () => {
            console.log(`Connection closed with ${peerUserId}`);
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

    // 4. Main useEffect to manage connections
    useEffect(() => {
        if (!currentUserId) return;

        const handleConnections = async () => {
            await manageLocalStream();

            const otherSpeakers = speakers.filter(s => s.userId !== currentUserId);

            // Connect to all other speakers
            otherSpeakers.forEach(speaker => {
                if (!peersRef.current[speaker.userId] && localStreamRef.current) {
                    // To avoid both peers initiating, the one with the smaller ID initiates
                    const isInitiator = currentUserId < speaker.userId;
                    createPeer(speaker.userId, isInitiator);
                }
            });

            // Clean up connections to users who are no longer speakers
            Object.keys(peersRef.current).forEach(peerId => {
                if (!speakers.some(s => s.userId === peerId)) {
                    if (peersRef.current[peerId]) {
                         peersRef.current[peerId].destroy();
                         delete peersRef.current[peerId];
                    }
                }
            });
        };

        handleConnections();

    }, [currentUserId, speakers, manageLocalStream, createPeer]);
    

    // 5. Firestore signaling listener
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
                
                // If we get an offer and we are a speaker, create a peer to answer.
                if (signal.type === 'offer' && !peer && isCurrentUserSpeaker) {
                    await manageLocalStream();
                    if (localStreamRef.current) {
                        const isInitiator = currentUserId < senderId;
                        // We received an offer, so we are not the initiator
                        createPeer(senderId, false);
                        peer = peersRef.current[senderId];
                    }
                }

                if (peer && !peer.destroyed) {
                    peer.signal(signal);
                }
                
                // We must delete the signal after processing
                await deleteDoc(change.doc.ref);
            }
        });

        return () => {
            unsubscribe();
        };

    }, [chatRoomId, currentUserId, createPeer, isCurrentUserSpeaker, manageLocalStream]);

    // Final cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        }
    }, [cleanup]);

    return { remoteStreams, connectionStatus };
};
