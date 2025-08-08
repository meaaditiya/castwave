
'use server';
/**
 * @fileOverview An AI flow for generating a unique user avatar.
 * - generateAvatar: Generates an avatar based on a text prompt.
 * - GenerateAvatarInput: The input schema for the flow.
 * - GenerateAvatarOutput: The output schema for the flow.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateAvatarInputSchema = z.object({
  prompt: z.string().describe('The text prompt to generate the avatar from, usually the username.'),
});
export type GenerateAvatarInput = z.infer<typeof GenerateAvatarInputSchema>;

const GenerateAvatarOutputSchema = z.object({
  dataUri: z.string().describe('The generated image as a Base64 encoded data URI.'),
});
export type GenerateAvatarOutput = z.infer<typeof GenerateAvatarOutputSchema>;

export async function generateAvatar(input: GenerateAvatarInput): Promise<GenerateAvatarOutput> {
  return generateAvatarFlow(input);
}

const generateAvatarFlow = ai.defineFlow(
  {
    name: 'generateAvatarFlow',
    inputSchema: GenerateAvatarInputSchema,
    outputSchema: GenerateAvatarOutputSchema,
  },
  async (input) => {
    
    const { media } = await ai.generate({
        model: 'googleai/gemini-2.0-flash-preview-image-generation',
        prompt: `Generate a unique and friendly cartoon avatar for a user named "${input.prompt}". The style should be modern, vibrant, and suitable for a profile picture. The avatar should be a character's face, expressive and colorful, against a simple, clean background. Avoid any text.`,
        config: {
            responseModalities: ['TEXT', 'IMAGE'],
        },
    });

    if (!media?.url) {
      throw new Error('Image generation failed to produce an output.');
    }

    return { dataUri: media.url };
  }
);
