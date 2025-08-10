
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
    UserCredential,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
    PhoneAuthProvider,
    linkWithCredential
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, query, collection, where } from 'firebase/firestore';

export interface UserProfile {
    uid: string;
    email?: string;
    username: string;
    emailVerified: boolean;
    phoneNumber?: string;
    phoneVerified?: boolean;
    photoURL?: string;
}

export interface AppUser extends FirebaseAuthUser {
    profile?: UserProfile;
}

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
  signupWithEmail: (email:string, password:string) => Promise<UserCredential>;
  loginWithEmail: (email:string, password:string) => Promise<UserCredential>;
  loginWithPhone: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  setupRecaptcha: (elementId: string) => RecaptchaVerifier;
  sendPhoneOtp: (phoneNumber: string, appVerifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
  confirmPhoneOtp: (confirmationResult: ConfirmationResult, otp: string) => Promise<UserCredential>;
  completePhoneSignup: (password: string) => Promise<void>;
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
    if (!auth.currentUser || !auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        throw new Error("Password authentication is not enabled for this user.");
    }
    // Need to find which identity has a password. Assume email if it exists.
    const email = auth.currentUser.email;
    if (!email) {
        throw new Error("Cannot reauthenticate user without an email address.");
    }
    const credential = EmailAuthProvider.credential(email, password);
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
    });
    
    await sendEmailVerification(user);
    
    return userCredential;
  }
  
  const loginWithEmailHandler = async (email:string, password:string) => {
      return signInWithEmailAndPassword(auth, email, password);
  }

   const loginWithPhoneHandler = async (phoneNumber: string, password: string) => {
    // 1. Find the user's email by their phone number from your Firestore database.
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("phoneNumber", "==", phoneNumber));
    const querySnapshot = await getDoc(q);

    if (querySnapshot.empty) {
        throw new Error("No account found with this phone number.");
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    if (!userData.email) {
        throw new Error("This account is not set up for password login. Please try another method.");
    }

    // 2. Use the retrieved email and the provided password to sign in.
    await signInWithEmailAndPassword(auth, userData.email, password);
  };


  const setupRecaptcha = (elementId: string) => {
    if (typeof window !== 'undefined') {
        if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, elementId, {
                'size': 'invisible',
                'callback': (response: any) => {},
            });
        }
        return (window as any).recaptchaVerifier;
    }
    throw new Error("reCAPTCHA can only be initialized on the client-side.");
  }

  const sendPhoneOtpHandler = (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
      return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
  }

  const confirmPhoneOtpHandler = async (confirmationResult: ConfirmationResult, otp: string) => {
    // This will sign in the user temporarily as an anonymous user with a phone credential
    return await confirmationResult.confirm(otp);
  }

  const completePhoneSignupHandler = async (password: string) => {
    const user = auth.currentUser;
    if (!user || !user.phoneNumber) {
        throw new Error("No verified phone number found.");
    }

    // Generate a temporary email to link the password credential
    const tempEmail = `${user.phoneNumber}@castwave.app`;

    const emailCredential = EmailAuthProvider.credential(tempEmail, password);

    try {
      // Link the password credential to the user with the phone number
      const userCredential = await linkWithCredential(user, emailCredential);
      const linkedUser = userCredential.user;

      // Now create the user profile in Firestore
      const userDocRef = doc(db, 'users', linkedUser.uid);
      await setDoc(userDocRef, {
          uid: linkedUser.uid,
          username: `user_${linkedUser.uid.substring(0, 5)}`,
          phoneNumber: linkedUser.phoneNumber,
          phoneVerified: true,
          email: tempEmail, // Store the dummy email
          emailVerified: false,
          photoURL: '',
      });
    } catch(error: any) {
        if (error.code === 'auth/email-already-in-use') {
            // This can happen if the dummy email was somehow used before.
            // A more robust solution might generate a truly unique email.
            throw new Error("This phone number appears to be linked to another account.");
        }
        throw error;
    }
  }


  const value = {
    currentUser,
    loading,
    signupWithEmail: signupWithEmailHandler,
    loginWithEmail: loginWithEmailHandler,
    loginWithPhone: loginWithPhoneHandler,
    logout: logoutHandler,
    reauthenticate,
    updateUserPassword,
    sendVerificationEmail: sendVerificationEmailHandler,
    sendPasswordReset: sendPasswordResetHandler,
    setupRecaptcha,
    sendPhoneOtp: sendPhoneOtpHandler,
    confirmPhoneOtp: confirmPhoneOtpHandler,
    completePhoneSignup: completePhoneSignupHandler
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
