
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

const GetParticipantStatusOutputSchema = z.object({
  participant: ParticipantSchemaForOutput.nullable().describe('The participant object, or null if not found.'),
});
export type GetParticipantStatusOutput = z.infer<typeof GetParticipantStatusOutputSchema>;


export async function getParticipantStatus(input: GetParticipantStatusInput): Promise<GetParticipantStatusOutput> {
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

      if (!docSnap.exists()) {
        // Participant does not exist, create them with 'pending' status.
        const newParticipant: Omit<Participant, 'id'> = {
          userId: userId,
          displayName: displayName,
          status: 'pending',
          requestCount: 1,
          photoURL: photoURL || '',
          emailVerified: emailVerified,
        };
        await setDoc(participantRef, newParticipant);
        // Re-fetch the document to return it
        docSnap = await getDoc(participantRef);
      }

      if (docSnap.exists()) {
         const participant = { id: docSnap.id, ...docSnap.data() } as Participant;
         return { participant };
      }
      
      return { participant: null };

    } catch (error) {
      console.error("Error in getParticipantStatusFlow: ", error);
      // It's important not to leak detailed error messages to the client.
      throw new Error("An internal error occurred while fetching participant status.");
    }
  }
);
