
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseAuthUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
}

export interface AppUser extends FirebaseAuthUser {
    profile?: UserProfile;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  signup: (email: string, password: string, username: string) => Promise<any>;
  login: typeof signInWithEmailAndPassword;
  logout: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            const userProfileDocRef = doc(db, 'users', user.uid);
            const unsubProfile = onSnapshot(userProfileDocRef, (docSnap) => {
                 if (docSnap.exists()) {
                    const profile = docSnap.data() as UserProfile;
                    setCurrentUser({ ...user, profile });
                } else {
                    setCurrentUser(user);
                }
                setLoading(false);
            });
            return () => unsubProfile();
        } else {
            setCurrentUser(null);
            setLoading(false);
        }
    });
    return unsubscribe;
  }, []);
  
  const signup = async (email: string, password: string, username: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      username: username,
    };
    await setDoc(doc(db, 'users', user.uid), userProfile);
    
    // Send verification email on signup
    await sendEmailVerification(user);

    return userCredential;
  };

  const reauthenticate = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
        throw new Error("No user is currently signed in.");
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
  };

  const updateUserPassword = async (password: string) => {
     if (!auth.currentUser) {
        throw new Error("No user is currently signed in.");
    }
    await updatePassword(auth.currentUser, password);
  }
  
  const sendVerificationEmailHandler = async () => {
    if (!auth.currentUser) {
        throw new Error("No user is currently signed in.");
    }
    await sendEmailVerification(auth.currentUser);
  }


  const value = {
    currentUser,
    loading,
    signup,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
    reauthenticate,
    updateUserPassword,
    sendVerificationEmail: sendVerificationEmailHandler,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
