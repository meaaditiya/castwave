
'use server';
/**
 * @fileOverview A flow for uploading media files to Google Cloud Storage.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Storage } from '@google-cloud/storage';
import { firebaseConfig } from '@/lib/firebase';

const UploadMediaInputSchema = z.object({
  filePath: z.string().describe('The full path where the file should be stored in the bucket, e.g., "profileImages/userId/filename.jpg".'),
  dataUri: z.string().describe("The file content as a data URI, e.g., 'data:image/jpeg;base64,....'."),
});
export type UploadMediaInput = z.infer<typeof UploadMediaInputSchema>;

const UploadMediaOutputSchema = z.object({
  url: z.string().describe('The public URL of the uploaded file.'),
});
export type UploadMediaOutput = z.infer<typeof UploadMediaOutputSchema>;

export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaOutput> {
  return uploadMediaFlow(input);
}

const uploadMediaFlow = ai.defineFlow(
  {
    name: 'uploadMediaFlow',
    inputSchema: UploadMediaInputSchema,
    outputSchema: UploadMediaOutputSchema,
  },
  async ({ filePath, dataUri }) => {
    const projectId = firebaseConfig.projectId;
    const bucketName = firebaseConfig.storageBucket;

    if (!bucketName) {
      throw new Error('Firebase storageBucket is not configured.');
    }

    try {
      const storage = new Storage({ projectId });
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(filePath);

      // Extract content type and base64 data from the data URI
      const match = dataUri.match(/^data:(.+);base64,(.*)$/);
      if (!match) {
        throw new Error('Invalid data URI format.');
      }
      const contentType = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // Upload the file buffer
      await file.save(buffer, {
        metadata: {
          contentType: contentType,
        },
      });

      // Make the file public to get a downloadable URL
      await file.makePublic();

      // Return the public URL
      return {
        url: file.publicUrl(),
      };
    } catch (error: any) {
      console.error('Error uploading to Cloud Storage:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
);
