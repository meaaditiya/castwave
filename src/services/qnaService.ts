import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

export interface QnaQuestion {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  upvotes: number;
  upvoterIds: string[];
  isAnswered: boolean;
  createdAt: any;
}

// Get real-time updates for all questions in a chat room
export const getQnaQuestionsStream = (
  chatRoomId: string,
  callback: (questions: QnaQuestion[]) => void,
  onError: (error: Error) => void
) => {
  const qnaCol = collection(db, 'chatRooms', chatRoomId, 'qna');
  const q = query(qnaCol, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QnaQuestion));
    callback(questions);
  }, onError);

  return unsubscribe;
};

// Add a new question
export const askQuestion = async (
  chatRoomId: string,
  text: string,
  authorId: string,
  authorName: string
) => {
  if (!text.trim()) {
    throw new Error('Question cannot be empty.');
  }
  const qnaCol = collection(db, 'chatRooms', chatRoomId, 'qna');
  await addDoc(qnaCol, {
    text,
    authorId,
    authorName,
    upvotes: 0,
    upvoterIds: [],
    isAnswered: false,
    createdAt: serverTimestamp(),
  });
};

// Upvote or remove upvote for a question
export const toggleUpvoteQuestion = async (
  chatRoomId: string,
  questionId: string,
  userId: string
) => {
  const questionRef = doc(db, 'chatRooms', chatRoomId, 'qna', questionId);

  await runTransaction(db, async (transaction) => {
    const questionDoc = await transaction.get(questionRef);
    if (!questionDoc.exists()) {
      throw new Error('Question not found.');
    }
    const questionData = questionDoc.data() as QnaQuestion;

    if (questionData.upvoterIds.includes(userId)) {
      // User has already upvoted, so remove upvote
      transaction.update(questionRef, {
        upvotes: questionData.upvotes - 1,
        upvoterIds: arrayRemove(userId),
      });
    } else {
      // User has not upvoted, so add upvote
      transaction.update(questionRef, {
        upvotes: questionData.upvotes + 1,
        upvoterIds: arrayUnion(userId),
      });
    }
  });
};

// Mark a question as answered (host only)
export const markQuestionAsAnswered = async (
  chatRoomId: string,
  questionId: string
) => {
  const questionRef = doc(db, 'chatRooms', chatRoomId, 'qna', questionId);
  await updateDoc(questionRef, { isAnswered: true });
};
