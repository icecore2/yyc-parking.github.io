'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  USER_DATA_CHANGED_EVENT,
  clearAllExamplesForUser,
  getUserFavorites,
  getUserLocations,
  getUserOnboardingState,
  getUserParkingSessions,
  getUserVehicles,
  saveUserOnboardingState,
} from '@/lib/firebase/firestore';
import {
  DEFAULT_ONBOARDING_STATE,
  EXAMPLE_FAVORITES,
  EXAMPLE_LOCATIONS,
  EXAMPLE_SESSIONS,
  EXAMPLE_VEHICLES,
  WalkthroughProgressSummary,
  computeWalkthroughProgress,
  mergeWithExamples,
} from '@/lib/parking/example-data';
import {
  CustomLocation,
  ParkingSession,
  UserFavoriteSpot,
  UserOnboardingState,
  UserVehicle,
  WalkthroughStepId,
} from '@/lib/parking/types';
import WalkthroughGuideModal from './WalkthroughGuideModal';

interface WalkthroughContextType {
  isOpen: boolean;
  isMinimized: boolean;
  activeStep: WalkthroughStepId;
  setActiveStep: (step: WalkthroughStepId) => void;
  openWalkthrough: (step?: WalkthroughStepId) => void;
  closeWalkthrough: () => void;
  minimizeWalkthrough: (step?: WalkthroughStepId) => void;
  dismissWalkthrough: () => Promise<void>;
  completeWalkthrough: () => Promise<void>;
  markStepCompleted: (step: WalkthroughStepId) => Promise<void>;
  clearAllExamples: () => Promise<void>;
  refreshData: () => Promise<void>;
  onboardingState: UserOnboardingState;
  vehicles: UserVehicle[];
  locations: CustomLocation[];
  favorites: UserFavoriteSpot[];
  sessions: ParkingSession[];
  progress: WalkthroughProgressSummary;
  dataLoaded: boolean;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export function WalkthroughProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isNewUser, clearNewUserFlag } = useAuth();
  const uid = user?.uid || profile?.uid || 'demo_user';
  const displayName = profile?.displayName ?? user?.displayName ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeStep, setActiveStep] = useState<WalkthroughStepId>('profile');
  const [onboardingState, setOnboardingState] = useState<UserOnboardingState>(
    DEFAULT_ONBOARDING_STATE
  );
  const [realVehicles, setRealVehicles] = useState<UserVehicle[]>([]);
  const [realLocations, setRealLocations] = useState<CustomLocation[]>([]);
  const [realFavorites, setRealFavorites] = useState<UserFavoriteSpot[]>([]);
  const [realSessions, setRealSessions] = useState<ParkingSession[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    const [ob, v, l, f, s] = await Promise.all([
      getUserOnboardingState(uid),
      getUserVehicles(uid),
      getUserLocations(uid),
      getUserFavorites(uid),
      getUserParkingSessions(uid),
    ]);
    return { ob, v, l, f, s };
  }, [uid]);

  const refreshData = useCallback(async () => {
    const { ob, v, l, f, s } = await loadAll();
    setOnboardingState(ob);
    setRealVehicles(v);
    setRealLocations(l);
    setRealFavorites(f);
    setRealSessions(s);
    setDataLoaded(true);
  }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    loadAll().then(({ ob, v, l, f, s }) => {
      if (cancelled) return;
      setOnboardingState(ob);
      setRealVehicles(v);
      setRealLocations(l);
      setRealFavorites(f);
      setRealSessions(s);
      setDataLoaded(true);

      if (isNewUser && !ob.walkthroughCompleted && !ob.walkthroughDismissed) {
        setActiveStep('profile');
        setIsOpen(true);
        setIsMinimized(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadAll, isNewUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleChanged = () => {
      void refreshData();
    };
    window.addEventListener(USER_DATA_CHANGED_EVENT, handleChanged);
    return () => window.removeEventListener(USER_DATA_CHANGED_EVENT, handleChanged);
  }, [refreshData]);

  const vehicles = useMemo(
    () => mergeWithExamples(realVehicles, EXAMPLE_VEHICLES, onboardingState.dismissedExampleIds),
    [realVehicles, onboardingState.dismissedExampleIds]
  );

  const locations = useMemo(
    () => mergeWithExamples(realLocations, EXAMPLE_LOCATIONS, onboardingState.dismissedExampleIds),
    [realLocations, onboardingState.dismissedExampleIds]
  );

  const favorites = useMemo(
    () => mergeWithExamples(realFavorites, EXAMPLE_FAVORITES, onboardingState.dismissedExampleIds),
    [realFavorites, onboardingState.dismissedExampleIds]
  );

  const sessions = useMemo(
    () => mergeWithExamples(realSessions, EXAMPLE_SESSIONS, onboardingState.dismissedExampleIds),
    [realSessions, onboardingState.dismissedExampleIds]
  );

  const progress = useMemo(
    () =>
      computeWalkthroughProgress({
        displayName,
        vehicles,
        locations,
        favorites,
        sessions,
        onboardingState,
      }),
    [displayName, vehicles, locations, favorites, sessions, onboardingState]
  );

  const openWalkthrough = useCallback((step?: WalkthroughStepId) => {
    if (step) setActiveStep(step);
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const closeWalkthrough = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    clearNewUserFlag();
  }, [clearNewUserFlag]);

  const minimizeWalkthrough = useCallback((step?: WalkthroughStepId) => {
    if (step) setActiveStep(step);
    setIsOpen(true);
    setIsMinimized(true);
  }, []);

  const dismissWalkthrough = useCallback(async () => {
    const next: UserOnboardingState = {
      ...onboardingState,
      walkthroughDismissed: true,
    };
    setOnboardingState(next);
    setIsOpen(false);
    setIsMinimized(false);
    clearNewUserFlag();
    await saveUserOnboardingState(uid, next);
  }, [onboardingState, uid, clearNewUserFlag]);

  const completeWalkthrough = useCallback(async () => {
    const next: UserOnboardingState = {
      ...onboardingState,
      walkthroughCompleted: true,
      walkthroughDismissed: false,
    };
    setOnboardingState(next);
    setIsOpen(false);
    setIsMinimized(false);
    clearNewUserFlag();
    await saveUserOnboardingState(uid, next);
  }, [onboardingState, uid, clearNewUserFlag]);

  const markStepCompleted = useCallback(
    async (step: WalkthroughStepId) => {
      if (onboardingState.completedSteps.includes(step)) return;
      const next: UserOnboardingState = {
        ...onboardingState,
        completedSteps: [...onboardingState.completedSteps, step],
      };
      setOnboardingState(next);
      await saveUserOnboardingState(uid, next);
    },
    [onboardingState, uid]
  );

  const clearAllExamples = useCallback(async () => {
    const next = await clearAllExamplesForUser(uid);
    setOnboardingState(next);
  }, [uid]);

  return (
    <WalkthroughContext.Provider
      value={{
        isOpen,
        isMinimized,
        activeStep,
        setActiveStep,
        openWalkthrough,
        closeWalkthrough,
        minimizeWalkthrough,
        dismissWalkthrough,
        completeWalkthrough,
        markStepCompleted,
        clearAllExamples,
        refreshData,
        onboardingState,
        vehicles,
        locations,
        favorites,
        sessions,
        progress,
        dataLoaded,
      }}
    >
      {children}
      {isOpen && <WalkthroughGuideModal key={uid} />}
    </WalkthroughContext.Provider>
  );
}

export function useWalkthrough() {
  const ctx = useContext(WalkthroughContext);
  if (!ctx) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return ctx;
}
