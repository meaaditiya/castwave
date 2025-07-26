
'use server';
/**
 * @fileOverview A flow for generating a v4 signed URL for file uploads.
 * This is the standard and secure way to allow clients to upload files.
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Storage } from '@google-cloud/storage';

const GenerateUploadUrlInputSchema = z.object({
  fileName: z.string().describe('The name of the file to upload.'),
  contentType: z.string().describe('The MIME type of the file.'),
  userId: z.string().describe('The ID of the user uploading the file.'),
  uploadType: z.enum(['thumbnail', 'chat-media']).describe('The type of upload.'),
});

const GenerateUploadUrlOutputSchema = z.object({
  uploadUrl: z.string().describe('The signed URL for uploading the file.'),
  downloadUrl: z.string().describe('The public URL to access the file after upload.'),
});

export async function generateUploadUrl(
  input: z.infer<typeof GenerateUploadUrlInputSchema>
): Promise<z.infer<typeof GenerateUploadUrlOutputSchema>> {
  return generateUploadUrlFlow(input);
}

const generateUploadUrlFlow = ai.defineFlow(
  {
    name: 'generateUploadUrlFlow',
    inputSchema: GenerateUploadUrlInputSchema,
    outputSchema: GenerateUploadUrlOutputSchema,
  },
  async ({ fileName, contentType, userId, uploadType }) => {
    const storage = new Storage({
      projectId: process.env.GCLOUD_PROJECT || 'castwave-axlgb',
    });
    
    const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'castwave-axlgb.appspot.com';
    const bucket = storage.bucket(bucketName);

    const folder = uploadType === 'thumbnail' ? 'thumbnails' : 'chat-media';
    const filePath = `${folder}/${userId}_${Date.now()}_${fileName}`;
    const file = bucket.file(filePath);

    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: contentType,
    };

    const [uploadUrl] = await file.getSignedUrl(options);

    // This creates a publicly accessible URL for the file after it's uploaded.
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media`;
    
    return {
      uploadUrl,
      downloadUrl,
    };
  }
);
