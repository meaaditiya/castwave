
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
                const q = query(signalsRef, where('target', '==', currentUserId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const batch = writeBatch(db);
                    snapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`Cleaned up ${snapshot.size} signals for user ${currentUserId}`);
                }
            } catch (error) {
                console.error("Error during signal cleanup:", error);
            }
        }
    }, [chatRoomId, currentUserId]);


    // 2. Local Stream Initialization
    const initializeLocalStream = useCallback(async () => {
        if (localStreamRef.current) {
            return localStreamRef.current;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStreamRef.current = stream;
            return stream;
        } catch (err) {
            toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to participate.' });
            console.error('getUserMedia error:', err);
            return null;
        }
    }, [toast]);

    // 3. Peer Creation
    const createPeer = useCallback((peerUserId: string, initiator: boolean) => {
        if (!localStreamRef.current || !currentUserId || peersRef.current[peerUserId]) {
            if(peersRef.current[peerUserId]) console.warn(`Peer already exists for ${peerUserId}`);
            return;
        }

        console.log(`Creating Peer. Initiator: ${initiator}. MyID: ${currentUserId} -> PeerID: ${peerUserId}`);
        setConnectionStatus(prev => ({ ...prev, [peerUserId]: 'connecting' }));
        
        const peer = new Peer({
            initiator,
            trickle: true,
            config: servers,
            stream: localStreamRef.current,
        });

        peer.on('signal', async (data) => {
            try {
                const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
                await addDoc(signalsRef, {
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
            if (peersRef.current[peerUserId] && !peersRef.current[peerUserId].destroyed) {
                peersRef.current[peerUserId].destroy();
                delete peersRef.current[peerUserId];
            }
        });
        
        peer.on('close', () => {
            console.log(`Connection closed with ${peerUserId}`);
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

        peersRef.current[peerUserId] = peer;
    }, [chatRoomId, currentUserId]);


    // 4. Main useEffect to manage connections
    useEffect(() => {
        if (!currentUserId) return;

        const connectToPeers = async () => {
            await initializeLocalStream();
            if (!localStreamRef.current) return;
            
            // Mute/unmute local stream based on speaker status
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = isCurrentUserSpeaker;
            });

            const otherSpeakers = speakers.filter(s => s.userId !== currentUserId);

            // Create connections to all other speakers
            otherSpeakers.forEach(speaker => {
                if (!peersRef.current[speaker.userId]) {
                    // Speakers initiate connections to other speakers to ensure broadcast
                    // Listeners will wait for offers from speakers
                    if (isCurrentUserSpeaker) {
                        createPeer(speaker.userId, true);
                   }
                }
            });

            // Clean up connections to users who are no longer speakers
            Object.keys(peersRef.current).forEach(peerId => {
                if (!speakers.some(s => s.userId === peerId)) {
                    if (peersRef.current[peerId] && !peersRef.current[peerId].destroyed) {
                         peersRef.current[peerId].destroy();
                    }
                    delete peersRef.current[peerId];
                }
            });
        };

        connectToPeers();
        
    }, [currentUserId, speakers, isCurrentUserSpeaker, initializeLocalStream, createPeer]);
    

    // 5. Firestore signaling listener
    useEffect(() => {
        if (!currentUserId || !chatRoomId) return () => {};

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
            for (const change of changes) {
                const signalData = change.doc.data();
                const senderId = signalData.sender;
                const signal = JSON.parse(signalData.signal);

                let peer = peersRef.current[senderId];
                
                // If we get an offer, it means a speaker wants to connect to us. We create a peer to answer.
                if (signal.type === 'offer' && !peer) {
                     console.log(`Received offer from ${senderId}, creating non-initiator peer.`);
                     createPeer(senderId, false);
                     peer = peersRef.current[senderId]; // Peer is now in the ref
                }

                if (peer && !peer.destroyed) {
                    peer.signal(signal);
                } else {
                    console.warn(`Peer not found or destroyed for sender ${senderId}. Cannot process signal.`);
                }
                
                await deleteDoc(change.doc.ref);
            }
        }, (error) => {
            console.error("Error in signal listener:", error);
        });

        // Cleanup on unmount
        return () => {
            unsubscribe();
            cleanup();
        };

    }, [chatRoomId, currentUserId, initializeLocalStream, createPeer, cleanup]);


    return { remoteStreams, connectionStatus };
};
