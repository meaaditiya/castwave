
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

type ConnectionStatus = 'connecting' | 'connected' | 'failed' | 'disconnected';

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
        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        setRemoteStreams({});
        setConnectionStatus({});

        if (currentUserId) {
            const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
            const q = query(signalsRef, where('target', '==', currentUserId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const batch = writeBatch(db);
                snapshot.docs.forEach(d => batch.delete(d.ref));
                await batch.commit().catch(e => console.error("Error cleaning up signals:", e));
            }
        }
    }, [chatRoomId, currentUserId]);

    const createPeer = useCallback((peerUserId: string, initiator: boolean) => {
        if (!localStreamRef.current || !currentUserId) return;
        console.log(`Creating peer connection to ${peerUserId}. Initiator: ${initiator}`);
        setConnectionStatus(prev => ({...prev, [peerUserId]: 'connecting'}));

        const peer = new Peer({
            initiator,
            trickle: true,
            config: servers,
            stream: localStreamRef.current,
        });

        peer.on('signal', async (data) => {
            const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
            await addDoc(signalsRef, {
                signal: JSON.stringify(data),
                sender: currentUserId,
                target: peerUserId,
            });
        });

        peer.on('stream', (stream) => {
            console.log('Received remote stream from', peerUserId);
            setRemoteStreams(prev => ({ ...prev, [peerUserId]: stream }));
        });

        peer.on('connect', () => {
             console.log('Connected to', peerUserId);
             setConnectionStatus(prev => ({...prev, [peerUserId]: 'connected'}));
        });

        peer.on('close', () => {
            console.log('Connection closed with', peerUserId);
            setConnectionStatus(prev => ({...prev, [peerUserId]: 'disconnected'}));
            setRemoteStreams(prev => {
                const newStreams = { ...prev };
                delete newStreams[peerUserId];
                return newStreams;
            });
            delete peersRef.current[peerUserId];
        });

        peer.on('error', (err) => {
            console.error(`Peer error with ${peerUserId}:`, err);
            setConnectionStatus(prev => ({...prev, [peerUserId]: 'failed'}));
            peer.destroy();
        });

        peersRef.current[peerUserId] = peer;
    }, [chatRoomId, currentUserId]);


    useEffect(() => {
        if (!currentUserId) return;

        const initializeLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                localStreamRef.current = stream;
            } catch (err) {
                console.error('Failed to get user media', err);
                toast({ variant: 'destructive', title: 'Microphone Access Denied', description: 'Please allow microphone access to speak.' });
                return false;
            }
            return true;
        };
        
        const initializeConnections = async () => {
            if (isCurrentUserSpeaker) {
                const streamReady = await initializeLocalStream();
                if (!streamReady) return;
                
                // Speakers should connect to all OTHER speakers.
                speakers.forEach(speaker => {
                    if (speaker.userId !== currentUserId && !peersRef.current[speaker.userId]) {
                        createPeer(speaker.userId, true); // Speaker initiates connection to other speakers
                    }
                });
            } else {
                 // Listeners should connect to ALL speakers.
                 // We only need a 'silent' local stream to create the peer connection object.
                 const streamReady = await initializeLocalStream();
                 if(!streamReady) return;

                 localStreamRef.current?.getTracks().forEach(track => track.enabled = false); // Mute stream for listeners

                 speakers.forEach(speaker => {
                    if (!peersRef.current[speaker.userId]) {
                         // Listeners do not initiate. They wait for offers.
                         console.log(`Ready to receive offer from speaker: ${speaker.userId}`);
                    }
                 });
            }
        };

        initializeConnections();
        
        // Cleanup old connections
        const currentSpeakerIds = new Set(speakers.map(s => s.userId));
        Object.keys(peersRef.current).forEach(peerId => {
            if (!currentSpeakerIds.has(peerId)) {
                peersRef.current[peerId].destroy();
                delete peersRef.current[peerId];
            }
        });

    }, [currentUserId, isCurrentUserSpeaker, speakers, createPeer, toast]);
    

     // Universal signaling listener
    useEffect(() => {
        if (!currentUserId) return;

        const signalsRef = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');
        const q = query(signalsRef, where('target', '==', currentUserId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    const signal = JSON.parse(data.signal);
                    const senderId = data.sender;

                    // If we receive an offer and we are not the initiator (i.e., we are a listener or a non-initiating speaker)
                    if (signal.type === 'offer' && !peersRef.current[senderId]) {
                        console.log(`Received offer from ${senderId}, creating peer...`);
                        createPeer(senderId, false);
                    }

                    // For both offers and answers, signal the existing peer
                    if (peersRef.current[senderId] && !peersRef.current[senderId].destroyed) {
                         peersRef.current[senderId].signal(signal);
                    }
                    
                    // Delete signal doc after processing
                    await deleteDoc(change.doc.ref);
                }
            });
        });

        return () => {
            unsubscribe();
            cleanup();
        };
    }, [chatRoomId, currentUserId, cleanup, createPeer]);


    return { remoteStreams, connectionStatus };
};
