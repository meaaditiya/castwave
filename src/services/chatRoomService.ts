
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, getDocs, writeBatch, where, deleteDoc, Query, runTransaction } from 'firebase/firestore';
import { createChatRoomFlow } from '@/ai/flows/create-chat-room';

export interface Message {
  id?: string;
  user: string;
  userId: string;
  text?: string;
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
    isPrivate: boolean;
    scheduledAt?: any;
    imageUrl?: string;
    imageHint?: string;
    featuredMessage?: Message;
    hostReply?: string;
    typingUsers?: { [userId: string]: string };
}

export interface ChatRoomInput {
    title: string;
    description: string;
    isLive: boolean;
    isPrivate: boolean;
    scheduledAt?: Date;
}

export interface Participant {
    userId: string;
    displayName: string;
    status: 'pending' | 'approved' | 'denied' | 'removed';
    requestCount: number;
    photoURL?: string;
}


export const createChatRoom = async (input: ChatRoomInput): Promise<{ chatRoomId: string }> => {
    return createChatRoomFlow(input);
};

interface GetChatRoomsOptions {
    isPublic?: boolean;
    hostId?: string;
}

export const getChatRooms = (
    callback: (chatRooms: ChatRoom[]) => void, 
    options: GetChatRoomsOptions,
    onError?: (error: Error) => void
) => {
    const chatRoomsRef = collection(db, 'chatRooms');
    let q: Query; 

    if (options.hostId) {
        q = query(chatRoomsRef, where('hostId', '==', options.hostId));
    } else {
         q = query(chatRoomsRef, where('isPrivate', '==', false));
    }
   
    const unsubscribe = onSnapshot(q, 
        (querySnapshot) => {
            const chatRooms = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
            
            chatRooms.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || 0;
                const dateB = b.createdAt?.toDate() || 0;
                if (dateA > dateB) return -1;
                if (dateA < dateB) return 1;
                return 0;
            });

            callback(chatRooms);
        }, 
        (err) => {
            console.error("Error in getChatRooms snapshot listener:", err);
            if (onError) {
                onError(new Error("Could not load sessions. Check permissions or network."));
            }
        }
    );

    return unsubscribe;
};


export const getChatRoomStream = (id: string, callback: (chatRoom: ChatRoom | null) => void, onError?: (error: Error) => void) => {
    const docRef = doc(db, 'chatRooms', id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as ChatRoom);
        } else {
            console.log("No such document!");
            callback(null);
        }
    }, (error) => {
        console.error("Error fetching chat room:", error);
        if (onError) {
            onError(error);
        }
    });
    return unsubscribe;
};

export const startChatRoom = async (chatRoomId: string) => {
    try {
        const docRef = doc(db, 'chatRooms', chatRoomId);
        await updateDoc(docRef, { isLive: true, scheduledAt: null });
    } catch(e) {
        console.error("Error starting chat room: ", e);
        throw new Error("Could not start chat room.");
    }
};

export const endChatRoom = async (chatRoomId: string) => {
    try {
        const docRef = doc(db, 'chatRooms', chatRoomId);
        await updateDoc(docRef, { isLive: false });
    } catch(e) {
        console.error("Error ending chat room: ", e);
        throw new Error("Could not end the chat room.");
    }
}

export const sendMessage = async (chatRoomId: string, message: Partial<Message>) => {
    try {
        if (!message.text) {
            throw new Error("Message must have text.");
        }

        const messagesCol = collection(db, 'chatRooms', chatRoomId, 'messages');
        
        const messageData: any = {
            user: message.user,
            userId: message.userId,
            text: message.text,
            upvotes: 0,
            downvotes: 0,
            voters: {},
            timestamp: serverTimestamp()
        };

        await addDoc(messagesCol, messageData);
    } catch (error) {
        console.error("Error sending message: ", error);
        throw new Error("Could not send message.");
    }
};

