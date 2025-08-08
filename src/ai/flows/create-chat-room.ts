
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
  isLive: z.boolean(),
  isPrivate: z.boolean(),
  scheduledAt: z.date().optional(),
  hostId: z.string(),
  hostEmail: z.string().email(),
});
export type CreateChatRoomFlowInput = z.infer<typeof CreateChatRoomFlowInputSchema>;

export async function createChatRoomFlow(input: CreateChatRoomFlowInput): Promise<{ chatRoomId: string }> {
    const { hostId, hostEmail, ...chatRoomData } = input;
    
    if (!hostId) {
        throw new Error("Authentication failed, user ID not available.");
    }
    
    const chatRoomRef = doc(collection(db, 'chatRooms'));
    
    await runTransaction(db, async (transaction) => {
      // READ FIRST: Get user profile to fetch photoURL and username
      const userProfileRef = doc(db, 'users', hostId);
      const userProfileSnap = await transaction.get(userProfileRef);
      if (!userProfileSnap.exists()) {
        throw new Error("User profile not found.");
      }
      const userProfile = userProfileSnap.data();
      const hostName = userProfile?.username || hostEmail || 'Anonymous Host';
      
      // WRITE SECOND: Create the chat room document
      transaction.set(chatRoomRef, {
        ...chatRoomData,
        host: hostName,
        hostId: hostId,
        createdAt: serverTimestamp(),
        imageUrl: '',
        imageHint: ''
      });
      
      // WRITE THIRD: Automatically add the host as a participant with 'approved' status
      const participantRef = doc(db, 'chatRooms', chatRoomRef.id, 'participants', hostId);
      transaction.set(participantRef, {
        userId: hostId,
        displayName: hostName,
        photoURL: userProfile?.photoURL || '',
        status: 'approved',
        requestCount: 0,
      });
    });

    return { chatRoomId: chatRoomRef.id };
}

ai.defineFlow(
  {
    name: 'createChatRoomFlow',
    inputSchema: CreateChatRoomFlowInputSchema,
    outputSchema: z.object({ chatRoomId: z.string() }),
  },
  createChatRoomFlow
);
