
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // In a Google Cloud environment (like App Hosting), the SDK is automatically
    // configured. For local development, you would need to set up service account
    // credentials.
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
