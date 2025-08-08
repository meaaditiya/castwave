
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a profile image to Firebase Storage.
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

    const filePath = `profileImages/${userId}/${file.name}`;
    const storageRef = ref(storage, filePath);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
};
