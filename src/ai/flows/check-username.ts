
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
  // This check now runs directly on the client, leveraging Firestore rules.
  // The Genkit flow is no longer required for this operation.
  // This function is kept for structural consistency but the core logic is moved.
  const { username, currentUserId } = input;
  const usersRef = collection(db, 'users');

  const q = query(usersRef, where('username', '==', username));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return { isTaken: false };
  }

  if (currentUserId) {
    // If a user ID is provided, check if the found username belongs to a different user.
    const isTakenByOther = querySnapshot.docs.some(doc => doc.id !== currentUserId);
    return { isTaken: isTakenByOther };
  }

  // If no user ID is provided (e.g., signup), any match means it's taken.
  return { isTaken: true };
}
