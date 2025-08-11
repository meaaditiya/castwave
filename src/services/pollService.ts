
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, runTransaction, serverTimestamp, getDocs, writeBatch, orderBy, limit } from 'firebase/firestore';
import {nanoid} from 'nanoid';

// --- Simple Poll ---
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

// --- Quiz ---

export interface QuizQuestion {
    id: string;
    question: string;
    options: { text: string }[];
    correctOption: number;
    timeLimit: number;
}

export interface QuizAnswer {
    optionIndex: number;
    isCorrect: boolean;
    score: number;
}

export interface Quiz {
    id: string;
    questions: QuizQuestion[];
    status: 'draft' | 'in_progress' | 'ended';
    currentQuestionIndex: number;
    currentQuestionStartTime?: any;
    leaderboard: { [userId: string]: number }; // userId: score
    answers?: {
        [questionId: string]: {
            [userId: string]: QuizAnswer;
        }
    };
    // This will be a flattened version for easier access on the client
    currentQuestion?: QuizQuestion;
}

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
            if (!pollDoc.exists()) throw new Error("Poll does not exist.");

            const poll = pollDoc.data() as Poll;
            if (poll.voters[userId]) throw new Error("You have already voted in this poll.");
            if (!poll.isActive) throw new Error("This poll is no longer active.");

            const newOptions = poll.options.map(opt => 
                opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
            );

            transaction.update(pollRef, {
                options: newOptions,
                [`voters.${userId}`]: optionId
            });
        });
    } catch (e: any) {
        throw new Error(e.message || "Could not process your vote.");
    }
};

export const endPoll = async (chatRoomId: string, pollId: string) => {
    const pollRef = doc(db, 'chatRooms', chatRoomId, 'polls', pollId);
    await updateDoc(pollRef, { isActive: false, resultsVisible: true });
};

// --- Quiz Functions ---

export const createQuiz = async (chatRoomId: string, questions: Omit<QuizQuestion, 'id'>[]) => {
    // End any currently active quiz
    const quizCol = collection(db, 'chatRooms', chatRoomId, 'quizzes');
    const activeQuery = query(quizCol, where('status', 'in', ['draft', 'in_progress']));
    const activeSnapshot = await getDocs(activeQuery);
    const batch = writeBatch(db);
    activeSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    const newQuiz: Omit<Quiz, 'id'> = {
        questions: questions.map(q => ({...q, id: nanoid() })),
        status: 'draft',
        currentQuestionIndex: -1,
        leaderboard: {},
    };
    await addDoc(quizCol, newQuiz);
}

export const getActiveQuiz = (chatRoomId: string, callback: (quiz: Quiz | null) => void) => {
    const quizCol = collection(db, 'chatRooms', chatRoomId, 'quizzes');
    const q = query(quizCol, where('status', 'in', ['draft', 'in_progress']), orderBy('__name__'), limit(1));

    return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            callback(null);
            return;
        }
        const doc = snapshot.docs[0];
        const data = doc.data() as Quiz;
        const quiz: Quiz = {
            ...data,
            id: doc.id,
            currentQuestion: data.currentQuestionIndex >= 0 ? data.questions[data.currentQuestionIndex] : undefined
        };
        callback(quiz);
    });
};

export const nextQuizQuestion = async (chatRoomId: string, quizId: string) => {
    const quizRef = doc(db, 'chatRooms', chatRoomId, 'quizzes', quizId);

    await runTransaction(db, async (transaction) => {
        const quizDoc = await transaction.get(quizRef);
        if (!quizDoc.exists()) throw new Error("Quiz not found");

        const quiz = quizDoc.data() as Quiz;
        const nextIndex = quiz.currentQuestionIndex + 1;

        if (nextIndex >= quiz.questions.length) {
            transaction.update(quizRef, { status: 'ended' });
            return;
        }

        transaction.update(quizRef, {
            currentQuestionIndex: nextIndex,
            status: 'in_progress',
            currentQuestionStartTime: serverTimestamp(),
        });
    });
};

export const answerQuizQuestion = async (chatRoomId: string, quizId: string, userId: string, optionIndex: number, score: number) => {
    const quizRef = doc(db, 'chatRooms', chatRoomId, 'quizzes', quizId);

    await runTransaction(db, async (transaction) => {
        const quizDoc = await transaction.get(quizRef);
        if (!quizDoc.exists()) throw new Error("Quiz not found");

        const quiz = quizDoc.data() as Quiz;
        const question = quiz.questions[quiz.currentQuestionIndex];
        if (!question) throw new Error("No active question.");

        if (quiz.answers?.[question.id]?.[userId]) throw new Error("You have already answered.");
        
        const isCorrect = question.correctOption === optionIndex;
        const calculatedScore = isCorrect ? Math.round(score * 10) : 0; // Simple scoring

        transaction.update(quizRef, {
            [`answers.${question.id}.${userId}`]: { optionIndex, isCorrect, score: calculatedScore },
            [`leaderboard.${userId}`]: (quiz.leaderboard[userId] || 0) + calculatedScore,
        });
    });
}

export const endQuiz = async (chatRoomId: string, quizId: string) => {
    const quizRef = doc(db, 'chatRooms', chatRoomId, 'quizzes', quizId);
    await updateDoc(quizRef, { status: 'ended' });
}
