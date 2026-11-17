'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './client';

export type UserTier = 'free' | 'pro';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  tier: UserTier;
  isPro: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string, name?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  toggleDemoTier: () => void;
  upgradeToProDemo: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_PROFILE_KEY = 'yyc_parking_user_profile';
const LOCAL_STORAGE_TIER_KEY = 'yyc_parking_user_tier';

function getStoredProfile(): UserProfile | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignore
    }
  }
  return null;
}

function getStoredTier(): UserTier {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_TIER_KEY) as UserTier;
      if (saved === 'pro' || saved === 'free') return saved;
    } catch {
      // Ignore
    }
  }
  return 'free';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile);
  const [tier, setTier] = useState<UserTier>(getStoredTier);
  const [loading, setLoading] = useState<boolean>(() => Boolean(auth && auth.onAuthStateChanged));

  useEffect(() => {
    if (!auth || !auth.onAuthStateChanged) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          if (db && db.type) {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const data = userSnap.data() as UserProfile;
              setProfile(data);
              setTier(data.tier || 'free');
            } else {
              const newProfile: UserProfile = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Calgary Driver',
                photoURL: currentUser.photoURL,
                tier: 'free',
                createdAt: 1730000000000,
              };
              await setDoc(userRef, newProfile);
              setProfile(newProfile);
              setTier('free');
            }
          } else {
            const fallbackProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'Calgary Driver',
              photoURL: currentUser.photoURL,
              tier: getStoredTier(),
              createdAt: 1730000000000,
            };
            setProfile(fallbackProfile);
            setTier(fallbackProfile.tier);
          }
        } catch (err: unknown) {
          console.warn('Firestore fetch profile error; using fallback', err);
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Calgary Driver',
            photoURL: currentUser.photoURL,
            tier: getStoredTier(),
            createdAt: 1730000000000,
          };
          setProfile(fallbackProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !auth.name) {
      const demoUser: UserProfile = {
        uid: 'demo_user_google_123',
        email: 'calgary.driver@example.com',
        displayName: 'Calgary Driver',
        photoURL: null,
        tier: 'free',
        createdAt: 1730000000000,
      };
      setProfile(demoUser);
      setTier('free');
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/unauthorized-domain' || code === 'auth/api-key-not-valid') {
        console.warn('Firebase dev mode fallback triggered');
        const demoUser: UserProfile = {
          uid: 'demo_user_google_123',
          email: 'calgary.driver@example.com',
          displayName: 'Calgary Driver (Demo Mode)',
          photoURL: null,
          tier: 'free',
          createdAt: 1730000000000,
        };
        setProfile(demoUser);
        localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      } else {
        throw err;
      }
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    if (!auth || !auth.name) {
      const demoUser: UserProfile = {
        uid: 'demo_user_email_123',
        email,
        displayName: email.split('@')[0],
        photoURL: null,
        tier: 'free',
        createdAt: 1730000000000,
      };
      setProfile(demoUser);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    if (!auth || !auth.name) {
      const demoUser: UserProfile = {
        uid: 'demo_user_email_sample',
        email,
        displayName: name || email.split('@')[0],
        photoURL: null,
        tier: 'free',
        createdAt: 1730000000000,
      };
      setProfile(demoUser);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name && cred.user) {
      await updateProfile(cred.user, { displayName: name });
    }
  };

  const signOutUser = async () => {
    if (auth && auth.name) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
  };

  const toggleDemoTier = () => {
    const nextTier: UserTier = tier === 'pro' ? 'free' : 'pro';
    setTier(nextTier);
    localStorage.setItem(LOCAL_STORAGE_TIER_KEY, nextTier);
    if (profile) {
      const updated = { ...profile, tier: nextTier };
      setProfile(updated);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(updated));
    }
  };

  const upgradeToProDemo = () => {
    setTier('pro');
    localStorage.setItem(LOCAL_STORAGE_TIER_KEY, 'pro');
    if (profile) {
      const updated = { ...profile, tier: 'pro' as UserTier };
      setProfile(updated);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tier,
        isPro: tier === 'pro',
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        toggleDemoTier,
        upgradeToProDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
