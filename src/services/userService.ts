
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, documentId, onSnapshot } from 'firebase/firestore';

export interface UserProfileData {
    uid: string;
    username: string;
    email: string;
    emailVerified: boolean;
    photoURL?: string;
    avatarGenerationCount?: number;
}

export const getUserProfile = async (userId: string): Promise<UserProfileData | null> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                uid: userId,
                username: data.username,
                email: data.email,
                emailVerified: data.emailVerified,
                photoURL: data.photoURL,
                avatarGenerationCount: data.avatarGenerationCount,
            };
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
            const data = docSnap.data();
            callback({
                uid: userId,
                username: data.username,
                email: data.email,
                emailVerified: data.emailVerified,
                photoURL: data.photoURL,
            });
        } else {
            callback(null);
        }
    });
    return unsubscribe;
};
