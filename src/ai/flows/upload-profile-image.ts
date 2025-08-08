
'use server';
/**
 * @fileOverview A flow for securely uploading user profile images.
 * This flow receives a base64-encoded image, decodes it, and uploads it to
 * a dedicated folder in Firebase Storage, returning the public URL.
 * This acts as a proxy to bypass client-side CORS issues.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Storage } from '@google-cloud/storage';
import { nanoid } from 'nanoid';
import { firebaseConfig } from '@/lib/firebase';

// Initialize Cloud Storage
const storage = new Storage({
    projectId: firebaseConfig.projectId,
});
const bucketName = firebaseConfig.storageBucket;

const UploadProfileImageInputSchema = z.object({
  userId: z.string().describe('The ID of the user uploading the image.'),
  imageDataUri: z.string().describe("A data URI of the image to upload. Must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."),
});
export type UploadProfileImageInput = z.infer<typeof UploadProfileImageInputSchema>;

const UploadProfileImageOutputSchema = z.object({
  photoURL: z.string().url().describe('The public URL of the uploaded image.'),
});
export type UploadProfileImageOutput = z.infer<typeof UploadProfileImageOutputSchema>;

export async function uploadProfileImageFlow(input: UploadProfileImageInput): Promise<UploadProfileImageOutput> {
  return uploadProfileImageFlowFn(input);
}

const uploadProfileImageFlowFn = ai.defineFlow(
  {
    name: 'uploadProfileImageFlow',
    inputSchema: UploadProfileImageInputSchema,
    outputSchema: UploadProfileImageOutputSchema,
  },
  async ({ userId, imageDataUri }) => {
    if (!bucketName) {
        throw new Error('Firebase Storage bucket name is not configured. Check `src/lib/firebase.ts`.');
    }
    const bucket = storage.bucket(bucketName);

    try {
        // Extract MIME type and Base64 data from the data URI
        const matches = imageDataUri.match(/^data:(.+);base64,(.*)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid data URI format. Expected "data:<mimetype>;base64,<data>".');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExtension = mimeType.split('/')[1] || 'jpg';
        const fileName = `${nanoid()}.${fileExtension}`;
        const filePath = `profileImages/${userId}/${fileName}`;

        const file = bucket.file(filePath);

        // Upload the file buffer to GCS
        await file.save(buffer, {
            metadata: {
                contentType: mimeType,
            },
            public: true, // Make the file public upon upload
        });
        
        // Construct the public URL
        const photoURL = `https://storage.googleapis.com/${bucketName}/${filePath}`;

        return { photoURL };

    } catch (error: any) {
        console.error('Error uploading to Cloud Storage:', error);
        // Provide a more detailed error message
        const errorMessage = error.response?.data?.error?.message || error.message || 'An unknown error occurred.';
        throw new Error(`Failed to upload profile image: ${errorMessage}`);
    }
  }
);
