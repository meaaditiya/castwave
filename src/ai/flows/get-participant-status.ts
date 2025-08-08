
'use server';
/**
 * @fileOverview A secure flow for a user to check their own participant status in a chat room.
 * This flow runs on the server and bypasses client-side permission issues.
 * It will also create a 'pending' participant record if one does not exist for the user.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Participant } from '@/services/chatRoomService';
import { getUserProfile } from '@/services/userService';

// This is the Zod schema for the participant data we expect to return to the client.
// It's a subset of the full Participant interface.
const ParticipantSchemaForOutput = z.object({
  id: z.string(),
  userId: z.string(),
  displayName: z.string(),
  status: z.enum(['pending', 'approved', 'removed', 'denied']),
  requestCount: z.number().optional(),
  emailVerified: z.boolean(),
  photoURL: z.string().optional(),
});


const GetParticipantStatusInputSchema = z.object({
  chatRoomId: z.string().describe('The ID of the chat room.'),
  userId: z.string().describe('The ID of the user whose status is being checked.'),
  displayName: z.string().describe("The user's display name, used if creating the participant."),
  photoURL: z.string().optional().describe("The user's photo URL, used if creating the participant."),
  emailVerified: z.boolean().describe("The user's email verification status."),
});
export type GetParticipantStatusInput = z.infer<typeof GetParticipantStatusInputSchema>;

// The output will be a participant object, or null if something went wrong.
const GetParticipantStatusOutputSchema = z.object({
  participant: ParticipantSchemaForOutput.nullable().describe('The participant object, or null if not found.'),
});
export type GetParticipantStatusOutput = z.infer<typeof GetParticipantStatusOutputSchema>;


export async function getParticipantStatus(input: GetParticipantStatusInput): Promise<GetParticipantStatusOutput> {
  // We call the Genkit flow to execute the logic.
  return getParticipantStatusFlow(input);
}

const getParticipantStatusFlow = ai.defineFlow(
  {
    name: 'getParticipantStatusFlow',
    inputSchema: GetParticipantStatusInputSchema,
    outputSchema: GetParticipantStatusOutputSchema,
  },
  async ({ chatRoomId, userId, displayName, photoURL, emailVerified }) => {
    try {
      const participantRef = doc(db, 'chatRooms', chatRoomId, 'participants', userId);
      let docSnap = await getDoc(participantRef);

      // If the participant document does not exist, create it.
      // This is the crucial step that must happen on the server.
      if (!docSnap.exists()) {
        const userProfile = await getUserProfile(userId);
        const newParticipant: Omit<Participant, 'id'> = {
          userId: userId,
          displayName: userProfile?.username || displayName,
          status: 'pending', // Default status is 'pending'
          requestCount: 1,
          photoURL: userProfile?.photoURL || photoURL || '',
          emailVerified: userProfile?.emailVerified || emailVerified,
        };
        // Securely set the new participant document from the server.
        await setDoc(participantRef, newParticipant);
        // Re-fetch the document to get the data we just wrote.
        docSnap = await getDoc(participantRef);
      }

      // If the document exists (either it was there before or we just created it),
      // return its data.
      if (docSnap.exists()) {
         const participant = { id: docSnap.id, ...docSnap.data() } as Participant;
         return { participant };
      }
      
      // If for some reason it still doesn't exist, return null.
      return { participant: null };

    } catch (error) {
      console.error("Error in getParticipantStatusFlow: ", error);
      // It's important not to leak detailed error messages to the client.
      throw new Error("An internal error occurred while fetching participant status.");
    }
  }
);
