'use server';
/**
 * @fileOverview A flow for uploading files to Firebase Storage.
 *
 * - uploadFile - Uploads a file and returns its public URL.
 * - UploadFileInput - Input type for the uploadFile function.
 * - UploadFileOutput - Output type for the uploadFile function.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

const UploadFileInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The file to upload, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  fileName: z.string().describe('The name of the file.'),
  userId: z.string().describe('The ID of the user uploading the file.'),
});
export type UploadFileInput = z.infer<typeof UploadFileInputSchema>;

const UploadFileOutputSchema = z.object({
  url: z.string().describe('The public URL of the uploaded file.'),
});
export type UploadFileOutput = z.infer<typeof UploadFileOutputSchema>;

export async function uploadFile(input: UploadFileInput): Promise<UploadFileOutput> {
  return uploadFileFlow(input);
}

const uploadFileFlow = ai.defineFlow(
  {
    name: 'uploadFileFlow',
    inputSchema: UploadFileInputSchema,
    outputSchema: UploadFileOutputSchema,
  },
  async (input) => {
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `thumbnails/${input.userId}_${Date.now()}_${input.fileName}`);
      
      const snapshot = await uploadString(storageRef, input.fileDataUri, 'data_url');
      const downloadURL = await getDownloadURL(snapshot.ref);

      return { url: downloadURL };
    } catch (error) {
      console.error('Error uploading file to Firebase Storage:', error);
      throw new Error('Failed to upload file.');
    }
  }
);
