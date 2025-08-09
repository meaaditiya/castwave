
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User as FirebaseAuthUser, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendEmailVerification, sendPasswordResetEmail, GoogleAuthProvider, signInWithRedirect, getRedirectResult, UserCredential } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, writeBatch, updateDoc } from 'firebase/firestore';

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
  signup: typeof createUserWithEmailAndPassword;
  login: typeof signInWithEmailAndPassword;
  signInWithGoogle: () => Promise<void>;
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
          stopVerificationCheck();
        }
      }, 5000); 
    }
  }, []);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;
  
    const processRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const user = result.user;
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (!docSnap.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              username: user.displayName || user.email?.split('@')[0] || 'User',
              email: user.email,
              emailVerified: user.emailVerified,
              photoURL: user.photoURL || '',
              avatarGenerationCount: 0,
            });
          }
        }
      } catch (error) {
        console.error("Error processing redirect result:", error);
      }
      // After processing, set loading to false to allow the main listener to take over.
      // This is a key part of the fix to avoid race conditions.
      setLoading(false);
    };

    processRedirectResult();
  
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }

      if (user) {
        const userProfileDocRef = doc(db, 'users', user.uid);
        profileUnsubscribe = onSnapshot(userProfileDocRef, (docSnap) => {
          const profileData = docSnap.exists() ? docSnap.data() as UserProfile : null;
          const freshUser = auth.currentUser;
          
          if (freshUser) {
            const appUser: AppUser = { ...freshUser, profile: profileData || undefined };
            
            if (profileData && profileData.emailVerified !== freshUser.emailVerified) {
              updateDoc(userProfileDocRef, { emailVerified: freshUser.emailVerified });
            }
            
            setCurrentUser(appUser);
            
            if (!freshUser.emailVerified) {
              startVerificationCheck(freshUser);
            }
          }
          // The initial loading state is now handled by the redirect processor.
          // Subsequent updates will also set loading to false.
          setLoading(false);
        }, (error) => {
          console.error("Error with profile snapshot:", error);
          setCurrentUser(null);
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        // Only set loading to false if no user is found. If we are coming from a redirect,
        // processRedirectResult will handle setting loading to false.
        if (!auth.currentUser) {
            setLoading(false);
        }
        stopVerificationCheck();
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
      stopVerificationCheck();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  }

  const value = {
    currentUser,
    loading,
    signup: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    login: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInWithGoogle,
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
