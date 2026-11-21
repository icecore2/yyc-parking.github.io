import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './client';
import {
  CustomLocation,
  ParkingSession,
  RateSnapshot,
  UserFavoriteSpot,
  UserOnboardingState,
  UserVehicle,
} from '../parking/types';
import {
  ALL_EXAMPLE_IDS,
  DEFAULT_ONBOARDING_STATE,
  LEGACY_DEFAULT_LOCATION_IDS,
  createExampleRateSnapshots,
  dismissExampleIds,
  restoreExampleIds,
  stripExampleFlag,
} from '../parking/example-data';

const LOCAL_FAVORITES_PREFIX = 'yyc_parking_favorites';
const LOCAL_SESSIONS_PREFIX = 'yyc_parking_sessions';
const LOCAL_VEHICLES_PREFIX = 'yyc_parking_vehicles';
const LOCAL_LOCATIONS_PREFIX = 'yyc_parking_locations';
const LOCAL_ONBOARDING_PREFIX = 'yyc_parking_onboarding';
const LOCAL_SNAPSHOTS_PREFIX = 'yyc_zone_snapshots';

const LEGACY_FAVORITES_KEY = 'yyc_parking_favorites';
const LEGACY_SESSIONS_KEY = 'yyc_parking_sessions';
const LEGACY_LOCATIONS_KEY = 'cpa_custom_locations';

export const USER_DATA_CHANGED_EVENT = 'yyc-user-data-changed';

export function notifyUserDataChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_DATA_CHANGED_EVENT));
  }
}

function isRemoteFirestoreUser(userId: string): boolean {
  return Boolean(db && db.type && userId && !userId.startsWith('demo_'));
}

function scopedKey(prefix: string, userId?: string): string {
  const uid = userId && userId.trim() ? userId.trim() : 'demo_user';
  return `${prefix}_${uid}`;
}

function sanitizeFirestorePayload<T extends object>(obj: T): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === 'isExample' || v === undefined) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

function readLocalList<T>(prefix: string, userId: string, legacyKey?: string): T[] {
  if (typeof window === 'undefined') return [];
  const key = scopedKey(prefix, userId);
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (legacyKey && (!userId || userId.startsWith('demo_'))) {
    const legacyRaw = localStorage.getItem(legacyKey);
    if (legacyRaw) {
      try {
        const parsed = JSON.parse(legacyRaw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  }
  return [];
}

function writeLocalList<T>(prefix: string, userId: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(scopedKey(prefix, userId), JSON.stringify(items));
  } catch {
    // Ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Favorites CRUD
// ---------------------------------------------------------------------------

export async function getUserFavorites(userId: string): Promise<UserFavoriteSpot[]> {
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDocs(collection(db, 'users', userId, 'favorites'));
      const items: UserFavoriteSpot[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as UserFavoriteSpot), id: d.id }));
      return items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
  } catch (err) {
    console.warn('Firestore getUserFavorites error; reading local storage', err);
  }

  return readLocalList<UserFavoriteSpot>(LOCAL_FAVORITES_PREFIX, userId, LEGACY_FAVORITES_KEY);
}

export async function saveUserFavorite(userId: string, spot: UserFavoriteSpot): Promise<void> {
  const payload: UserFavoriteSpot = {
    ...spot,
    createdAt: spot.createdAt || Date.now(),
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, 'favorites', payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore saveUserFavorite error; saving to local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<UserFavoriteSpot>(LOCAL_FAVORITES_PREFIX, userId, LEGACY_FAVORITES_KEY);
    const existingIdx = list.findIndex((x) => x.id === payload.id || x.zoneId === payload.zoneId);
    if (existingIdx >= 0) {
      list[existingIdx] = payload;
    } else {
      list.unshift(payload);
    }
    writeLocalList(LOCAL_FAVORITES_PREFIX, userId, list);
  }

  notifyUserDataChanged();
}

export async function updateUserFavorite(userId: string, spot: UserFavoriteSpot): Promise<void> {
  const payload: UserFavoriteSpot = {
    ...spot,
    createdAt: spot.createdAt || Date.now(),
    updatedAt: Date.now(),
    isExample: false,
  };
  await saveUserFavorite(userId, payload);
}

