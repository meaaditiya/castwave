
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { nanoid } from 'nanoid';

/**
 * Uploads a profile image directly using the Firebase client-side SDK.
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
        const storageRef = ref(storage, `profileImages/${userId}/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;

    } catch (error: any) {
        console.error("Error uploading image directly to Firebase Storage:", error);
        
        let errorMessage = 'Could not upload image. Please try again.';
        if (error.code) {
            switch (error.code) {
                case 'storage/unauthorized':
                    errorMessage = "You don't have permission to upload this file.";
                    break;
                case 'storage/canceled':
                    errorMessage = "Upload was canceled.";
                    break;
                case 'storage/object-not-found':
                     errorMessage = "File not found. This shouldn't happen during an upload.";
                     break;
                 case 'storage/bucket-not-found':
                     errorMessage = "Storage bucket is not configured correctly.";
                     break;
                case 'storage/quota-exceeded':
                    errorMessage = "You have exceeded your storage quota.";
                    break;
            }
        }
        
        throw new Error(errorMessage);
    }
};
