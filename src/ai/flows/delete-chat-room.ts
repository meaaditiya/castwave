
'use server';
/**
 * @fileOverview A flow for deleting a chat room and all its sub-collections.
 * This flow is now DEPRECATED and a placeholder. The deletion logic has been
 * moved to the client-side `chatRoomService` to ensure it runs under the
 * authenticated user's context, which aligns with Firestore security rules.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DeleteChatRoomInputSchema = z.object({
  chatRoomId: z.string().describe('The ID of the chat room to delete.'),
  hostId: z.string().describe('The UID of the user attempting to delete the room, for verification.'),
});
export type DeleteChatRoomInput = z.infer<typeof DeleteChatRoomInputSchema>;

export async function deleteChatRoom(input: DeleteChatRoomInput): Promise<{ success: boolean }> {
  // This flow is deprecated. The client should call `deleteChatRoomForHost` directly.
  console.warn("deleteChatRoom Genkit flow is deprecated. Deletion should be handled by the client-side service.");
  throw new Error("This server-side deletion flow is disabled. Use the client-side service instead.");
}

const deleteChatRoomFlow = ai.defineFlow(
  {
    name: 'deleteChatRoomFlow',
    inputSchema: DeleteChatRoomInputSchema,
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ chatRoomId, hostId }) => {
     console.warn(`DEPRECATED: deleteChatRoomFlow was called for chatRoomId: ${chatRoomId} by hostId: ${hostId}. This should be handled client-side.`);
     // Returning success: false to indicate this path is no longer supported.
     return { success: false };
  }
);