export async function deleteUserFavorite(userId: string, spotId: string): Promise<void> {
  let deletedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await deleteDoc(doc(db, 'users', userId, 'favorites', spotId));
      deletedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore deleteUserFavorite error; updating local storage', err);
  }

  if (!deletedRemotely) {
    const list = readLocalList<UserFavoriteSpot>(LOCAL_FAVORITES_PREFIX, userId, LEGACY_FAVORITES_KEY);
    const filtered = list.filter((x) => x.id !== spotId);
    writeLocalList(LOCAL_FAVORITES_PREFIX, userId, filtered);
  }

  notifyUserDataChanged();
}

// ---------------------------------------------------------------------------
// Parking Sessions / Expenses CRUD
// ---------------------------------------------------------------------------

export async function getUserParkingSessions(userId: string): Promise<ParkingSession[]> {
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDocs(collection(db, 'users', userId, 'sessions'));
      const items: ParkingSession[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as ParkingSession), id: d.id }));
      return items.sort((a, b) => b.startTime - a.startTime);
    }
  } catch (err) {
    console.warn('Firestore getUserParkingSessions error; reading local storage', err);
  }

  const local = readLocalList<ParkingSession>(LOCAL_SESSIONS_PREFIX, userId, LEGACY_SESSIONS_KEY);
  return local.sort((a, b) => b.startTime - a.startTime);
}

export async function saveParkingSession(userId: string, session: ParkingSession): Promise<void> {
  const payload: ParkingSession = {
    ...session,
    createdAt: session.createdAt ?? Date.now(),
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, 'sessions', payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore saveParkingSession error; saving to local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<ParkingSession>(LOCAL_SESSIONS_PREFIX, userId, LEGACY_SESSIONS_KEY);
    const idx = list.findIndex((s) => s.id === payload.id);
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.unshift(payload);
    }
    writeLocalList(LOCAL_SESSIONS_PREFIX, userId, list);
  }

  notifyUserDataChanged();
}

export async function updateParkingSession(userId: string, session: ParkingSession): Promise<void> {
  const payload: ParkingSession = {
    ...session,
    updatedAt: Date.now(),
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, 'sessions', payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore updateParkingSession error; updating local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<ParkingSession>(LOCAL_SESSIONS_PREFIX, userId, LEGACY_SESSIONS_KEY);
    const idx = list.findIndex((s) => s.id === payload.id);
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.unshift(payload);
    }
    writeLocalList(LOCAL_SESSIONS_PREFIX, userId, list);
  }

  notifyUserDataChanged();
}

export async function deleteParkingSession(userId: string, sessionId: string): Promise<void> {
  let deletedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await deleteDoc(doc(db, 'users', userId, 'sessions', sessionId));
      deletedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore deleteParkingSession error; updating local storage', err);
  }

  if (!deletedRemotely) {
    const list = readLocalList<ParkingSession>(LOCAL_SESSIONS_PREFIX, userId, LEGACY_SESSIONS_KEY);
    const filtered = list.filter((s) => s.id !== sessionId);
    writeLocalList(LOCAL_SESSIONS_PREFIX, userId, filtered);
  }

  notifyUserDataChanged();
}

// ---------------------------------------------------------------------------
// Registered Vehicles CRUD
// ---------------------------------------------------------------------------

export async function getUserVehicles(userId: string): Promise<UserVehicle[]> {
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDocs(collection(db, 'users', userId, 'vehicles'));
      const items: UserVehicle[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as UserVehicle), id: d.id }));
      return items.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt - b.createdAt);
    }
  } catch (err) {
    console.warn('Firestore getUserVehicles error; reading local storage', err);
  }

  const local = readLocalList<UserVehicle>(LOCAL_VEHICLES_PREFIX, userId);
  return local.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt - b.createdAt);
}

