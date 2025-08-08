
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a user's profile image to Firebase Storage.
 * @param uid The user's unique ID.
 * @param file The image file to upload.
 * @returns The public download URL of the uploaded image.
 */
export const uploadProfileImage = async (uid: string, file: File): Promise<string> => {
  if (!uid) throw new Error("User is not authenticated.");
  if (!file) throw new Error("No file provided for upload.");

  // Create a storage reference
  const storageRef = ref(storage, `avatars/${uid}/${file.name}`);

  try {
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error: any) {
    console.error("Error uploading profile image to Firebase Storage:", error);
    // Provide a more user-friendly error message
    switch (error.code) {
      case 'storage/unauthorized':
        throw new Error("You do not have permission to upload this file.");
      case 'storage/canceled':
        throw new Error("The upload was canceled.");
      case 'storage/unknown':
        throw new Error("An unknown error occurred during the upload. Please try again.");
      default:
        throw new Error("Failed to upload profile image.");
    }
  }
};

    