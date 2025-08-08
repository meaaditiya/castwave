
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
        throw new Error("Could not fetch user profile.");
    }
};

export const isUsernameTaken = async (username: string, currentUserId?: string): Promise<boolean> => {
    const usersRef = collection(db, 'users');
    // This query now runs on the client and is only used for profile updates, not signup.
    const q = query(usersRef, where('username', '==', username));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return false;
        }
        
        if (currentUserId) {
            const isTakenByAnotherUser = querySnapshot.docs.some(doc => doc.id !== currentUserId);
            return isTakenByAnotherUser;
        }

        // For non-signup scenarios, if we find any user, it's taken.
        return true;

    } catch (error) {
        console.error("Error checking username existence:", error);
        // To be safe, if the query fails, prevent the username from being taken.
        return true;
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
