
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, documentId, onSnapshot, writeBatch, runTransaction, increment, limit, serverTimestamp, Transaction, Query, collectionGroup } from 'firebase/firestore';
import { ChatRoom } from './chatRoomService';

export interface UserProfileData {
    uid: string;
    username: string;
    email: string;
    emailVerified: boolean;
    photoURL?: string;
    followerCount: number;
    followingCount: number;
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

// Follow another user
export const followUser = async (currentUserId: string, targetUserId: string) => {
    if (currentUserId === targetUserId) {
        throw new Error("You cannot follow yourself.");
    }
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

    try {
        await runTransaction(db, async (transaction) => {
            const followingDoc = await transaction.get(followingRef);
            if (followingDoc.exists()) {
                console.log("Already following.");
                return; // Exit if already following
            }

            // Perform writes
            transaction.set(followingRef, { timestamp: serverTimestamp() });
            transaction.set(followerRef, { timestamp: serverTimestamp() });
            transaction.update(currentUserRef, { followingCount: increment(1) });
            transaction.update(targetUserRef, { followerCount: increment(1) });
        });
    } catch (error) {
        console.error("Follow transaction failed: ", error);
        throw new Error("Could not follow user. Please try again.");
    }
};

// Unfollow a user
export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

    try {
        await runTransaction(db, async (transaction) => {
             const followingDoc = await transaction.get(followingRef);
             if (!followingDoc.exists()) {
                // To be robust, ensure counts are correct even if docs are missing
                const currentUserDoc = await transaction.get(currentUserRef);
                const targetUserDoc = await transaction.get(targetUserRef);
                if (currentUserDoc.exists() && (currentUserDoc.data().followingCount || 0) > 0) {
                     transaction.update(currentUserRef, { followingCount: increment(-1) });
                }
                if (targetUserDoc.exists() && (targetUserDoc.data().followerCount || 0) > 0) {
                    transaction.update(targetUserRef, { followerCount: increment(-1) });
                }
                return;
             }

            // Perform deletes and updates
            transaction.delete(followingRef);
            transaction.delete(followerRef);
            transaction.update(currentUserRef, { followingCount: increment(-1) });
            transaction.update(targetUserRef, { followerCount: increment(-1) });
        });
    } catch (error) {
        console.error("Unfollow transaction failed: ", error);
        throw new Error("Could not unfollow user. Please try again.");
    }
};


// Check if the current user is following the target user
export const getFollowStatus = (currentUserId: string, targetUserId: string, callback: (isFollowing: boolean) => void) => {
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    return onSnapshot(followingRef, (doc) => {
        callback(doc.exists());
    });
}

// Get follower and following counts
export const getFollowCounts = (userId: string, callback: (counts: {followers: number, following: number}) => void) => {
    const userRef = doc(db, 'users', userId);
    return onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data() as UserProfileData;
            callback({
                followers: data?.followerCount || 0,
                following: data?.followingCount || 0
            });
        }
    });
}

// Get a list of users the current user is following
const getFollowingList = async (userId: string): Promise<string[]> => {
    const followingCol = collection(db, 'users', userId, 'following');
    const snapshot = await getDocs(followingCol);
    return snapshot.docs.map(doc => doc.id);
}

// Get the feed (public chat rooms from followed users)
export const getFeedForUser = async (userId: string): Promise<ChatRoom[]> => {
    const followingIds = await getFollowingList(userId);

    if (followingIds.length === 0) {
        return [];
    }

    const roomsRef = collection(db, 'chatRooms');
    const q = query(
        roomsRef, 
        where('hostId', 'in', followingIds),
        where('isPrivate', '==', false)
    );

    const snapshot = await getDocs(q);
    const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatRoom));
    
    // Sort by creation date descending
    return rooms.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
};

export const getUserSuggestions = async (userId: string): Promise<UserProfileData[]> => {
    const followingList = await getFollowingList(userId);
    const usersToExclude = [userId, ...followingList];

    const usersRef = collection(db, 'users');
    let q: Query;

    q = query(usersRef, limit(50));
    
    const snapshot = await getDocs(q);
    
    const allUsers = snapshot.docs.map(doc => doc.data() as UserProfileData);
    
    // Filter out the current user and people they already follow
    const filteredUsers = allUsers.filter(user => !usersToExclude.includes(user.uid));
    
    // Shuffle and take the first 5
    const shuffled = filteredUsers.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
};