export const getMessages = (chatRoomId: string, callback: (messages: Message[]) => void, onError?: (error: Error) => void) => {
    const messagesCol = collection(db, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messages: Message[] = [];
        querySnapshot.forEach((doc) => {
            messages.push({id: doc.id, ...doc.data()} as Message);
        });
        callback(messages);
    }, onError);

    return unsubscribe;
};

// --- Participant Management ---

export const getParticipantStream = (chatRoomId: string, userId: string, callback: (participant: Participant | null) => void) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
    const unsubscribe = onSnapshot(participantRef, (doc) => {
        callback(doc.exists() ? doc.data() as Participant : null);
    });
    return unsubscribe;
};

export const addParticipant = async (chatRoomId: string, participant: Participant) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, participant.userId);
    await setDoc(participantRef, participant, { merge: true });
}

export const requestToJoinChat = async (chatRoomId: string, userId: string) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
    const docSnap = await getDoc(participantRef);

    if (docSnap.exists()) {
        const participant = docSnap.data() as Participant;
        if (participant.requestCount >= 3) {
            throw new Error("You have reached the maximum number of join requests.");
        }
        if (participant.status === 'denied' || participant.status === 'removed') {
            await updateDoc(participantRef, {
                status: 'pending',
                requestCount: (participant.requestCount || 1) + 1
            });
        }
    }
};


export const updateParticipantStatus = async (chatRoomId: string, userId: string, status: Participant['status']) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
    await updateDoc(participantRef, { status });
}

export const getParticipants = (chatRoomId: string, callback: (participants: Participant[]) => void, onError?: (error: Error) => void) => {
    const participantsCol = collection(db, `chatRooms/${chatRoomId}/participants`);
    const q = query(participantsCol);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({ ...doc.data() } as Participant));
        callback(participants);
    }, onError);
    return unsubscribe;
}

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

export const updateTypingStatus = async (chatRoomId: string, userId: string, displayName: string, isTyping: boolean) => {
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    try {
        if (isTyping) {
            await updateDoc(chatRoomRef, {
                [`typingUsers.${userId}`]: displayName
            });
        } else {
            const roomSnap = await getDoc(chatRoomRef);
            if (roomSnap.exists()) {
                const roomData = roomSnap.data() as ChatRoom;
                const typingUsers = roomData.typingUsers || {};
                delete typingUsers[userId];
                await updateDoc(chatRoomRef, { typingUsers });
            }
        }
    } catch (e) {
        console.error("Error updating typing status: ", e);
        // Don't throw, as this is not a critical operation
    }
};


// Helper to delete a subcollection
const deleteSubcollection = async (chatRoomId: string, subcollectionName: string) => {
    const subcollectionRef = collection(db, 'chatRooms', chatRoomId, subcollectionName);
    const snapshot = await getDocs(subcollectionRef);
    const batch = writeBatch(db);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};


export const deleteChatRoomForHost = async (chatRoomId: string, hostId: string) => {
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    try {
        // Use a transaction to verify the host and delete the main document atomically
        await runTransaction(db, async (transaction) => {
            const chatRoomSnap = await transaction.get(chatRoomRef);
            if (!chatRoomSnap.exists()) {
                throw new Error("Chat room not found.");
            }
            const chatRoomData = chatRoomSnap.data();
            if (chatRoomData.hostId !== hostId) {
                throw new Error("Only the host can delete this chat room.");
            }
            // All checks passed, delete the main document within the transaction
            transaction.delete(chatRoomRef);
        });

        // After the main document is successfully deleted, clean up sub-collections.
        // This is done outside the transaction for performance reasons.
        await Promise.all([
            deleteSubcollection(chatRoomId, 'participants'),
            deleteSubcollection(chatRoomId, 'messages'),
            deleteSubcollection(chatRoomId, 'polls'),
        ]);

    } catch (error) {
        console.error("Error deleting chat room:", error);
        throw new Error("Could not delete chat room.");
    }
};
