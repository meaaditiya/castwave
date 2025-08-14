import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, updateDoc, setDoc, getDocs, writeBatch, runTransaction, increment, where, deleteDoc, Query, FirestoreError, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { getUserProfile } from './userService';
import { Quiz, Poll } from './pollService';

export interface Message {
  id?: string;
  user: string;
  userId: string;
  text?: string;
  timestamp?: any;
  upvotes: number;
  downvotes: number;
  voters: { [userId: string]: 'upvotes' | 'downvotes' };
  parentId?: string; // ID of the message this is a reply to
}

export interface ChatRoom {
    id: string;
    title: string;
    description: string;
    host: string;
    hostId: string;
    hostPhotoURL?: string;
    isLive: boolean;
    createdAt: any;
    isPrivate: boolean;
    scheduledAt?: any;
    imageUrl?: string;
    imageHint?: string;
    featuredMessage?: Message | null;
    hostReply?: string | null;
    typingUsers?: { [userId: string]: string };
    likes: number;
    dislikes: number;
    likers: string[];
    dislikers: string[];
    activeQuiz?: Quiz;
    activePoll?: Poll;
}

export interface ChatRoomInput {
    title: string;
    description: string;
    host: string;
    hostId: string;
    hostPhotoURL?: string;
    isLive: boolean;
    isPrivate: boolean;
    scheduledAt?: Date;
}

export interface ChatRoomUpdateInput {
    title: string;
    description: string;
    isLive: boolean;
    isPrivate: boolean;
    scheduledAt?: Date;
}


export interface Participant {
    id?: string;
    userId: string;
    displayName: string;
    status: 'pending' | 'approved' | 'removed' | 'denied';
    requestCount?: number;
    photoURL?: string;
    isMuted?: boolean;
    handRaised?: boolean;
    lastReaction?: string;
    isPresent?: boolean;
}

export const createChatRoom = async (input: ChatRoomInput): Promise<{ chatRoomId: string }> => {
    const chatRoomsCol = collection(db, 'chatRooms');
    const newChatRoomRef = doc(chatRoomsCol);

    try {
        await runTransaction(db, async (transaction) => {
            
            const userProfile = await getUserProfile(input.hostId);

            transaction.set(newChatRoomRef, {
                title: input.title,
                description: input.description,
                host: input.host,
                hostId: input.hostId,
                hostPhotoURL: userProfile?.photoURL || '',
                isLive: input.isLive,
                isPrivate: input.isPrivate,
                createdAt: serverTimestamp(),
                scheduledAt: input.scheduledAt || null,
                imageUrl: '',
                imageHint: '',
                likes: 0,
                dislikes: 0,
                likers: [],
                dislikers: []
            });
            
            const participantRef = doc(db, 'chatRooms', newChatRoomRef.id, 'participants', input.hostId);
            transaction.set(participantRef, {
                userId: input.hostId,
                displayName: input.host,
                photoURL: userProfile?.photoURL || '',
                status: 'approved', // Host is always approved
                requestCount: 0,
                isMuted: false,
                handRaised: false,
                isPresent: true,
            });
        });
        
        return { chatRoomId: newChatRoomRef.id };

    } catch (error) {
        console.error("Transaction failed: ", error);
        throw new Error("Could not create chat room. Please try again.");
    }
};

export const updateChatRoom = async (chatRoomId: string, data: Partial<ChatRoomUpdateInput>) => {
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    try {
        await updateDoc(chatRoomRef, {
            ...data,
            scheduledAt: data.scheduledAt === undefined ? null : data.scheduledAt,
        });
    } catch (error) {
        console.error("Error updating chat room:", error);
        throw new Error("Could not update the session details.");
    }
}

export const getChatRooms = (
    callback: (chatRooms: ChatRoom[]) => void,
    onError: (error: FirestoreError) => void
) => {
    const roomsCollection = collection(db, 'chatRooms');
    const q = query(roomsCollection);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
        callback(allRooms);
    }, onError);
    
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
        if (!message.text || !message.text?.trim()) {
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

        if (message.parentId) {
            messageData.parentId = message.parentId;
        }

        await addDoc(messagesCol, messageData);
    } catch (error) {
        console.error("Error sending message: ", error);
        throw new Error("Could not send message.");
    }
};

export const deleteMessage = async (chatRoomId: string, messageId: string, userId: string) => {
    const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', messageId);
    try {
        const messageDoc = await getDoc(messageRef);
        if (messageDoc.exists() && messageDoc.data().userId === userId) {
            await deleteDoc(messageRef);
        } else {
            throw new Error("You do not have permission to delete this message.");
        }
    } catch (error) {
        console.error("Error deleting message: ", error);
        throw new Error("Could not delete message.");
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
        callback(doc.exists() ? { id: doc.id, ...doc.data() } as Participant : null);
    });
    return unsubscribe;
};

