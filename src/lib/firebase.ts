import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  "projectId": "castwave-axlgb",
  "appId": "1:1004745624362:web:cbd9c6ce9394e325ad6c53",
  "storageBucket": "castwave-axlgb.appspot.com",
  "apiKey": "AIzaSyCQlbvsLpOmGvEuKKxvXs2Ax46OwXG46UI",
  "authDomain": "castwave-axlgb.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1004745624362"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
