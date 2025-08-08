
'use server';
/**
 * @fileOverview A flow for checking if a username is already taken by another user.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';

const CheckUsernameInputSchema = z.object({
  username: z.string().describe('The username to check for availability.'),
  currentUserId: z.string().optional().describe('The ID of the current user to exclude from the check.'),
});
export type CheckUsernameInput = z.infer<typeof CheckUsernameInputSchema>;

const CheckUsernameOutputSchema = z.object({
  isTaken: z.boolean().describe('Whether the username is already taken.'),
});
export type CheckUsernameOutput = z.infer<typeof CheckUsernameOutputSchema>;


export async function checkUsername(input: CheckUsernameInput): Promise<CheckUsernameOutput> {
  return checkUsernameFlow(input);
}

const checkUsernameFlow = ai.defineFlow(
  {
    name: 'checkUsernameFlow',
    inputSchema: CheckUsernameInputSchema,
    outputSchema: CheckUsernameOutputSchema,
  },
  async ({ username, currentUserId }) => {
    const usersRef = collection(db, 'users');
    let q;

    if (currentUserId) {
        // Check for other users with the same username, excluding the current user.
        q = query(usersRef, where('username', '==', username), where(documentId(), "!=", currentUserId));
    } else {
        // If no userId is provided (e.g., during signup), check against all users.
        q = query(usersRef, where('username', '==', username));
    }
    
    const querySnapshot = await getDocs(q);
    
    return { isTaken: !querySnapshot.empty };
  }
);