export async function saveUserVehicle(userId: string, vehicle: UserVehicle): Promise<void> {
  const existingList = await getUserVehicles(userId);
  const hasOtherPrimary = existingList.some((v) => v.id !== vehicle.id && v.isPrimary);
  const shouldBePrimary = vehicle.isPrimary || (!hasOtherPrimary && existingList.length === 0);

  const payload: UserVehicle = {
    ...vehicle,
    plate: vehicle.plate.toUpperCase().trim(),
    description: vehicle.description.trim() || 'Vehicle',
    isPrimary: shouldBePrimary,
    createdAt: vehicle.createdAt || Date.now(),
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      if (shouldBePrimary) {
        const demotes = existingList
          .filter((v) => v.id !== payload.id && v.isPrimary)
          .map((v) =>
            setDoc(
              doc(db, 'users', userId, 'vehicles', v.id),
              sanitizeFirestorePayload({ ...v, isPrimary: false, updatedAt: Date.now() })
            )
          );
        await Promise.all(demotes);
      }
      await setDoc(
        doc(db, 'users', userId, 'vehicles', payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore saveUserVehicle error; saving to local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<UserVehicle>(LOCAL_VEHICLES_PREFIX, userId).map((v) =>
      shouldBePrimary && v.id !== payload.id ? { ...v, isPrimary: false, updatedAt: Date.now() } : v
    );
    const idx = list.findIndex((v) => v.id === payload.id);
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }
    writeLocalList(LOCAL_VEHICLES_PREFIX, userId, list);
  }

  notifyUserDataChanged();
}

export async function setPrimaryUserVehicle(userId: string, vehicleId: string): Promise<void> {
  const list = await getUserVehicles(userId);
  const target = list.find((v) => v.id === vehicleId);
  if (!target) return;
  await saveUserVehicle(userId, {
    ...target,
    isPrimary: true,
    updatedAt: Date.now(),
  });
}

export async function deleteUserVehicle(userId: string, vehicleId: string): Promise<void> {
  let deletedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await deleteDoc(doc(db, 'users', userId, 'vehicles', vehicleId));
      deletedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore deleteUserVehicle error; updating local storage', err);
  }

  if (!deletedRemotely) {
    const list = readLocalList<UserVehicle>(LOCAL_VEHICLES_PREFIX, userId);
    const filtered = list.filter((v) => v.id !== vehicleId);
    writeLocalList(LOCAL_VEHICLES_PREFIX, userId, filtered);
  }

  notifyUserDataChanged();
}

// ---------------------------------------------------------------------------
// Custom Locations CRUD
// ---------------------------------------------------------------------------

export async function getUserLocations(userId: string): Promise<CustomLocation[]> {
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDocs(collection(db, 'users', userId, 'locations'));
      const items: CustomLocation[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as CustomLocation), id: d.id }));
      return items.sort((a, b) => a.createdAt - b.createdAt);
    }
  } catch (err) {
    console.warn('Firestore getUserLocations error; reading local storage', err);
  }

  const local = readLocalList<CustomLocation>(LOCAL_LOCATIONS_PREFIX, userId, LEGACY_LOCATIONS_KEY);
  return local
    .filter((loc) => !LEGACY_DEFAULT_LOCATION_IDS.has(loc.id))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveUserLocation(userId: string, loc: CustomLocation): Promise<void> {
  const payload: CustomLocation = {
    ...loc,
    name: loc.name.trim(),
    address: loc.address.trim() || 'Calgary, AB',
    createdAt: loc.createdAt || Date.now(),
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, 'locations', payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore saveUserLocation error; saving to local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<CustomLocation>(
      LOCAL_LOCATIONS_PREFIX,
      userId,
      LEGACY_LOCATIONS_KEY
    ).filter((item) => !LEGACY_DEFAULT_LOCATION_IDS.has(item.id));
    const idx = list.findIndex((item) => item.id === payload.id);
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.push(payload);
    }
    writeLocalList(LOCAL_LOCATIONS_PREFIX, userId, list);
  }

  notifyUserDataChanged();
}

export async function deleteUserLocation(userId: string, locationId: string): Promise<void> {
  let deletedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await deleteDoc(doc(db, 'users', userId, 'locations', locationId));
      deletedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore deleteUserLocation error; updating local storage', err);
  }

  if (!deletedRemotely) {
    const list = readLocalList<CustomLocation>(
      LOCAL_LOCATIONS_PREFIX,
      userId,
      LEGACY_LOCATIONS_KEY
    ).filter((item) => !LEGACY_DEFAULT_LOCATION_IDS.has(item.id));
    const filtered = list.filter((item) => item.id !== locationId);
    writeLocalList(LOCAL_LOCATIONS_PREFIX, userId, filtered);
  }

  notifyUserDataChanged();
}

