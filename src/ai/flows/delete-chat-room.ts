
'use server';
/**
 * @fileOverview A flow for deleting a chat room and all its sub-collections.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';

const DeleteChatRoomInputSchema = z.object({
  chatRoomId: z.string().describe('The ID of the chat room to delete.'),
});
export type DeleteChatRoomInput = z.infer<typeof DeleteChatRoomInputSchema>;

export async function deleteChatRoom(input: DeleteChatRoomInput): Promise<{ success: boolean }> {
  return deleteChatRoomFlow(input);
}

const deleteChatRoomFlow = ai.defineFlow(
  {
    name: 'deleteChatRoomFlow',
    inputSchema: DeleteChatRoomInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ chatRoomId }) => {
    try {
        const batch = writeBatch(db);

        // Delete polls
        const pollsRef = collection(db, 'chatRooms', chatRoomId, 'polls');
        const pollsSnap = await getDocs(pollsRef);
        pollsSnap.forEach(doc => batch.delete(doc.ref));

        // Delete messages
        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.forEach(doc => batch.delete(doc.ref));

        // Delete participants
        const participantsRef = collection(db, 'chatRooms', chatRoomId, 'participants');
        const participantsSnap = await getDocs(participantsRef);
        participantsSnap.forEach(doc => batch.delete(doc.ref));

        // Delete the main chat room document
        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
        batch.delete(chatRoomRef);

        await batch.commit();
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting chat room in flow:', error);
        // We re-throw the error so the client can handle it.
        throw new Error('Could not delete chat room and its data.');
    }
  }
);
