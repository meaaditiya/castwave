
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, documentId, onSnapshot, writeBatch, runTransaction, increment, limit } from 'firebase/firestore';
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

// Follow another user
export const followUser = async (currentUserId: string, targetUserId: string) => {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    const batch = writeBatch(db);

    // Add target to current user's "following" subcollection
    const followingRef = doc(collection(currentUserRef, 'following'), targetUserId);
    batch.set(followingRef, { timestamp: new Date() });
    // Increment current user's "followingCount"
    batch.update(currentUserRef, { followingCount: increment(1) });

    // Add current user to target's "followers" subcollection
    const followerRef = doc(collection(targetUserRef, 'followers'), currentUserId);
    batch.set(followerRef, { timestamp: new Date() });
    // Increment target user's "followerCount"
    batch.update(targetUserRef, { followerCount: increment(1) });
    
    await batch.commit();
}

// Unfollow a user
export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    const batch = writeBatch(db);

    // Remove target from current user's "following" subcollection
    const followingRef = doc(collection(currentUserRef, 'following'), targetUserId);
    batch.delete(followingRef);
    // Decrement current user's "followingCount"
    batch.update(currentUserRef, { followingCount: increment(-1) });

    // Remove current user from target's "followers" subcollection
    const followerRef = doc(collection(targetUserRef, 'followers'), currentUserId);
    batch.delete(followerRef);
    // Decrement target user's "followerCount"
    batch.update(targetUserRef, { followerCount: increment(-1) });
    
    await batch.commit();
}


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
        const data = doc.data() as UserProfileData;
        callback({
            followers: data?.followerCount || 0,
            following: data?.followingCount || 0
        });
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
    // Get list of users that the current user is already following
    const followingList = await getFollowingList(userId);
    const usersToExclude = [userId, ...followingList];

    const usersRef = collection(db, 'users');
    // Firestore's `not-in` query has a limit of 10 values. 
    // If a user follows more than 9 people, this query will fail.
    // The robust solution is to fetch all and filter client-side,
    // but for this app, we'll assume a user won't follow that many and use a query.
    // For a production app, pagination and client-side filtering would be better.
    let q;
    if (usersToExclude.length > 0 && usersToExclude.length <= 10) {
      q = query(usersRef, where(documentId(), 'not-in', usersToExclude), limit(5));
    } else {
      // Fallback if there are too many users to exclude or none to exclude
      q = query(usersRef, limit(20));
    }
    
    const snapshot = await getDocs(q);
    
    const allUsers = snapshot.docs.map(doc => doc.data() as UserProfileData);
    
    // If we used the fallback query, we need to filter now
    if (usersToExclude.length > 10 || usersToExclude.length === 0) {
        const excludeSet = new Set(usersToExclude);
        const filteredUsers = allUsers.filter(user => !excludeSet.has(user.uid));
        return filteredUsers.slice(0, 5);
    }
    
    return allUsers;
};
