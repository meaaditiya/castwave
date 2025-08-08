
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

// Initialize Cloud Storage
const storage = new Storage({
    projectId: process.env.GCLOUD_PROJECT,
});
const bucketName = `${process.env.GCLOUD_PROJECT}.appspot.com`;
const bucket = storage.bucket(bucketName);


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
    try {
        // Extract MIME type and Base64 data from the data URI
        const matches = imageDataUri.match(/^data:(.+);base64,(.*)$/);
        if (!matches || matches.length !== 3) {
            throw new Error('Invalid data URI format.');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExtension = mimeType.split('/')[1];
        const fileName = `${nanoid()}.${fileExtension}`;
        const filePath = `profileImages/${userId}/${fileName}`;

        const file = bucket.file(filePath);

        // Upload the file buffer
        await file.save(buffer, {
            metadata: {
                contentType: mimeType,
            },
        });
        
        // Make the file public and get its URL
        await file.makePublic();
        const photoURL = file.publicUrl();

        return { photoURL };

    } catch (error: any) {
        console.error('Error uploading to Cloud Storage:', error);
        throw new Error('Failed to upload profile image.');
    }
  }
);
