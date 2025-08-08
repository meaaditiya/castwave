
import { nanoid } from 'nanoid';
import { uploadMedia } from '@/ai/flows/upload-media';

/**
 * Converts a File object to a data URI.
 */
const toDataUri = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


/**
 * Uploads a profile image by proxying it through a Genkit flow.
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
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error("File size cannot exceed 5MB.");
    }

    try {
        // Convert the file to a data URI
        const dataUri = await toDataUri(file);
        
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${nanoid()}.${fileExtension}`;
        const filePath = `profileImages/${userId}/${fileName}`;
        
        // Call the Genkit flow to handle the upload
        const result = await uploadMedia({
            filePath,
            dataUri,
        });

        return result.url;

    } catch (error: any) {
        console.error("Error in storage service during upload:", error);
        throw new Error(error.message || 'Failed to upload image.');
    }
};
