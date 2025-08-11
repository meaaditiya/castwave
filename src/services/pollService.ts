
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, runTransaction, serverTimestamp, getDocs, writeBatch, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { ChatRoom } from './chatRoomService';
import {nanoid} from 'nanoid';

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
        activeQuiz: newQuiz
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
            quiz.currentQuestionIndex = -1;
            delete quiz.currentQuestion;
            delete quiz.currentQuestionStartTime;
        } else {
            quiz.currentQuestionIndex = nextIndex;
            quiz.status = 'in_progress';
            quiz.currentQuestionStartTime = serverTimestamp();
            quiz.currentQuestion = quiz.questions[nextIndex];
        }
        
        transaction.update(roomRef, { activeQuiz: quiz });
    });
};

export const answerQuizQuestion = async (chatRoomId: string, userId: string, optionIndex: number, score: number) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);

    await runTransaction(db, async (transaction) => {
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw new Error("Chat room not found");

        const room = roomDoc.data() as ChatRoom;
        const quiz = room.activeQuiz;
        
        if (!quiz || !quiz.currentQuestion) throw new Error("No active question.");
        if (quiz.answers?.[quiz.currentQuestion.id]?.[userId]) throw new Error("You have already answered.");
        
        const question = quiz.currentQuestion;
        const isCorrect = question.correctOption === optionIndex;
        const calculatedScore = isCorrect ? Math.round(score * 10) : 0;

        if (!quiz.answers) quiz.answers = {};
        if (!quiz.answers[question.id]) quiz.answers[question.id] = {};
        
        quiz.answers[question.id][userId] = { optionIndex, isCorrect, score: calculatedScore };
        quiz.leaderboard[userId] = (quiz.leaderboard[userId] || 0) + calculatedScore;

        transaction.update(roomRef, { activeQuiz: quiz });
    });
}

export const endQuiz = async (chatRoomId: string) => {
    const roomRef = doc(db, 'chatRooms', chatRoomId);
    await updateDoc(roomRef, {
        activeQuiz: null
    });
}
