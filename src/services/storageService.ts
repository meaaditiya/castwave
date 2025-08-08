

import { uploadProfileImageFlow } from '@/ai/flows/upload-profile-image';

// Helper to convert a File to a base64 data URI
const fileToDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


/**
 * Uploads a profile image by proxying through a backend flow.
 * @param userId The ID of the user.
 * @param file The image file to upload.
 * @returns The public URL of the uploaded image.
 */
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
    if (!file) {
        throw new Error("No file provided for upload.");
    }
    if (!file.type.startsWith('image/')) {
        throw new Error("File is not an image.");
    }

    try {
        // Convert the file to a data URI to send to the backend flow
        const imageDataUri = await fileToDataUri(file);

        // Call the Genkit flow to handle the upload securely
        const result = await uploadProfileImageFlow({ userId, imageDataUri });
        
        return result.photoURL;
    } catch (error) {
        console.error("Error in storage service during upload:", error);
        // Re-throw the error to be caught by the UI
        throw error;
    }
};
