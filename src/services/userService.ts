
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
                 console.log("Not following, cannot unfollow.");
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
};

// Check follow status for a list of users
export const getMultipleFollowStatus = async (currentUserId: string, targetUserIds: string[]): Promise<Record<string, boolean>> => {
    if (!targetUserIds.length) {
        return {};
    }
    const followingRef = collection(db, 'users', currentUserId, 'following');
    const q = query(followingRef, where(documentId(), 'in', targetUserIds));
    const snapshot = await getDocs(q);
    const followingSet = new Set(snapshot.docs.map(doc => doc.id));
    
    const status: Record<string, boolean> = {};
    targetUserIds.forEach(id => {
        status[id] = followingSet.has(id);
    });
    return status;
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

// Get profile data for a list of user IDs
const getProfilesFromIds = async (uids: string[]): Promise<UserProfileData[]> => {
    if (uids.length === 0) return [];
    const usersRef = collection(db, 'users');
    // Firestore 'in' queries are limited to 30 items.
    // For this app, we'll assume lists won't exceed this, but for larger scale, this would need chunking.
    const q = query(usersRef, where(documentId(), 'in', uids.slice(0, 30)));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserProfileData);
}

// Get full profiles of users someone is following
export const getFollowingProfiles = async (userId: string): Promise<UserProfileData[]> => {
    const followingIds = await getFollowingList(userId);
    return getProfilesFromIds(followingIds);
}

// Get full profiles of a user's followers
export const getFollowerProfiles = async (userId: string): Promise<UserProfileData[]> => {
    const followersCol = collection(db, 'users', userId, 'followers');
    const snapshot = await getDocs(followersCol);
    const followerIds = snapshot.docs.map(doc => doc.id);
    return getProfilesFromIds(followerIds);
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
    
    // Filter out the current user, people they already follow, and users without a username
    const filteredUsers = allUsers.filter(user => 
        !usersToExclude.includes(user.uid) && user.username
    );
    
    // Shuffle and take the first 5
    const shuffled = filteredUsers.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
};