export const requestToJoinChat = async (chatRoomId: string, userId: string) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
    
    await runTransaction(db, async (transaction) => {
        const participantDoc = await transaction.get(participantRef);

        if (participantDoc.exists()) {
             const participant = participantDoc.data() as Participant;
             if ((participant.requestCount || 0) >= 5) { // Increased limit
                 throw new Error("You have reached the maximum number of join requests.");
             }
             // If user was denied, removed, or previously approved but left, reset to pending
             if (['denied', 'removed'].includes(participant.status) || (participant.status === 'approved' && !participant.isPresent)) {
                 transaction.update(participantRef, {
                     status: 'pending',
                     isPresent: true,
                     requestCount: increment(1)
                 });
             } else if (!participant.isPresent) { // For any other case where user is not present
                transaction.update(participantRef, { isPresent: true });
             }
        } else {
            const userProfile = await getUserProfile(userId);
            transaction.set(participantRef, {
                userId: userId,
                displayName: userProfile?.username || 'Anonymous',
                photoURL: userProfile?.photoURL || '',
                status: 'pending',
                requestCount: 1,
                isMuted: false,
                handRaised: false,
                isPresent: true,
            });
        }
    });
};


export const updateParticipantStatus = async (chatRoomId: string, userId: string, status: Participant['status']) => {
    const participantRef = doc(db, `chatRooms/${chatRoomId}/participants`, userId);
    const updateData: any = { status };
    if (status === 'denied' || status === 'removed') {
        updateData.isPresent = false;
    }
    await updateDoc(participantRef, updateData);
}

export const updatePresence = async (chatRoomId: string, userId: string, isPresent: boolean) => {
    const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', userId);
    try {
        const participantDoc = await getDoc(participantRef);
        if (participantDoc.exists()) {
             // Only update the presence status. Do not change their approval status.
            await updateDoc(participantRef, { isPresent });
        }
    } catch (error) {
        console.error("Error updating presence:", error);
    }
};

export const getParticipants = (chatRoomId: string, callback: (participants: Participant[]) => void, onError?: (error: Error) => void) => {
    const participantsCol = collection(db, `chatRooms/${chatRoomId}/participants`);
    const q = query(participantsCol);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const participants = snapshot.docs.map(doc => ({ id: doc.id, userId: doc.id, ...doc.data() } as Participant));
        callback(participants);
    }, onError);
    return unsubscribe;
}

export const updateParticipantMuteStatus = async (chatRoomId: string, userId: string, isMuted: boolean) => {
    const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', userId);
    await updateDoc(participantRef, { isMuted });
};

export const updateParticipantHandRaiseStatus = async (chatRoomId: string, userId: string, handRaised: boolean) => {
    const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', userId);
    await updateDoc(participantRef, { handRaised });
};

export const sendReaction = async (chatRoomId: string, userId: string, emoji: string) => {
    const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', userId);
    await updateDoc(participantRef, { lastReaction: emoji });
    // After a delay, clear the reaction
    setTimeout(async () => {
        const docSnap = await getDoc(participantRef);
        if (docSnap.exists() && docSnap.data().lastReaction === emoji) {
            await updateDoc(participantRef, { lastReaction: null });
        }
    }, 10000);
};


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
                // User has already voted, do nothing.
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

export const clearFeaturedMessage = async (chatRoomId: string) => {
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    try {
        await updateDoc(chatRoomRef, {
            featuredMessage: null,
            hostReply: null
        });
    } catch (e) {
        console.error("Error clearing featured message: ", e);
        throw new Error("Could not clear featured message.");
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
            // To remove a field, we need to read the document first.
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
        // Don't throw an error for this non-critical operation
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
        await runTransaction(db, async (transaction) => {
            const chatRoomSnap = await transaction.get(chatRoomRef);
            if (!chatRoomSnap.exists()) {
                throw new Error("Chat room not found.");
            }
            const chatRoomData = chatRoomSnap.data();
            if (chatRoomData.hostId !== hostId) {
                throw new Error("Only the host can delete this chat room.");
            }
            transaction.delete(chatRoomRef);
        });

        await Promise.all([
            deleteSubcollection(chatRoomId, 'participants'),
            deleteSubcollection(chatRoomId, 'messages'),
            deleteSubcollection(chatRoomId, 'rtc_signals')
        ]);

    } catch (error) {
        console.error("Error deleting chat room:", error);
        throw new Error("Could not delete chat room.");
    }
};


export const likeChatRoom = async (chatRoomId: string, userId: string, type: 'like' | 'dislike') => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);

    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) {
            throw new Error("Chat room not found.");
        }

        const roomData = roomDoc.data() as ChatRoom;
        const likers = roomData.likers || [];
        const hasLiked = likers.includes(userId);

        if (type === 'like') {
            if (hasLiked) {
                // User is un-liking
                transaction.update(roomRef, {
                    likes: increment(-1),
                    likers: arrayRemove(userId)
                });
            } else {
                // User is liking
                transaction.update(roomRef, {
                    likes: increment(1),
                    likers: arrayUnion(userId)
                });
            }
        }
        // Note: Dislike logic was simplified to only handle likes for this fix.
    });
};
