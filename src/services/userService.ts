
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

    