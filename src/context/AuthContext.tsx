
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseAuthUser } from 'firebase/auth';
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
            // User is signed in, now listen for their profile changes.
            const userProfileDocRef = doc(db, 'users', user.uid);
            const unsubProfile = onSnapshot(userProfileDocRef, (docSnap) => {
                 if (docSnap.exists()) {
                    const profile = docSnap.data() as UserProfile;
                    setCurrentUser({ ...user, profile });
                } else {
                    // Profile might not be created yet, especially during signup.
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

    // Create a user profile document in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      username: username,
    };
    await setDoc(doc(db, 'users', user.uid), userProfile);
    return userCredential;
  };


  const value = {
    currentUser,
    loading,
    signup,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: () => signOut(auth),
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
