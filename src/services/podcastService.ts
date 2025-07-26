
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import type { Message } from '@/components/LiveChat';

export interface Podcast {
    id: string;
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
    createdAt: any;
    imageUrl: string;
    imageHint: string;
}

export interface PodcastInput {
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
}

export interface Participant {
    id?: string;
    userId: string;
    displayName: string;
    status: 'pending' | 'approved' | 'removed' | 'denied';
}

// Create a new podcast
export const createPodcast = async (podcastData: PodcastInput) => {
    try {
        const docRef = await addDoc(collection(db, 'podcasts'), {
            ...podcastData,
            createdAt: serverTimestamp(),
            imageUrl: 'https://placehold.co/400x400.png',
            imageHint: 'podcast technology'
        });

        // Automatically add the host as an approved participant
        const hostParticipant: Participant = {
            userId: podcastData.hostId,
            displayName: podcastData.host,
            status: 'approved'
        };
        await addParticipant(docRef.id, hostParticipant);

    } catch (error) {
        console.error("Error creating podcast: ", error);
        throw new Error("Could not create podcast.");
    }
};

// Get a real-time stream of all podcasts
export const getPodcasts = (callback: (podcasts: Podcast[]) => void) => {
    const q = query(collection(db, 'podcasts'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const podcasts: Podcast[] = [];
        querySnapshot.forEach((doc) => {
            podcasts.push({ id: doc.id, ...doc.data() } as Podcast);
        });
        callback(podcasts);
    });

    return unsubscribe;
};


// Get a single podcast by ID
export const getPodcastById = async (id: string): Promise<Podcast | null> => {
    try {
        const docRef = doc(db, 'podcasts', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Podcast;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting podcast: ", error);
        throw new Error("Could not retrieve podcast.");
    }
};

// End a podcast
export const endPodcast = async (podcastId: string) => {
    try {
        const docRef = doc(db, 'podcasts', podcastId);
        await updateDoc(docRef, { isLive: false });
    } catch(e) {
        console.error("Error ending podcast: ", e);
        throw new Error("Could not end podcast.");
    }
}

// Send a chat message
export const sendMessage = async (podcastId: string, message: { user: string; text: string }) => {
    try {
        const messagesCol = collection(db, 'podcasts', podcastId, 'messages');
        await addDoc(messagesCol, {
            ...message,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error sending message: ", error);
        throw new Error("Could not send message.");
    }
};

// Get a real-time stream of messages for a podcast
export const getMessages = (podcastId: string, callback: (messages: Message[]) => void) => {
    const messagesCol = collection(db, 'podcasts', podcastId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: Message[] = [];
        querySnapshot.forEach((doc) => {
            messages.push(doc.data() as Message);
        });
        callback(messages);
    });

    return unsubscribe;
};

// Add a participant to the podcast
export const addParticipant = async (podcastId: string, participant: Participant) => {
    try {
        const participantRef = doc(db, `podcasts/${podcastId}/participants`, participant.userId);
        await setDoc(participantRef, participant, { merge: true });
    } catch (error) {
        console.error("Error adding participant: ", error);
        throw new Error("Could not add participant.");
    }
};

// Get a real-time stream of participants for a podcast
export const getParticipants = (podcastId: string, callback: (participants: Participant[]) => void) => {
    const participantsCol = collection(db, `podcasts/${podcastId}/participants`);
    const q = query(participantsCol);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
        callback(participants);
    });
    return unsubscribe;
}

// Request to join the chat
export const requestToJoinChat = async (podcastId: string, userId: string, displayName: string) => {
    try {
        const participantRef = doc(db, `podcasts/${podcastId}/participants`, userId);
        await setDoc(participantRef, { userId, displayName, status: 'pending' }, { merge: true });
    } catch (error) {
        console.error("Error requesting to join chat: ", error);
        throw new Error("Could not send request.");
    }
}

// Update participant status
export const updateParticipantStatus = async (podcastId: string, userId: string, status: Participant['status']) => {
    try {
        const participantRef = doc(db, `podcasts/${podcastId}/participants`, userId);
        await updateDoc(participantRef, { status });
    } catch(e) {
        console.error("Error updating participant status: ", e);
        throw new Error("Could not update participant status.");
    }
}
