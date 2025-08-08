
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from './firebase';

// Check if the environment variable is set
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    // In a local environment, you might want to fall back to a local key file
    // For now, we'll just log a warning if it's not set.
    // This will cause an error on initialization, but it makes the cause clear.
    console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not set. Firebase Admin SDK will not initialize.");
}

try {
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT as string
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
      });
    }
} catch (e: any) {
    console.error('Firebase Admin SDK initialization error:', e.message);
    // You might want to throw the error or handle it gracefully
}


const db = getFirestore();
const auth = getAuth();

export { admin, db, auth };
