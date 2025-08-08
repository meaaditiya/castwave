
'use server';
/**
 * @fileOverview A flow for creating a new chat room.
 * This flow handles the creation of a chat room and adds the host as the first participant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, runTransaction, serverTimestamp, getDoc } from 'firebase/firestore';

const CreateChatRoomFlowInputSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  host: z.string(),
  hostId: z.string(),
  isLive: z.boolean(),
  isPrivate: z.boolean(),
  scheduledAt: z.date().optional(),
});
export type CreateChatRoomFlowInput = z.infer<typeof CreateChatRoomFlowInputSchema>;

export async function createChatRoomFlow(input: CreateChatRoomFlowInput): Promise<{ chatRoomId: string }> {
  return createChatRoomFlowFn(input);
}

const createChatRoomFlowFn = ai.defineFlow(
  {
    name: 'createChatRoomFlow',
    inputSchema: CreateChatRoomFlowInputSchema,
    outputSchema: z.object({ chatRoomId: z.string() }),
  },
  async (input) => {
    const chatRoomRef = doc(collection(db, 'chatRooms'));
    
    await runTransaction(db, async (transaction) => {
      // Create the chat room document
      transaction.set(chatRoomRef, {
        title: input.title,
        description: input.description,
        host: input.host,
        hostId: input.hostId,
        isLive: input.isLive,
        isPrivate: input.isPrivate,
        createdAt: serverTimestamp(),
        scheduledAt: input.scheduledAt || null,
        imageUrl: '',
        imageHint: ''
      });

      // Get user profile to fetch photoURL
      const userProfileRef = doc(db, 'users', input.hostId);
      const userProfileSnap = await transaction.get(userProfileRef);
      const userProfile = userProfileSnap.exists() ? userProfileSnap.data() : null;
      
      // Automatically add the host as a participant
      const participantRef = doc(db, 'chatRooms', chatRoomRef.id, 'participants', input.hostId);
      transaction.set(participantRef, {
        userId: input.hostId,
        displayName: input.host,
        emailVerified: userProfile?.emailVerified ?? false,
        photoURL: userProfile?.photoURL || ''
      });
    });

    return { chatRoomId: chatRoomRef.id };
  }
);
