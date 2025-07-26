
'use server';
/**
 * @fileOverview A flow for creating a new chat room.
 * This flow handles the creation of a chat room.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { addParticipant } from '@/services/chatRoomService';
import { generateThumbnailSvg } from '@/lib/thumbnail';

const CreateChatRoomFlowInputSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  host: z.string(),
  hostId: z.string(),
  isLive: z.boolean(),
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
    const thumbnailUrl = `data:image/svg+xml;base64,${btoa(generateThumbnailSvg(input.title))}`;
    
    const docRef = await addDoc(collection(db, 'chatRooms'), {
        title: input.title,
        description: input.description,
        host: input.host,
        hostId: input.hostId,
        isLive: input.isLive,
        createdAt: serverTimestamp(),
        scheduledAt: input.scheduledAt || null,
        imageUrl: thumbnailUrl,
        imageHint: 'abstract art'
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
