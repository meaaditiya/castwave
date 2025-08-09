
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
  signup: (email:string, password:string) => Promise<UserCredential>;
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
    // This ref helps prevent running the redirect check multiple times
    const isProcessingRedirect = useRef(false);

    if (!isProcessingRedirect.current) {
        isProcessingRedirect.current = true;
        getRedirectResult(auth)
            .then(async (result) => {
                if (result && result.user) {
                    // This is a user returning from a Google redirect.
                    const user = result.user;
                    const userDocRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(userDocRef);

                    if (!docSnap.exists()) {
                        // User is new, create their profile.
                         await setDoc(userDocRef, {
                            uid: user.uid,
                            username: user.displayName || user.email?.split('@')[0] || `user_${user.uid.substring(0,5)}`,
                            email: user.email,
                            emailVerified: user.emailVerified,
                            photoURL: user.photoURL || '',
                            avatarGenerationCount: 0,
                        });
                    }
                }
            })
            .catch((error) => {
                console.error("Error processing redirect result:", error);
            })
            .finally(() => {
                // Now, set up the regular auth state listener, which will run
                // for all users, whether they just redirected or have an existing session.
                const unsubscribe = onAuthStateChanged(auth, (user) => {
                    let profileUnsubscribe: (() => void) | undefined;
                    
                    if (user) {
                        const userProfileDocRef = doc(db, 'users', user.uid);
                        profileUnsubscribe = onSnapshot(userProfileDocRef, (docSnap) => {
                            const profileData = docSnap.exists() ? docSnap.data() as UserProfile : null;
                            const appUser: AppUser = { ...user, profile: profileData || undefined };

                            // Sync Firestore with latest auth state
                            if (profileData && profileData.emailVerified !== user.emailVerified) {
                                updateDoc(userProfileDocRef, { emailVerified: user.emailVerified });
                            }

                            setCurrentUser(appUser);
                            
                            if (!user.emailVerified) {
                                startVerificationCheck(user);
                            }
                            setLoading(false);
                        }, (error) => {
                            console.error("Error with profile snapshot:", error);
                            setCurrentUser(user); // Set user without profile on error
                            setLoading(false);
                        });
                    } else {
                        if (profileUnsubscribe) profileUnsubscribe();
                        setCurrentUser(null);
                        setLoading(false);
                        stopVerificationCheck();
                    }
                });

                // Cleanup function for onAuthStateChanged
                return () => {
                    unsubscribe();
                    if (profileUnsubscribe) profileUnsubscribe();
                    stopVerificationCheck();
                };
            });
    }

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
    setLoading(true);
    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
  }
  
  const signupWithEmail = async (email:string, password:string): Promise<UserCredential> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create Firestore document for the new user
    const defaultUsername = email.split('@')[0] || `user_${user.uid.substring(0,5)}`;
    await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        username: defaultUsername,
        email: email,
        emailVerified: user.emailVerified,
        photoURL: '',
        avatarGenerationCount: 0,
    });
    
    await sendEmailVerification(user);
    
    return userCredential;
  }

  const value = {
    currentUser,
    loading,
    signup: signupWithEmail,
    login: signInWithEmailAndPassword,
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