// ---------------------------------------------------------------------------
// Onboarding & Dismissed Examples State
// ---------------------------------------------------------------------------

export async function getUserOnboardingState(userId: string): Promise<UserOnboardingState> {
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDoc(doc(db, 'users', userId, 'preferences', 'onboarding'));
      if (snap.exists()) {
        const data = snap.data() as Partial<UserOnboardingState>;
        return {
          ...DEFAULT_ONBOARDING_STATE,
          ...data,
          dismissedExampleIds: Array.isArray(data.dismissedExampleIds) ? data.dismissedExampleIds : [],
          completedSteps: Array.isArray(data.completedSteps) ? data.completedSteps : [],
        };
      }
    }
  } catch (err) {
    console.warn('Firestore getUserOnboardingState error; reading local storage', err);
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(scopedKey(LOCAL_ONBOARDING_PREFIX, userId));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<UserOnboardingState>;
        return {
          ...DEFAULT_ONBOARDING_STATE,
          ...parsed,
          dismissedExampleIds: Array.isArray(parsed.dismissedExampleIds) ? parsed.dismissedExampleIds : [],
          completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
        };
      } catch {
        return { ...DEFAULT_ONBOARDING_STATE };
      }
    }
  }

  return { ...DEFAULT_ONBOARDING_STATE };
}

export async function saveUserOnboardingState(
  userId: string,
  state: UserOnboardingState
): Promise<void> {
  const payload: UserOnboardingState = {
    walkthroughCompleted: Boolean(state.walkthroughCompleted),
    walkthroughDismissed: Boolean(state.walkthroughDismissed),
    dismissedExampleIds: Array.from(new Set(state.dismissedExampleIds || [])).slice(0, 50),
    completedSteps: Array.from(new Set(state.completedSteps || [])).slice(0, 20),
    updatedAt: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(scopedKey(LOCAL_ONBOARDING_PREFIX, userId), JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }

  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, 'preferences', 'onboarding'),
        sanitizeFirestorePayload(payload)
      );
    }
  } catch (err) {
    console.warn('Firestore saveUserOnboardingState error; saved locally', err);
  }

  notifyUserDataChanged();
}

export async function dismissExamplesForUser(
  userId: string,
  ids: string[]
): Promise<UserOnboardingState> {
  const current = await getUserOnboardingState(userId);
  const next = dismissExampleIds(current, ids);
  await saveUserOnboardingState(userId, next);
  return next;
}

export async function restoreExamplesForUser(
  userId: string,
  ids: string[]
): Promise<UserOnboardingState> {
  const current = await getUserOnboardingState(userId);
  const next = restoreExampleIds(current, ids);
  await saveUserOnboardingState(userId, next);
  return next;
}

export async function clearAllExamplesForUser(userId: string): Promise<UserOnboardingState> {
  return dismissExamplesForUser(userId, ALL_EXAMPLE_IDS);
}

// ---------------------------------------------------------------------------
// Zone Rate Audit Snapshots (localStorage per user + zone)
// ---------------------------------------------------------------------------

interface StoredSnapshotsRecord {
  items: RateSnapshot[];
  examplesDismissed: boolean;
}

