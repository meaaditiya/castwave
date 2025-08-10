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
  "messagingSenderId": "1004745624362",
  "webClientId": "1004745624362-cl4u6hckr1tsfk5i0mk8sf4h6g4q7dce.apps.googleusercontent.com"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
