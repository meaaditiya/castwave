
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, documentId, onSnapshot } from 'firebase/firestore';

export interface UserProfileData {
    uid: string;
    username: string;
    email?: string;
    emailVerified: boolean;
    phoneNumber?: string;
    phoneVerified?: boolean;
    photoURL?: string;
}

export const getUserProfile = async (userId: string): Promise<UserProfileData | null> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            return docSnap.data() as UserProfileData;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        // Re-throw the original error to get more specific details in the console
        throw error;
    }
};

export const getUserProfileStream = (userId: string, callback: (profile: UserProfileData | null) => void) => {
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            callback(docSnap.data() as UserProfileData);
        } else {
            callback(null);
        }
    });
    return unsubscribe;
};
