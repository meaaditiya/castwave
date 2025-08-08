'use server';
/**
 * @fileOverview A flow for checking if a username is already taken.
 * This flow is designed to be called from the client-side during signup.
 */

import { ai } from '@/ai/genkit';
import { isUsernameTaken as isUsernameTakenService } from '@/services/userService';
import { z } from 'zod';

const IsUsernameTakenInputSchema = z.object({
  username: z.string().describe("The username to check for availability."),
  userId: z.string().optional().describe("The user ID to exclude from the check, used when a user updates their own username."),
});
export type IsUsernameTakenInput = z.infer<typeof IsUsernameTakenInputSchema>;

const IsUsernameTakenOutputSchema = z.object({
  isTaken: z.boolean().describe("True if the username is taken, false otherwise."),
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
  async ({ username, userId }) => {
    const isTaken = await isUsernameTakenService(username, userId);
    return { isTaken };
  }
);
