
'use server';
/**
 * @fileOverview A flow to securely check if a username is already taken.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase-admin'; // Using admin SDK for trusted access

const IsUsernameTakenInputSchema = z.object({
  username: z.string().describe('The username to check for existence.'),
});
export type IsUsernameTakenInput = z.infer<typeof IsUsernameTakenInputSchema>;

const IsUsernameTakenOutputSchema = z.object({
  isTaken: z.boolean(),
});
export type IsUsernameTakenOutput = z.infer<typeof IsUsernameTakenOutputSchema>;


export async function isUsernameTaken(input: IsUsernameTakenInput): Promise<IsUsernameTakenOutput> {
  return isUsernameTakenFlow(input);
}

const isUsernameTakenFlow = ai.defineFlow(
  {
    name: 'isUsernameTakenFlow',
    inputSchema: IsUsernameTakenInputSchema,
    outputSchema: IsUsernameTakenOutputSchema,
  },
  async ({ username }) => {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).limit(1).get();
    
    return {
      isTaken: !snapshot.empty,
    };
  }
);
