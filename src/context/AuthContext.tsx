
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
    getAuth, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    User as FirebaseAuthUser, 
    EmailAuthProvider, 
    reauthenticateWithCredential, 
    updatePassword, 
    sendEmailVerification, 
    sendPasswordResetEmail,
    UserCredential
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    emailVerified: boolean;
    photoURL?: string;
    followerCount: number;
    followingCount: number;
}

export interface AppUser extends FirebaseAuthUser {
    profile?: UserProfile;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  signupWithEmail: (email:string, password:string) => Promise<UserCredential>;
  loginWithEmail: (email:string, password:string) => Promise<UserCredential>;
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setLoading(true);
        let profileUnsubscribe: (() => void) | undefined;
        
        if (user) {
            try {
                const userProfileDocRef = doc(db, 'users', user.uid);
                profileUnsubscribe = onSnapshot(userProfileDocRef, (docSnap) => {
                    const profileData = docSnap.exists() ? docSnap.data() as UserProfile : null;
                    const appUser: AppUser = { ...user, profile: profileData || undefined };

                    if (profileData && user.email && profileData.emailVerified !== user.emailVerified) {
                        updateDoc(userProfileDocRef, { emailVerified: user.emailVerified });
                    }

                    setCurrentUser(appUser);
                    
                    if (user.email && !user.emailVerified) {
                        startVerificationCheck(user);
                    } else {
                        stopVerificationCheck();
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error with profile snapshot:", error);
                    setCurrentUser(user);
                    setLoading(false);
                });
            } catch (error) {
                console.error("Error setting up profile listener:", error);
                setCurrentUser(user);
                setLoading(false);
            }
        } else {
            if (profileUnsubscribe) profileUnsubscribe();
            setCurrentUser(null);
            setLoading(false);
            stopVerificationCheck();
        }

        return () => {
            if (profileUnsubscribe) profileUnsubscribe();
            stopVerificationCheck();
        }
    });

    return () => {
        unsubscribe();
        stopVerificationCheck();
    };
}, [startVerificationCheck]);

  const reauthenticate = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
        throw new Error("Cannot reauthenticate user without an email address.");
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
    window.location.href = '/login';
  }
  
  const signupWithEmailHandler = async (email:string, password:string): Promise<UserCredential> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const defaultUsername = email.split('@')[0] || `user_${user.uid.substring(0,5)}`;
    await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: defaultUsername,
        email: email,
        emailVerified: user.emailVerified,
        photoURL: '',
        followerCount: 0,
        followingCount: 0,
    });
    
    await sendEmailVerification(user);
    
    return userCredential;
  }
  
  const loginWithEmailHandler = async (email:string, password:string) => {
      return signInWithEmailAndPassword(auth, email, password);
  }

  const value = {
    currentUser,
    loading,
    signupWithEmail: signupWithEmailHandler,
    loginWithEmail: loginWithEmailHandler,
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
