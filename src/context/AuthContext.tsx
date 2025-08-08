
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseAuthUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    emailVerified: boolean;
    photoURL?: string;
    avatarGenerationCount?: number;
}

export interface AppUser extends FirebaseAuthUser {
    profile?: UserProfile;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  login: typeof signInWithEmailAndPassword;
  logout: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
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
  const verificationTimer = useRef<NodeJS.Timeout | null>(null);

  const stopVerificationCheck = () => {
    if (verificationTimer.current) {
      clearInterval(verificationTimer.current);
      verificationTimer.current = null;
    }
  };

  const startVerificationCheck = useCallback((user: FirebaseAuthUser) => {
    stopVerificationCheck();
    if (user && !user.emailVerified) {
      verificationTimer.current = setInterval(async () => {
        await user.reload();
        const freshUser = auth.currentUser;
        if (freshUser && freshUser.emailVerified) {
          // The onAuthStateChanged listener will handle the update
          // by re-triggering, so we can just stop the timer.
          stopVerificationCheck();
        }
      }, 5000); // Check every 5 seconds
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        stopVerificationCheck(); // Stop any previous timers
        if (user) {
            const userProfileDocRef = doc(db, 'users', user.uid);
            
            const unsubProfile = onSnapshot(userProfileDocRef, (docSnap) => {
                const profileData = docSnap.exists() ? docSnap.data() as UserProfile : null;
                
                // We must use the user from auth.currentUser to get the latest state
                const freshUser = auth.currentUser; 
                if (freshUser) {
                    const appUser: AppUser = {
                        ...freshUser,
                        profile: profileData || undefined
                    };
                    
                    // Update the user profile in Firestore if verification status has changed
                    if (profileData?.emailVerified !== freshUser.emailVerified) {
                        setDoc(userProfileDocRef, { emailVerified: freshUser.emailVerified }, { merge: true });
                    }
                    
                    setCurrentUser(appUser);
                    
                    if (!freshUser.emailVerified) {
                        startVerificationCheck(freshUser);
                    }
                }
                setLoading(false);
            });
            return () => unsubProfile();
        } else {
            setCurrentUser(null);
            setLoading(false);
        }
    });

    return () => {
        unsubscribe();
        stopVerificationCheck();
    };
  }, [startVerificationCheck]);


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

  const sendPasswordResetHandler = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }

  const logoutHandler = async () => {
    await signOut(auth);
  }

  const value = {
    currentUser,
    loading,
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    logout: logoutHandler,
    reauthenticate,
    updateUserPassword,
    sendVerificationEmail: sendVerificationEmailHandler,
    sendPasswordReset: sendPasswordResetHandler,
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
