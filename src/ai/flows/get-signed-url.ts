
'use server';
/**
 * @fileOverview A flow for generating a signed URL for file uploads.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getSignedUrl as getStorageSignedUrl } from '@firebase/storage';
import { storage } from '@/lib/firebase';

const GetSignedUrlInputSchema = z.object({
  fileName: z.string().describe('The name of the file to upload.'),
  contentType: z.string().describe('The MIME type of the file.'),
  userId: z.string().describe('The ID of the user uploading the file.'),
});

const GetSignedUrlOutputSchema = z.object({
  uploadUrl: z.string().describe('The signed URL for uploading the file.'),
  downloadUrl: z.string().describe('The public URL to access the file after upload.'),
});

export async function getSignedUrl(
  input: z.infer<typeof GetSignedUrlInputSchema>
): Promise<z.infer<typeof GetSignedUrlOutputSchema>> {
  return getSignedUrlFlow(input);
}

const getSignedUrlFlow = ai.defineFlow(
  {
    name: 'getSignedUrlFlow',
    inputSchema: GetSignedUrlInputSchema,
    outputSchema: GetSignedUrlOutputSchema,
  },
  async ({ fileName, contentType, userId }) => {
    const filePath = `thumbnails/${userId}_${Date.now()}_${fileName}`;
    const storageRef = ref(storage, filePath);
    
    // This is a workaround to get a signed URL from the client-side SDK on the server
    // It's not ideal but works in environments where the Admin SDK is not available.
    const getSignedUrlFromServer = (ref: any, options: any) =>
        (ref.storage as any)._bucket.getSignedUrl(ref._location.path, options);

    const signedUrl = await getSignedUrlFromServer(storageRef, {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        contentType: contentType,
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.app.options.storageBucket}/o/${encodeURIComponent(filePath)}?alt=media`;

    return {
      uploadUrl: signedUrl[0],
      downloadUrl: downloadUrl,
    };
  }
);
