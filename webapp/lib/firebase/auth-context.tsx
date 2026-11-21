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
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from './client';
import { notifyUserDataChanged } from './firestore';

export type UserTier = 'free' | 'pro' | 'admin';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  tier: UserTier;
  role?: UserRole;
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  tier: UserTier;
  isPro: boolean;
  isAdmin: boolean;
  loading: boolean;
  isNewUser: boolean;
  clearNewUserFlag: () => void;
  updateUserDisplayName: (displayName: string) => Promise<void>;
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
      if (saved === 'pro' || saved === 'free' || saved === 'admin') return saved;
    } catch {
      // Ignore
    }
  }
  return 'free';
}

function buildUserProfile(currentUser: User, tier: UserTier): UserProfile {
  return {
    uid: currentUser.uid,
    email: currentUser.email,
    displayName: currentUser.displayName || 'Calgary Driver',
    photoURL: currentUser.photoURL,
    tier,
    createdAt: Date.now(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile);
  const [tier, setTier] = useState<UserTier>(getStoredTier);
  const [loading, setLoading] = useState<boolean>(() => Boolean(auth && auth.onAuthStateChanged));
  const [isNewUser, setIsNewUser] = useState<boolean>(false);

  useEffect(() => {
    if (!auth || !auth.onAuthStateChanged) {
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const cleanupSnapshot = () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };

    const applyFallbackProfile = (currentUser: User) => {
      const fallbackProfile = buildUserProfile(currentUser, getStoredTier());
      setProfile(fallbackProfile);
      setTier(fallbackProfile.tier);
    };

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      cleanupSnapshot();
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setTier('free');
        localStorage.removeItem(LOCAL_STORAGE_TIER_KEY);
        setLoading(false);
        return;
      }

      if (!db || !db.type) {
        applyFallbackProfile(currentUser);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeSnapshot = onSnapshot(
          userRef,
          async (userSnap) => {
            if (userSnap.exists()) {
              const data = userSnap.data() as UserProfile;
              const resolvedTier: UserTier =
                data.tier === 'admin' || data.role === 'admin'
                  ? 'admin'
                  : data.tier === 'pro'
                  ? 'pro'
                  : 'free';
              setProfile(data);
              setTier(resolvedTier);
              localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(data));
              localStorage.setItem(LOCAL_STORAGE_TIER_KEY, resolvedTier);
              setLoading(false);
              return;
            }

            const newProfile = buildUserProfile(currentUser, 'free');
            try {
              await setDoc(userRef, newProfile);
              setProfile(newProfile);
              setTier('free');
              setIsNewUser(true);
              localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(newProfile));
              localStorage.setItem(LOCAL_STORAGE_TIER_KEY, 'free');
            } catch (err: unknown) {
              console.warn('Firestore create profile error; using fallback', err);
              applyFallbackProfile(currentUser);
            }
            setLoading(false);
          },
          (err: unknown) => {
            console.warn('Firestore fetch profile error; using fallback', err);
            applyFallbackProfile(currentUser);
            setLoading(false);
          }
        );
      } catch (err: unknown) {
        console.warn('Firestore subscribe profile error; using fallback', err);
        applyFallbackProfile(currentUser);
        setLoading(false);
      }
    });

    return () => {
      cleanupSnapshot();
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !auth.name) {
      const demoUser: UserProfile = {
        uid: 'demo_user_google_123',
        email: 'calgary.driver@example.com',
        displayName: 'Calgary Driver',
        photoURL: null,
        tier: 'free',
        createdAt: Date.now(),
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
          createdAt: Date.now(),
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
        createdAt: Date.now(),
      };
      setProfile(demoUser);
      setTier('free');
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    const trimmedName = name?.trim().slice(0, 100);
    if (!auth || !auth.name) {
      const demoUser: UserProfile = {
        uid: 'demo_user_email_sample',
        email,
        displayName: trimmedName || email.split('@')[0],
        photoURL: null,
        tier: 'free',
        createdAt: Date.now(),
      };
      setProfile(demoUser);
      setTier('free');
      setIsNewUser(true);
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(demoUser));
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (trimmedName && cred.user) {
      await updateProfile(cred.user, { displayName: trimmedName });
      if (db && db.type) {
        await updateDoc(doc(db, 'users', cred.user.uid), { displayName: trimmedName }).catch(() => {});
      }
    }
    setIsNewUser(true);
  };

  const clearNewUserFlag = () => {
    setIsNewUser(false);
  };

  const updateUserDisplayName = async (displayName: string) => {
    const trimmed = displayName.trim().slice(0, 100);
    if (!trimmed) {
      throw new Error('Display name cannot be empty.');
    }

    if (auth && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    }

    const targetUid = user?.uid || profile?.uid;
    if (db && db.type && targetUid && !targetUid.startsWith('demo_')) {
      try {
        await updateDoc(doc(db, 'users', targetUid), { displayName: trimmed });
      } catch (err: unknown) {
        console.warn('Firestore updateUserDisplayName error; updating local cache', err);
      }
    }

    const updatedProfile: UserProfile = profile
      ? { ...profile, displayName: trimmed }
      : {
          uid: targetUid || 'demo_user',
          email: user?.email || null,
          displayName: trimmed,
          photoURL: user?.photoURL || null,
          tier,
          createdAt: Date.now(),
        };
    setProfile(updatedProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(updatedProfile));
    }
    notifyUserDataChanged();
  };

  const signOutUser = async () => {
    if (auth && auth.name) {
      await signOut(auth);
    }
    setUser(null);
    setProfile(null);
    setTier('free');
    setIsNewUser(false);
    localStorage.removeItem(LOCAL_STORAGE_PROFILE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_TIER_KEY);
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

  const isAdmin =
    Boolean(user || profile) &&
    (tier === 'admin' || profile?.tier === 'admin' || profile?.role === 'admin');
  const isPro = isAdmin || tier === 'pro';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tier,
        isPro,
        isAdmin,
        loading,
        isNewUser,
        clearNewUserFlag,
        updateUserDisplayName,
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
