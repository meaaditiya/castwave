
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
} from 'firebase/firestore';

const getRtcSubcollection = (chatRoomId: string, subcollection: string) =>
  collection(db, 'chatRooms', chatRoomId, 'rtc', subcollection, 'signals');

// For the initiator
export const initiateCall = async (chatRoomId: string, callerId: string, calleeId: string, offer: any) => {
  const callDoc = doc(getRtcSubcollection(chatRoomId, calleeId), callerId);
  await setDoc(callDoc, { offer });
};

// For the receiver
export const listenForCalls = (chatRoomId: string, userId: string, callback: (callerId: string, offer: any) => void) => {
  const callsRef = getRtcSubcollection(chatRoomId, userId);
  return onSnapshot(callsRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data.offer) {
          callback(change.doc.id, data.offer);
        }
      }
    });
  });
};

// For the receiver after creating an answer
export const answerCall = async (chatRoomId: string, calleeId: string, callerId: string, answer: any) => {
  const callDoc = doc(getRtcSubcollection(chatRoomId, callerId), calleeId);
  await setDoc(callDoc, { answer }, { merge: true });
};


// For the initiator to listen for an answer
export const listenForAnswers = (chatRoomId: string, callerId: string, callback: (answer: any) => void) => {
  const answersRef = getRtcSubcollection(chatRoomId, callerId);
  const q = query(answersRef);
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
            const data = change.doc.data();
            if (data.answer) {
                 callback(data.answer);
            }
        }
    });
  });
};


// For both peers to add ICE candidates
export const addIceCandidate = async (chatRoomId: string, fromId: string, toId: string, candidate: any) => {
  const candidatesCollection = collection(db, 'chatRooms', chatRoomId, 'rtc', toId, 'candidates', fromId, 'ice');
  await setDoc(doc(candidatesCollection), { candidate });
};


// For both peers to listen for ICE candidates
export const listenForIceCandidates = (chatRoomId: string, peerId: string, callback: (candidate: any) => void) => {
    const candidatesCollection = collection(db, 'chatRooms', chatRoomId, 'rtc', peerId, 'candidates');
    const q = query(candidatesCollection);

    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === "added") {
                const subcollectionRef = collection(db, change.doc.ref.path, 'ice');
                const iceSnapshot = await getDocs(subcollectionRef);
                iceSnapshot.docChanges().forEach(iceChange => {
                     if (iceChange.type === 'added') {
                        callback(iceChange.doc.data().candidate);
                    }
                })
            }
        });
    });
};


// To end a call
export const hangUp = async (chatRoomId: string, userId: string, peerIds: string[]) => {
  if (peerIds.length === 0) return;
  const batch = writeBatch(db);

  // Notify peers that this user is hanging up
  for (const peerId of peerIds) {
    const hangupRef = doc(db, 'chatRooms', chatRoomId, 'rtc', peerId, 'hangup', userId);
    batch.set(hangupRef, { hungup: true });
  }

  // Delete own signaling documents
  const callsRef = getRtcSubcollection(chatRoomId, userId);
  const callsSnapshot = await getDocs(callsRef);
  callsSnapshot.forEach(doc => batch.delete(doc.ref));

  await batch.commit();
};

export const listenForHangUps = (chatRoomId: string, callback: (peerId: string) => void) => {
  const hangupCol = collection(db, 'chatRooms', chatRoomId, 'hangup');
  return onSnapshot(hangupCol, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback(change.doc.id);
      }
    });
  });
};
