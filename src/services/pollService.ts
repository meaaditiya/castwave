import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, runTransaction, serverTimestamp, getDocs, writeBatch, orderBy, limit, deleteDoc, Timestamp } from 'firebase/firestore';
import { ChatRoom } from './chatRoomService';
import {nanoid} from 'nanoid';

// --- Poll ---
export interface PollOption {
    text: string;
    votes: number;
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    endsAt: any;
    voters: { [userId: string]: number }; // userId: optionIndex
    showResults: boolean;
}

export const createPoll = async (chatRoomId: string, question: string, options: string[], duration: number, showResults: boolean) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);
    const newPoll: Poll = {
        id: nanoid(),
        question,
        options: options.map(opt => ({ text: opt, votes: 0 })),
        endsAt: Timestamp.fromMillis(Date.now() + duration * 1000),
        voters: {},
        showResults: showResults,
    };
    await updateDoc(roomRef, { activePoll: newPoll, activeQuiz: null });
}

export const voteOnPoll = async (chatRoomId: string, pollId: string, userId: string, optionIndex: number) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);
    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Room not found");
        
        const room = roomDoc.data() as ChatRoom;
        const poll = room.activePoll;

        if (!poll || poll.id !== pollId) throw new Error("Poll not active");
        if (poll.voters[userId] !== undefined) throw new Error("You have already voted.");

        poll.options[optionIndex].votes += 1;
        poll.voters[userId] = optionIndex;

        transaction.update(roomRef, { activePoll: poll });
    });
}

export const endPoll = async (chatRoomId: string, pollId: string) => {
     const roomRef = doc(db, 'chatRooms', chatRoomId);
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Room not found");
        
        const room = roomDoc.data() as ChatRoom;
        const poll = room.activePoll;

        if (poll && poll.id === pollId) {
             transaction.update(roomRef, { activePoll: null });
        }
    });
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
    currentQuestion?: QuizQuestion;
}

export const createQuiz = async (chatRoomId: string, questions: Omit<QuizQuestion, 'id'>[]) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);
    
    const newQuiz: Quiz = {
        id: nanoid(),
        questions: questions.map(q => ({...q, id: nanoid() })),
        status: 'draft',
        currentQuestionIndex: -1,
        leaderboard: {},
        answers: {}
    };

    await updateDoc(roomRef, {
        activeQuiz: newQuiz,
        activePoll: null,
    });
}

export const nextQuizQuestion = async (chatRoomId: string) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);

    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Chat room not found");

        const room = roomDoc.data() as ChatRoom;
        const quiz = room.activeQuiz;

        if (!quiz) throw new Error("No active quiz");
        
        const nextIndex = quiz.currentQuestionIndex + 1;

        if (nextIndex >= quiz.questions.length) {
            quiz.status = 'ended';
            delete quiz.currentQuestion;
            delete quiz.currentQuestionStartTime;
        } else {
            quiz.status = 'in_progress';
            quiz.currentQuestionIndex = nextIndex;
            quiz.currentQuestionStartTime = serverTimestamp();
            quiz.currentQuestion = quiz.questions[nextIndex];
        }
        
        transaction.update(roomRef, { activeQuiz: quiz });
    });
};

export const answerQuizQuestion = async (chatRoomId: string, userId: string, optionIndex: number) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);

    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Chat room not found");

        const room = roomDoc.data() as ChatRoom;
        const quiz = room.activeQuiz;
        
        if (!quiz || !quiz.currentQuestion || !quiz.currentQuestionStartTime) throw new Error("No active question.");
        if (quiz.answers?.[quiz.currentQuestion.id]?.[userId]) throw new Error("You have already answered.");
        
        const question = quiz.currentQuestion;
        const startTime = quiz.currentQuestionStartTime.toDate().getTime();
        const answerTime = new Date().getTime();
        const timeTaken = (answerTime - startTime) / 1000; // time in seconds

        if (timeTaken > question.timeLimit) {
            throw new Error("Time is up for this question.");
        }

        const isCorrect = question.correctOption === optionIndex;

        // Score is 1000 for a correct answer, minus points for time taken. Max score is 1000, min is 0.
        // Bonus for speed: full points for instant answer, decreasing over time.
        const timePenalty = (timeTaken / question.timeLimit) * 500; // Max penalty of 500
        const calculatedScore = isCorrect ? Math.max(0, 1000 - Math.round(timePenalty)) : 0;
        
        if (!quiz.answers) quiz.answers = {};
        if (!quiz.answers[question.id]) quiz.answers[question.id] = {};
        
        quiz.answers[question.id][userId] = { optionIndex, isCorrect, score: calculatedScore };
        quiz.leaderboard[userId] = (quiz.leaderboard[userId] || 0) + calculatedScore;

        transaction.update(roomRef, { activeQuiz: quiz });
    });
}


export const endQuiz = async (chatRoomId: string, showResults: boolean) => {
     const roomRef = doc(db, 'chatRooms', chatRoomId);
      await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Room not found");
        
        const room = roomDoc.data() as ChatRoom;
        const quiz = room.activeQuiz;
        if (!quiz) return;

        if (showResults) {
            quiz.status = 'ended';
            delete quiz.currentQuestion;
            delete quiz.currentQuestionStartTime;
            transaction.update(roomRef, { activeQuiz: quiz });
        } else {
            transaction.update(roomRef, { activeQuiz: null });
        }
    });
}
