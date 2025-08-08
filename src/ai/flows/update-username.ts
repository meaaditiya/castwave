
'use server';
/**
 * @fileOverview A flow for updating a user's username across the application.
 * This flow ensures data consistency by updating the username in the user's profile,
 * any chat rooms they host, and all of their participant records.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin';

const UpdateUsernameInputSchema = z.object({
  userId: z.string(),
  newUsername: z.string().min(3, 'Username must be at least 3 characters.'),
  currentUsername: z.string(),
});
export type UpdateUsernameInput = z.infer<typeof UpdateUsernameInputSchema>;

export async function updateUsername(input: UpdateUsernameInput): Promise<{ success: boolean; message: string }> {
  return updateUsernameFlow(input);
}

const updateUsernameFlow = ai.defineFlow(
  {
    name: 'updateUsernameFlow',
    inputSchema: UpdateUsernameInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async ({ userId, newUsername, currentUsername }) => {
    
    if (newUsername === currentUsername) {
        return { success: true, message: 'Username is the same.' };
    }

    try {
        // Check if the new username is already taken
        const usernameQuery = db.collection('users').where('username', '==', newUsername);
        const usernameSnapshot = await usernameQuery.get();
        if (!usernameSnapshot.empty) {
            const isTakenByAnotherUser = usernameSnapshot.docs.some(doc => doc.id !== userId);
            if (isTakenByAnotherUser) {
                return { success: false, message: 'This username is already taken.' };
            }
        }

        const batch = db.batch();

        // 1. Update the main user profile
        const userDocRef = db.collection('users').doc(userId);
        batch.update(userDocRef, { username: newUsername });

        // 2. Update the 'host' field in all chat rooms created by this user
        const userHostedRoomsQuery = db.collection('chatRooms').where('hostId', '==', userId);
        const hostedRoomsSnapshot = await userHostedRoomsQuery.get();
        hostedRoomsSnapshot.forEach(doc => {
            batch.update(doc.ref, { host: newUsername });
        });

        // 3. Update the 'displayName' in all participant subcollections for this user
        // Using a collection group query to find all participant records for the user
        const participantDocsQuery = db.collectionGroup('participants').where('userId', '==', userId);
        const participantDocsSnapshot = await participantDocsQuery.get();
        participantDocsSnapshot.forEach(doc => {
            batch.update(doc.ref, { displayName: newUsername });
        });

        await batch.commit();
        return { success: true, message: 'Username updated successfully!' };

    } catch (error) {
        console.error("Error in updateUsernameFlow:", error);
        // We should not expose internal error details to the client.
        return { success: false, message: 'An unexpected error occurred while updating.' };
    }
  }
);
