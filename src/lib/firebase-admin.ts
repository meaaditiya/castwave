
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { firebaseConfig } from './firebase';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
  });
}

const db = getFirestore();
const auth = getAuth();

export { admin, db, auth };