export function getZoneRateSnapshots(
  userId: string,
  zoneId: string,
  activeRate: number
): RateSnapshot[] {
  const examples = createExampleRateSnapshots(activeRate);
  if (typeof window === 'undefined') return examples;

  const key = `${scopedKey(LOCAL_SNAPSHOTS_PREFIX, userId)}_${zoneId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return examples;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSnapshotsRecord>;
    const realItems = (Array.isArray(parsed.items) ? parsed.items : []).map((s) => ({
      ...s,
      isExample: false,
    }));
    if (parsed.examplesDismissed) {
      return realItems;
    }
    const realIds = new Set(realItems.map((s) => s.id));
    const remainingExamples = examples.filter((ex) => !realIds.has(ex.id));
    return [...remainingExamples, ...realItems];
  } catch {
    return examples;
  }
}

export function createRateSnapshot(
  period: string,
  rate: number,
  existingCreatedAt?: number
): RateSnapshot {
  const now = Date.now();
  return {
    id: `snap_${now}`,
    period: period.trim(),
    rate: Number(rate.toFixed(2)),
    createdAt: existingCreatedAt || now,
    isExample: false,
  };
}

export async function saveOrReplaceVehicle(
  userId: string,
  orig: UserVehicle | null,
  input: { plate: string; description: string; isPrimary?: boolean }
): Promise<UserVehicle> {
  const now = Date.now();
  if (!orig || orig.isExample) {
    const created: UserVehicle = {
      id: `veh_${now}`,
      plate: input.plate.toUpperCase().trim(),
      description: input.description.trim() || 'Vehicle',
      isPrimary: input.isPrimary ?? true,
      createdAt: now,
      isExample: false,
    };
    await saveUserVehicle(userId, created);
    if (orig?.isExample) {
      await dismissExamplesForUser(userId, [orig.id]);
    }
    return created;
  }

  const updated: UserVehicle = {
    ...orig,
    plate: input.plate.toUpperCase().trim(),
    description: input.description.trim() || 'Vehicle',
    isPrimary: input.isPrimary ?? orig.isPrimary,
    updatedAt: now,
    isExample: false,
  };
  await saveUserVehicle(userId, updated);
  return updated;
}

export async function saveOrReplaceFavorite(
  userId: string,
  orig: UserFavoriteSpot,
  input: { label: string; notes?: string }
): Promise<UserFavoriteSpot> {
  const now = Date.now();
  if (orig.isExample) {
    const created: UserFavoriteSpot = {
      ...orig,
      id: `fav_${orig.zoneId}_${now}`,
      label: input.label.trim(),
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      isExample: false,
    };
    await updateUserFavorite(userId, created);
    await dismissExamplesForUser(userId, [orig.id]);
    return created;
  }

  const updated: UserFavoriteSpot = {
    ...orig,
    label: input.label.trim(),
    notes: input.notes?.trim() || undefined,
    updatedAt: now,
    isExample: false,
  };
  await updateUserFavorite(userId, updated);
  return updated;
}

export async function saveOrReplaceLocation(
  userId: string,
  orig: CustomLocation,
  input: { name: string; address: string; coordinates: [number, number] }
): Promise<CustomLocation> {
  const now = Date.now();
  if (orig.isExample) {
    const created: CustomLocation = {
      ...orig,
      id: `loc_${now}`,
      name: input.name.trim(),
      address: input.address.trim() || 'Calgary, AB',
      coordinates: input.coordinates,
      createdAt: now,
      isExample: false,
    };
    await saveUserLocation(userId, created);
    await dismissExamplesForUser(userId, [orig.id]);
    return created;
  }

  const updated: CustomLocation = {
    ...orig,
    name: input.name.trim(),
    address: input.address.trim() || 'Calgary, AB',
    coordinates: input.coordinates,
    updatedAt: now,
    isExample: false,
  };
  await saveUserLocation(userId, updated);
  return updated;
}

export function saveZoneRateSnapshots(
  userId: string,
  zoneId: string,
  snapshots: RateSnapshot[],
  examplesDismissed?: boolean
): void {
  if (typeof window === 'undefined') return;
  const key = `${scopedKey(LOCAL_SNAPSHOTS_PREFIX, userId)}_${zoneId}`;

  let prevDismissed = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      prevDismissed = Boolean((JSON.parse(raw) as Partial<StoredSnapshotsRecord>).examplesDismissed);
    }
  } catch {
    // Ignore
  }

  const realItems = snapshots
    .filter((s) => !s.isExample)
    .map((s) => stripExampleFlag(s) as RateSnapshot);

  const record: StoredSnapshotsRecord = {
    items: realItems,
    examplesDismissed: examplesDismissed !== undefined ? examplesDismissed : prevDismissed,
  };

  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore quota errors
  }
}
