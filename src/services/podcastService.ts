import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export interface Podcast {
    id: string;
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
    createdAt: any;
    imageUrl: string;
    imageHint: string;
}

export interface PodcastInput {
    title: string;
    description: string;
    host: string;
    hostId: string;
    isLive: boolean;
}

// Create a new podcast
export const createPodcast = async (podcastData: PodcastInput) => {
    try {
        await addDoc(collection(db, 'podcasts'), {
            ...podcastData,
            createdAt: serverTimestamp(),
            // Using a placeholder image for now
            imageUrl: 'https://placehold.co/400x400.png',
            imageHint: 'podcast technology'
        });
    } catch (error) {
        console.error("Error creating podcast: ", error);
        throw new Error("Could not create podcast.");
    }
};

// Get a real-time stream of all podcasts
export const getPodcasts = (callback: (podcasts: Podcast[]) => void) => {
    const q = query(collection(db, 'podcasts'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const podcasts: Podcast[] = [];
        querySnapshot.forEach((doc) => {
            podcasts.push({ id: doc.id, ...doc.data() } as Podcast);
        });
        callback(podcasts);
    });

    return unsubscribe;
};


// Get a single podcast by ID
export const getPodcastById = async (id: string): Promise<Podcast | null> => {
    try {
        const docRef = doc(db, 'podcasts', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Podcast;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error getting podcast: ", error);
        throw new Error("Could not retrieve podcast.");
    }
};
