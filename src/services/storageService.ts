
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';
import { storage } from '@/lib/firebase';

/**
 * Uploads a profile image using the Firebase client-side SDK.
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
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${nanoid()}.${fileExtension}`;
        const filePath = `profileImages/${userId}/${fileName}`;
        
        const storageRef = ref(storage, filePath);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;

    } catch (error: any) {
        console.error("Error in storage service during upload:", error);
        // Firebase often provides useful error codes
        if (error.code === 'storage/unauthorized') {
            throw new Error("You do not have permission to upload this file. Check your Storage Rules.");
        }
        throw new Error(error.message || 'Failed to upload image.');
    }
};
