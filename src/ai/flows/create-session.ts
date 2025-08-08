
'use server';
/**
 * @fileOverview A flow for creating a new chat room (session).
 * This flow handles the creation of a chat room and adds the host as the first participant.
 * It is designed to be called from an authenticated context.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

const CreateSessionInputSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  isLive: z.boolean(),
  isPrivate: z.boolean(),
  scheduledAt: z.date().optional(),
  hostId: z.string(),
  hostEmail: z.string().email(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionInputSchema>;

const CreateSessionOutputSchema = z.object({
    chatRoomId: z.string(),
});

export async function createSession(input: CreateSessionInput): Promise<{ chatRoomId: string }> {
  return createSessionFlow(input);
}

const createSessionFlow = ai.defineFlow(
  {
    name: 'createSessionFlow',
    inputSchema: CreateSessionInputSchema,
    outputSchema: CreateSessionOutputSchema,
  },
  async (input) => {
    const { hostId, hostEmail, ...chatRoomData } = input;

    if (!hostId || !hostEmail) {
      throw new Error("Authentication failed, host details not available.");
    }

    const chatRoomRef = doc(collection(db, 'chatRooms'));
    
    await runTransaction(db, async (transaction) => {
      // 1. READ user profile to get username and photoURL
      const userProfileRef = doc(db, 'users', hostId);
      const userProfileSnap = await transaction.get(userProfileRef);
      if (!userProfileSnap.exists()) {
        throw new Error("User profile not found. Cannot create session.");
      }
      const userProfile = userProfileSnap.data();
      const hostName = userProfile?.username || hostEmail;
      const hostPhotoUrl = userProfile?.photoURL || '';

      // 2. WRITE the new chat room document
      transaction.set(chatRoomRef, {
        ...chatRoomData,
        host: hostName,
        hostId: hostId,
        createdAt: serverTimestamp(),
        imageUrl: '', 
        imageHint: '' 
      });

      // 3. WRITE the host as the first participant with 'approved' status
      const participantRef = doc(db, 'chatRooms', chatRoomRef.id, 'participants', hostId);
      transaction.set(participantRef, {
        userId: hostId,
        displayName: hostName,
        photoURL: hostPhotoUrl,
        status: 'approved', // Host is always approved
        requestCount: 0,
      });
    });

    return { chatRoomId: chatRoomRef.id };
  }
);
