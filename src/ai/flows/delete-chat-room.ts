
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

const deleteSubcollection = async (chatRoomId: string, subcollectionName: string, batch: any) => {
    const subcollectionRef = collection(db, 'chatRooms', chatRoomId, subcollectionName);
    const snapshot = await getDocs(subcollectionRef);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    console.log(`Added ${snapshot.size} documents from '${subcollectionName}' to the delete batch.`);
};


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
            console.log(`Chat room ${chatRoomId} does not exist. Considering deletion successful.`);
            return { success: true };
        }

        const chatRoomData = chatRoomSnap.data();
        if (chatRoomData.hostId !== hostId) {
            throw new Error(`User ${hostId} is not authorized to delete chat room ${chatRoomId}.`);
        }
        
        console.log(`User ${hostId} is authorized. Starting deletion process for chat room ${chatRoomId}.`);

        // Create a batch to delete all sub-collection documents.
        const batch = writeBatch(db);

        // Delete all participants
        await deleteSubcollection(chatRoomId, 'participants', batch);
        
        // Delete all messages
        await deleteSubcollection(chatRoomId, 'messages', batch);

        // Delete all polls
        await deleteSubcollection(chatRoomId, 'polls', batch);
        
        // Commit the batch deletion of sub-collections
        console.log('Committing batch deletion of sub-collections...');
        await batch.commit();
        console.log('Sub-collections deleted successfully.');
        
        // Finally, delete the chat room document itself
        console.log(`Deleting main chat room document: ${chatRoomId}`);
        await deleteDoc(chatRoomRef);
        console.log(`Chat room ${chatRoomId} deleted successfully.`);

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting chat room in flow:', error.message, error.stack);
        // We re-throw the error so the client can handle it.
        throw new Error('Could not delete chat room and its data.');
    }
  }
);
