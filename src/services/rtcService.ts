
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

/**
 * A simplified WebRTC signaling service using a single collection for all signals.
 */

export interface Signal {
    sender: string;
    receiver: string;
    signal: any;
    timestamp: Timestamp;
}

const getSignalsCollection = (chatRoomId: string) => collection(db, 'chatRooms', chatRoomId, 'rtc_signals');

/**
 * Sends a signal from the current user to a specific peer.
 * @param chatRoomId The ID of the chat room.
 * @param receiverId The ID of the user to receive the signal.
 * @param signal The WebRTC signal data (offer, answer, or ICE candidate).
 */
export const sendSignal = async (chatRoomId: string, senderId: string, receiverId: string, signal: any) => {
    try {
        await addDoc(getSignalsCollection(chatRoomId), {
            sender: senderId,
            receiver: receiverId,
            signal: JSON.parse(JSON.stringify(signal)), // Ensure signal is a plain object
            timestamp: Timestamp.now(),
        });
    } catch (e) {
        console.error("Error sending signal: ", e);
    }
}


/**
 * Listens for incoming signals directed at the current user.
 * @param chatRoomId The ID of the chat room.
 * @param currentUserId The ID of the user listening for signals.
 * @param callback A function to handle the incoming signal and sender's ID.
 * @returns An unsubscribe function to stop listening.
 */
export const listenForSignals = (chatRoomId: string, currentUserId: string, callback: (senderId: string, signal: any) => void) => {
    const signalsRef = getSignalsCollection(chatRoomId);
    
    // Listen for signals specifically addressed to the current user.
    const q = query(
        signalsRef, 
        where('receiver', '==', currentUserId),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data() as Signal;
                callback(data.sender, data.signal);
                // We can delete the signal doc after processing to keep the collection clean
                deleteDoc(change.doc.ref);
            }
        });
    });

    return unsubscribe;
}

/**
 * Cleans up all signaling documents for a given user. Called when a user leaves.
 * @param chatRoomId The ID of the chat room.
 * @param userId The ID of the user whose signals should be cleaned up.
 */
export const cleanUpSignals = async (chatRoomId: string, userId: string) => {
    const signalsRef = getSignalsCollection(chatRoomId);
    
    // Create queries for signals sent by or to the user.
    const sentQuery = query(signalsRef, where('sender', '==', userId));
    const receivedQuery = query(signalsRef, where('receiver', '==', userId));
    
    const batch = writeBatch(db);

    try {
        const [sentSnapshot, receivedSnapshot] = await Promise.all([
            getDocs(sentQuery),
            getDocs(receivedQuery)
        ]);

        sentSnapshot.forEach(doc => batch.delete(doc.ref));
        receivedSnapshot.forEach(doc => batch.delete(doc.ref));

        await batch.commit();
    } catch(e) {
        console.error("Error cleaning up signals: ", e);
    }
}
