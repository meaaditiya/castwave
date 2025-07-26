
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, runTransaction, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import {nanoid} from 'nanoid';

export interface PollOption {
    id: string;
    text: string;
    votes: number;
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    isActive: boolean;
    createdAt: any;
    endsAt: any;
    voters: { [userId: string]: string }; // userId: optionId
    resultsVisible: boolean;
}

export interface PollInput {
    question: string;
    options: { text: string }[];
    durationMinutes: number;
}

// Close any existing active polls before creating a new one
const closeExistingPolls = async (chatRoomId: string) => {
    const pollsRef = collection(db, 'chatRooms', chatRoomId, 'polls');
    const q = query(pollsRef, where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.update(doc.ref, { isActive: false });
    });
    await batch.commit();
}


export const createPoll = async (chatRoomId: string, pollInput: PollInput) => {
    await closeExistingPolls(chatRoomId);

    const pollsCol = collection(db, 'chatRooms', chatRoomId, 'polls');
    const now = new Date();
    const endsAt = new Date(now.getTime() + pollInput.durationMinutes * 60000);

    const newPoll: Omit<Poll, 'id'> = {
        question: pollInput.question,
        options: pollInput.options.map(o => ({ id: nanoid(), text: o.text, votes: 0 })),
        isActive: true,
        createdAt: serverTimestamp(),
        endsAt: endsAt,
        voters: {},
        resultsVisible: false
    };

    await addDoc(pollsCol, newPoll);
};

export const getActivePoll = (chatRoomId: string, callback: (poll: Poll | null) => void) => {
    const pollsRef = collection(db, 'chatRooms', chatRoomId, 'polls');
    const q = query(pollsRef, where('isActive', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
            return;
        }
        
        const pollDoc = snapshot.docs[0];
        const pollData = { id: pollDoc.id, ...pollDoc.data() } as Poll;

        // Check if poll has expired
        if (pollData.endsAt && pollData.endsAt.toDate() < new Date()) {
            updateDoc(pollDoc.ref, { isActive: false });
            callback(null);
        } else {
            callback(pollData);
        }
    });

    return unsubscribe;
};

export const voteOnPoll = async (chatRoomId: string, pollId: string, optionId: string, userId: string) => {
    const pollRef = doc(db, 'chatRooms', chatRoomId, 'polls', pollId);

    try {
        await runTransaction(db, async (transaction) => {
            const pollDoc = await transaction.get(pollRef);
            if (!pollDoc.exists()) {
                throw new Error("Poll does not exist.");
            }

            const poll = pollDoc.data() as Poll;

            if (poll.voters[userId]) {
                throw new Error("You have already voted in this poll.");
            }
             if (!poll.isActive) {
                throw new Error("This poll is no longer active.");
            }

            const newOptions = poll.options.map(opt => {
                if (opt.id === optionId) {
                    return { ...opt, votes: opt.votes + 1 };
                }
                return opt;
            });

            transaction.update(pollRef, {
                options: newOptions,
                [`voters.${userId}`]: optionId
            });
        });
    } catch (e: any) {
        console.error("Vote transaction failed: ", e);
        throw new Error(e.message || "Could not process your vote.");
    }
};

export const endPoll = async (chatRoomId: string, pollId: string) => {
    const pollRef = doc(db, 'chatRooms', chatRoomId, 'polls', pollId);
    await updateDoc(pollRef, { isActive: false, resultsVisible: true });
};

export const togglePollResultsVisibility = async (chatRoomId: string, pollId: string, isVisible: boolean) => {
    const pollRef = doc(db, 'chatRooms', chatRoomId, 'polls', pollId);
    await updateDoc(pollRef, { resultsVisible: isVisible });
};
