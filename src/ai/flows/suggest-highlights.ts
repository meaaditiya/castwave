'use server';
/**
 * @fileOverview An AI agent for suggesting highlights from a chat based on topic analysis.
 *
 * - suggestHighlights - A function that suggests highlights from the chat.
 * - SuggestHighlightsInput - The input type for the suggestHighlights function.
 * - SuggestHighlightsOutput - The return type for the suggestHighlights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHighlightsInputSchema = z.object({
  chatLog: z.string().describe('The complete chat log from the live podcast session.'),
  currentTopic: z.string().describe('The current topic of discussion in the podcast.'),
});
export type SuggestHighlightsInput = z.infer<typeof SuggestHighlightsInputSchema>;

const SuggestHighlightsOutputSchema = z.object({
  highlights: z.array(
    z.string().describe('A list of suggested highlights from the chat log.')
  ).describe('Suggested highlights from the chat log based on the current topic.'),
});
export type SuggestHighlightsOutput = z.infer<typeof SuggestHighlightsOutputSchema>;

export async function suggestHighlights(input: SuggestHighlightsInput): Promise<SuggestHighlightsOutput> {
  return suggestHighlightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHighlightsPrompt',
  input: {schema: SuggestHighlightsInputSchema},
  output: {schema: SuggestHighlightsOutputSchema},
  prompt: `You are an AI assistant helping a podcast moderator identify key highlights from a live chat during a podcast session.

  The current topic of the podcast is: {{{currentTopic}}}

  Here is the chat log:
  {{chatLog}}

  Identify the most relevant and insightful messages from the chat log that relate to the current topic.
  Return a list of these messages as highlights. The highlights should be short, concise, and impactful.
  Return ONLY the messages, do not include any additional information.

  Format the output as a JSON array of strings.`,
});

const suggestHighlightsFlow = ai.defineFlow(
  {
    name: 'suggestHighlightsFlow',
    inputSchema: SuggestHighlightsInputSchema,
    outputSchema: SuggestHighlightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
