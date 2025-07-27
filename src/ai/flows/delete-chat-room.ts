
'use server';
/**
 * @fileOverview A flow for deleting a chat room and all its sub-collections.
 * This flow manually deletes documents in subcollections before deleting the main chat room document.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';

const DeleteChatRoomInputSchema = z.object({
  chatRoomId: z.string().describe('The ID of the chat room to delete.'),
  hostId: z.string().describe('The UID of the user attempting to delete the room, for verification.'),
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
  async ({ chatRoomId, hostId }) => {
    try {
        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
        const chatRoomSnap = await getDoc(chatRoomRef);

        if (!chatRoomSnap.exists()) {
            // If the room doesn't exist, we can consider the deletion successful.
            return { success: true };
        }

        if (chatRoomSnap.data().hostId !== hostId) {
            throw new Error('User is not authorized to delete this chat room.');
        }

        // Delete subcollections in batches
        const batch = writeBatch(db);

        const participantsRef = collection(db, 'chatRooms', chatRoomId, 'participants');
        const participantsSnap = await getDocs(participantsRef);
        participantsSnap.forEach(doc => batch.delete(doc.ref));

        const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.forEach(doc => batch.delete(doc.ref));

        const pollsRef = collection(db, 'chatRooms', chatRoomId, 'polls');
        const pollsSnap = await getDocs(pollsRef);
        pollsSnap.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        
        // Finally, delete the chat room document itself
        await deleteDoc(chatRoomRef);

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting chat room in flow:', error.message, error.stack);
        // We re-throw the error so the client can handle it.
        throw new Error('Could not delete chat room and its data.');
    }
  }
);
