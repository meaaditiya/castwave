
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, writeBatch, runTransaction } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export interface Message {
  id?: string;
  user: string;
  text: string;
  timestamp?: any;
  upvotes: number;
  downvotes: number;
  voters: { [userId: string]: 'upvotes' | 'downvotes' };
}

export interface ChatRoom {
    id: string;
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
    createdAt: any;
    scheduledAt?: any;
    imageUrl: string;
    imageHint: string;
    featuredMessage?: Message;
    hostReply?: string;
}

export interface ChatRoomInput {
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
    scheduledAt?: Date;
    thumbnail?: File;
}

export interface Participant {
    id?: string;
    userId: string;
    displayName: string;
    status: 'pending' | 'approved' | 'removed' | 'denied';
}

// Create a new chatRoom
export const createChatRoom = async (chatRoomData: ChatRoomInput) => {
    try {
        let imageUrl = 'https://placehold.co/400x400.png';
        const imageHint = 'community discussion';

        if (chatRoomData.thumbnail) {
            const storage = getStorage();
            const storageRef = ref(storage, `thumbnails/${chatRoomData.hostId}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, chatRoomData.thumbnail);
            imageUrl = await getDownloadURL(snapshot.ref);
        }

        const docRef = await addDoc(collection(db, 'chatRooms'), {
            title: chatRoomData.title,
            description: chatRoomData.description,
            host: chatRoomData.host,
            hostId: chatRoomData.hostId,
            isLive: chatRoomData.isLive,
            createdAt: serverTimestamp(),
            scheduledAt: chatRoomData.scheduledAt || null,
            imageUrl: imageUrl,
            imageHint: imageHint
        });

        // Automatically add the host as an approved participant
        const hostParticipant: Participant = {
            userId: chatRoomData.hostId,
            displayName: chatRoomData.host,
            status: 'approved'
        };
        await addParticipant(docRef.id, hostParticipant);
        return docRef.id;

    } catch (error) {
        console.error("Error creating chat room: ", error);
        throw new Error("Could not create chat room.");
    }
};

// Get a real-time stream of all chatRooms
export const getChatRooms = (callback: (chatRooms: ChatRoom[]) => void) => {
    const q = query(collection(db, 'chatRooms'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const chatRooms: ChatRoom[] = [];
        querySnapshot.forEach((doc) => {
            chatRooms.push({ id: doc.id, ...doc.data() } as ChatRoom);
        });
        callback(chatRooms);
    });

    return unsubscribe;
};

// Get a real-time stream for a single chat room
export const getChatRoomStream = (id: string, callback: (chatRoom: ChatRoom | null) => void) => {
    const docRef = doc(db, 'chatRooms', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as ChatRoom);
        } else {
            console.log("No such document!");
            callback(null);
        }
    });
    return unsubscribe;
};


// Get a single chatRoom by ID
export const getChatRoomById = async (id: string): Promise<ChatRoom | null> => {
    try {
        const docRef = doc(db, 'chatRooms', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as ChatRoom;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting chat room: ", error);
        throw new Error("Could not retrieve chat room.");
    }
};

// End a chatRoom
export const endChatRoom = async (chatRoomId: string) => {
    try {
        const docRef = doc(db, 'chatRooms', chatRoomId);
        await updateDoc(docRef, { isLive: false });
    } catch(e) {
        console.error("Error ending chat room: ", e);
        throw new Error("Could not end chat room.");
    }
}

// Delete a chatRoom and its subcollections
export const deleteChatRoom = async (chatRoomId: string) => {
    try {
        const batch = writeBatch(db);

        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.forEach(doc => batch.delete(doc.ref));

        const participantsRef = collection(db, 'chatRooms', chatRoomId, 'participants');
        const participantsSnap = await getDocs(participantsRef);
        participantsSnap.forEach(doc => batch.delete(doc.ref));

        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
        batch.delete(chatRoomRef);

        await batch.commit();

    } catch (error) {
        console.error('Error deleting chat room:', error);
        throw new Error('Could not delete chat room and its data.');
    }
};


// Send a chat message
export const sendMessage = async (chatRoomId: string, message: Message) => {
    try {
        const messagesCol = collection(db, 'chatRooms', chatRoomId, 'messages');
        await addDoc(messagesCol, {
            ...message,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error sending message: ", error);
        throw new Error("Could not send message.");
    }
};

// Get a real-time stream of messages for a chatRoom
export const getMessages = (chatRoomId: string, callback: (messages: Message[]) => void) => {
    const messagesCol = collection(db, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: Message[] = [];
        querySnapshot.forEach((doc) => {
            messages.push({id: doc.id, ...doc.data()} as Message);
        });
        callback(messages);
    });

    return unsubscribe;
};

// Add a participant to the chatRoom
export const addParticipant = async (chatRoomId: string, participant: Participant) => {
    try {
        const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, participant.userId);
        await setDoc(participantRef, participant, { merge: true });
    } catch (error) {
        console.error("Error adding participant: ", error);
        throw new Error("Could not add participant.");
    }
};

// Get a real-time stream of participants for a chatRoom
export const getParticipants = (chatRoomId: string, callback: (participants: Participant[]) => void) => {
    const participantsCol = collection(db, `chatRooms/${chatRoomId}/participants`);
    const q = query(participantsCol);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant));
        callback(participants);
    });
    return unsubscribe;
}

// Request to join the chat
export const requestToJoinChat = async (chatRoomId: string, userId: string, displayName: string) => {
    try {
        const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
        await setDoc(participantRef, { userId, displayName, status: 'pending' }, { merge: true });
    } catch (error) {
        console.error("Error requesting to join chat: ", error);
        throw new Error("Could not send request.");
    }
}

// Update participant status
export const updateParticipantStatus = async (chatRoomId: string, userId: string, status: Participant['status']) => {
    try {
        const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
        await updateDoc(participantRef, { status });
    } catch(e) {
        console.error("Error updating participant status: ", e);
        throw new Error("Could not update participant status.");
    }
}

// Vote on a message
export const voteOnMessage = async (chatRoomId: string, messageId: string, userId: string, voteType: 'upvotes' | 'downvotes') => {
    const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);
    try {
        await runTransaction(db, async (transaction) => {
            const messageDoc = await transaction.get(messageRef);
            if (!messageDoc.exists()) {
                throw "Document does not exist!";
            }

            const data = messageDoc.data() as Message;
            const voters = data.voters || {};

            // User has already voted
            if (voters[userId]) {
                return;
            }

            const newVoteCount = (data[voteType] || 0) + 1;
            
            transaction.update(messageRef, {
                [voteType]: newVoteCount,
                [`voters.${userId}`]: voteType
            });
        });
    } catch (e) {
        console.error("Vote transaction failed: ", e);
        throw new Error("Could not process vote.");
    }
};

// Feature a message on the main screen
export const featureMessage = async (chatRoomId: string, message: Message, hostReply: string) => {
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    try {
        await updateDoc(chatRoomRef, {
            featuredMessage: message,
            hostReply: hostReply
        });
    } catch (e) {
        console.error("Error featuring message: ", e);
        throw new Error("Could not feature message.");
    }
}
