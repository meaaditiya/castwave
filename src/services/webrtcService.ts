
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import Peer from 'simple-peer';

const getSignalsCollection = (chatRoomId: string) => collection(db, 'chatRooms', chatRoomId, 'webrtc_signals');

interface SignalData {
  userId: string;
  signal: Peer.SignalData;
  type: 'offer' | 'answer';
}

// Host creates an offer
export const createOffer = async (chatRoomId: string, userId: string, offerSignal: Peer.SignalData) => {
    const offerDocRef = doc(getSignalsCollection(chatRoomId), userId);
    await setDoc(offerDocRef, {
      userId,
      signal: JSON.parse(JSON.stringify(offerSignal)), // Serialize signal data
      type: 'offer',
    });
};

// Participant listens for offers
export const listenForOffers = (chatRoomId: string, callback: (offer: SignalData) => void) => {
  const q = query(getSignalsCollection(chatRoomId), where('type', '==', 'offer'));

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const offer = change.doc.data() as SignalData;
        callback(offer);
      }
      if (change.type === 'removed') {
         // This can be used to signal the stream has ended.
         // A more robust implementation might have explicit "end" signals.
         callback({} as SignalData); // Trigger cleanup
      }
    });
  });
};

// Participant creates an answer
export const createAnswer = async (chatRoomId: string, hostId: string, userId: string, answerSignal: Peer.SignalData) => {
  const answerDocRef = doc(collection(db, 'chatRooms', chatRoomId, 'webrtc_signals', hostId, 'answers'), userId);
  await setDoc(answerDocRef, {
    userId,
    signal: JSON.parse(JSON.stringify(answerSignal)),
    type: 'answer',
  });
};

// Host listens for answers
export const listenForAnswers = (chatRoomId: string, hostId: string, callback: (answer: SignalData) => void) => {
  const answersCol = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals', hostId, 'answers');
  return onSnapshot(answersCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback(change.doc.data() as SignalData);
      }
    });
  });
};

// Clear signals when the stream ends
export const clearSignals = async (chatRoomId: string, hostId: string) => {
    const offerDocRef = doc(getSignalsCollection(chatRoomId), hostId);
    await deleteDoc(offerDocRef).catch(e => console.warn("Could not delete offer doc", e));

    const answersCol = collection(db, 'chatRooms', chatRoomId, 'webrtc_signals', hostId, 'answers');
    const answersSnapshot = await getDocs(answersCol);
    const deletePromises = answersSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises).catch(e => console.warn("Could not delete answers", e));
};
