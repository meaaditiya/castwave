
import { nanoid } from 'nanoid';
import { uploadMedia } from '@/ai/flows/upload-media';

/**
 * Reads a file and converts it to a base64 data URI.
 * @param file The file to read.
 * @returns A promise that resolves with the data URI.
 */
function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read file as data URI.'));
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
        reader.readAsDataURL(file);
    });
}


/**
 * Uploads a profile image by sending it to a backend flow.
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
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${nanoid()}.${fileExtension}`;
        const filePath = `profileImages/${userId}/${fileName}`;

        // Convert file to data URI to send to the backend
        const dataUri = await fileToDataUri(file);

        // Call the backend flow to handle the upload
        const result = await uploadMedia({
            filePath,
            dataUri,
        });

        if (!result.url) {
            throw new Error('Backend flow did not return a URL.');
        }

        return result.url;

    } catch (error: any) {
        console.error("Error in storage service during upload:", error);
        throw new Error(error.message || 'Failed to upload image via backend service.');
    }
};
