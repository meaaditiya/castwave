
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export interface UserProfileData {
    uid: string;
    username: string;
    email: string;
    emailVerified: boolean;
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
            };
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        throw new Error("Could not fetch user profile.");
    }
};

export const isUsernameTaken = async (username: string): Promise<boolean> => {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error("Error checking if username is taken:", error);
        // Default to true to be safe and prevent accidental overwrites
        return true; 
    }
};
    
