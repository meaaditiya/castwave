
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
    // Query for any user with the given username.
    const q = query(usersRef, where('username', '==', username));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // No users have this username, so it's not taken.
            return false;
        }
        
        // If a currentUserId is provided, we need to check if the found user is someone else.
        if (currentUserId) {
            // Check if any of the documents found have a different ID.
            const isTakenByAnotherUser = querySnapshot.docs.some(doc => doc.id !== currentUserId);
            return isTakenByAnotherUser;
        }

        // If no currentUserId is provided (like during signup), then any result means it's taken.
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

    