
'use server';
/**
 * @fileOverview A flow for creating a new chat room.
 * This flow handles the creation of a chat room using a provided thumbnail URL.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { addParticipant } from '@/services/chatRoomService';

const CreateChatRoomFlowInputSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  host: z.string(),
  hostId: z.string(),
  isLive: z.boolean(),
  scheduledAt: z.date().optional(),
  imageUrl: z.string().optional().describe('The public URL of the chat room thumbnail.'),
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
    const docRef = await addDoc(collection(db, 'chatRooms'), {
        title: input.title,
        description: input.description,
        host: input.host,
        hostId: input.hostId,
        isLive: input.isLive,
        createdAt: serverTimestamp(),
        scheduledAt: input.scheduledAt || null,
        imageUrl: input.imageUrl || 'https://placehold.co/400x400.png',
        imageHint: 'community discussion'
    });

    // Automatically add the host as an approved participant
    await addParticipant(docRef.id, {
        userId: input.hostId,
        displayName: input.host,
        status: 'approved'
    });
    
    return { chatRoomId: docRef.id };
  }
);
