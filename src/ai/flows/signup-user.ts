
'use server';
/**
 * @fileOverview A secure flow for handling user signup.
 * This flow checks for username uniqueness, creates the user in Firebase Auth,
 * and sets up their initial profile in Firestore.
 */

import { ai } from '@/ai/genkit';
import { isUsernameTaken } from '@/services/userService';
import { z } from 'zod';
import { auth, db } from '@/lib/firebase-admin'; // Using Admin SDK for trusted operations
import { doc, setDoc } from 'firebase/firestore';


const SignupUserInputSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6),
});
export type SignupUserInput = z.infer<typeof SignupUserInputSchema>;

const SignupUserOutputSchema = z.object({
  uid: z.string().optional(),
  isTaken: z.boolean(),
  error: z.string().optional(),
});
export type SignupUserOutput = z.infer<typeof SignupUserOutputSchema>;


export async function signupUser(input: SignupUserInput): Promise<SignupUserOutput> {
  return signupUserFlow(input);
}


const signupUserFlow = ai.defineFlow(
  {
    name: 'signupUserFlow',
    inputSchema: SignupUserInputSchema,
    outputSchema: SignupUserOutputSchema,
  },
  async ({ username, email, password }) => {
    try {
      // 1. Check if username is already taken using the service
      const taken = await isUsernameTaken(username);
      if (taken) {
        return { isTaken: true };
      }

      // 2. Create the user in Firebase Auth using the Admin SDK
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: username,
      });
      
      // 3. Send a verification email
      await auth.generateEmailVerificationLink(email);

      // 4. Create the user profile document in Firestore
      const userProfile = {
        uid: userRecord.uid,
        email: email,
        username: username,
        emailVerified: false, // Starts as false
        photoURL: '',
        avatarGenerationCount: 0,
      };
      await setDoc(doc(db, 'users', userRecord.uid), userProfile);

      return { uid: userRecord.uid, isTaken: false };

    } catch (error: any) {
      // Handle known Firebase Admin SDK errors
      if (error.code === 'auth/email-already-exists') {
        return { isTaken: false, error: 'auth/email-already-in-use' };
      }
      console.error('Error in signupUserFlow:', error);
      return { isTaken: false, error: error.message || 'An unknown error occurred during signup.' };
    }
  }
);
