import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './client';
import {
  CustomLocation,
  ParkingSession,
  RateSnapshot,
  UserFavoriteSpot,
  UserOnboardingState,
  UserPriceReport,
  UserVehicle,
} from '../parking/types';
import {
  ALL_EXAMPLE_IDS,
  DEFAULT_ONBOARDING_STATE,
  LEGACY_DEFAULT_LOCATION_IDS,
  createExamplePriceReports,
  dismissExampleIds,
  restoreExampleIds,
} from '../parking/example-data';

const LOCAL_FAVORITES_PREFIX = 'yyc_parking_favorites';
const LOCAL_SESSIONS_PREFIX = 'yyc_parking_sessions';
const LOCAL_VEHICLES_PREFIX = 'yyc_parking_vehicles';
const LOCAL_LOCATIONS_PREFIX = 'yyc_parking_locations';
const LOCAL_ONBOARDING_PREFIX = 'yyc_parking_onboarding';
const LOCAL_SNAPSHOTS_PREFIX = 'yyc_zone_snapshots'; // legacy, migrated into price reports
const LOCAL_PRICE_REPORTS_PREFIX = 'yyc_parking_price_reports';
const LOCAL_PRICE_EXAMPLES_DISMISSED_PREFIX = 'yyc_parking_price_examples_dismissed';

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

// ---------------------------------------------------------------------------
// Per-user posted prices (users/{uid}/price_reports)
//
// These are private to the user. They are never written to parking_data or
// parking_rate_history, so a user's posts can't change the official rates.
// ---------------------------------------------------------------------------

const PRICE_REPORTS_SUBCOLLECTION = 'price_reports';

function priceExamplesDismissedKey(userId: string, zoneId: string): string {
  return `${scopedKey(LOCAL_PRICE_EXAMPLES_DISMISSED_PREFIX, userId)}_${zoneId}`;
}

function arePriceExamplesDismissed(userId: string, zoneId: string): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(priceExamplesDismissedKey(userId, zoneId)) === '1';
}

export function dismissPriceReportExamples(userId: string, zoneId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(priceExamplesDismissedKey(userId, zoneId), '1');
  } catch {
    // Ignore quota errors
  }
}

function normalizeReport(
  raw: Partial<UserPriceReport>,
  id: string,
  zoneId: string
): UserPriceReport | null {
  const rate = Number(raw.rate);
  if (!Number.isFinite(rate) || rate < 0) return null;
  const createdAt = Number(raw.createdAt) || Date.now();
  return {
    id,
    zoneId: raw.zoneId || zoneId,
    rate: Number(rate.toFixed(2)),
    note: raw.note || undefined,
    observedAt: Number(raw.observedAt) || createdAt,
    createdAt,
    updatedAt: raw.updatedAt,
    isExample: false,
  };
}

/**
 * One-time move of the legacy localStorage "rate snapshots" for this zone into
 * price reports. The legacy key is removed afterwards.
 */
async function migrateLegacySnapshots(userId: string, zoneId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const legacyKey = `${scopedKey(LOCAL_SNAPSHOTS_PREFIX, userId)}_${zoneId}`;
  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;

  let items: RateSnapshot[] = [];
  let dismissed = false;
  try {
    const parsed = JSON.parse(raw) as { items?: RateSnapshot[]; examplesDismissed?: boolean };
    items = Array.isArray(parsed.items) ? parsed.items : [];
    dismissed = Boolean(parsed.examplesDismissed);
  } catch {
    // Corrupt legacy record: drop it.
  }

  for (const snap of items) {
    if (snap.isExample || !Number.isFinite(snap.rate)) continue;
    const createdAt = snap.createdAt || Date.now();
    await saveUserPriceReport(
      userId,
      {
        id: snap.id.startsWith('price_') ? snap.id : `price_${snap.id}`,
        zoneId,
        rate: Number(snap.rate.toFixed(2)),
        note: snap.period?.trim() || undefined,
        observedAt: createdAt,
        createdAt,
        isExample: false,
      },
      { silent: true }
    );
  }

  if (dismissed) dismissPriceReportExamples(userId, zoneId);
  localStorage.removeItem(legacyKey);
}

/**
 * The user's posted prices for one zone, oldest first. Example rows are included
 * while the user has no real posts for the zone and hasn't dismissed them.
 */
export async function getUserPriceReports(
  userId: string,
  zoneId: string,
  activeRate: number
): Promise<UserPriceReport[]> {
  await migrateLegacySnapshots(userId, zoneId);

  let real: UserPriceReport[] | null = null;
  try {
    if (isRemoteFirestoreUser(userId)) {
      const snap = await getDocs(
        query(
          collection(db, 'users', userId, PRICE_REPORTS_SUBCOLLECTION),
          where('zoneId', '==', zoneId)
        )
      );
      const remote: UserPriceReport[] = [];
      snap.forEach((d) => {
        const r = normalizeReport(d.data() as Partial<UserPriceReport>, d.id, zoneId);
        if (r) remote.push(r);
      });
      real = remote;
    }
  } catch (err) {
    console.warn('Firestore getUserPriceReports error; reading local storage', err);
  }

  if (!real) {
    real = readLocalList<UserPriceReport>(LOCAL_PRICE_REPORTS_PREFIX, userId)
      .filter((r) => r.zoneId === zoneId)
      .map((r) => normalizeReport(r, r.id, zoneId))
      .filter((r): r is UserPriceReport => r !== null);
  }

  const examples =
    real.length === 0 && !arePriceExamplesDismissed(userId, zoneId)
      ? createExamplePriceReports(zoneId, activeRate)
      : [];

  return [...examples, ...real].sort((a, b) => a.observedAt - b.observedAt);
}

export function createPriceReport(
  zoneId: string,
  input: { rate: number; note?: string; observedAt?: number }
): UserPriceReport {
  const now = Date.now();
  return {
    id: `price_${now}_${Math.random().toString(36).slice(2, 8)}`,
    zoneId,
    rate: Number(input.rate.toFixed(2)),
    note: input.note?.trim() || undefined,
    observedAt: input.observedAt || now,
    createdAt: now,
    isExample: false,
  };
}

export async function saveUserPriceReport(
  userId: string,
  report: UserPriceReport,
  opts: { silent?: boolean } = {}
): Promise<void> {
  const payload: UserPriceReport = {
    ...report,
    rate: Number(report.rate.toFixed(2)),
    note: report.note?.trim().slice(0, 200) || undefined,
    isExample: false,
  };

  let savedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await setDoc(
        doc(db, 'users', userId, PRICE_REPORTS_SUBCOLLECTION, payload.id),
        sanitizeFirestorePayload(payload)
      );
      savedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore saveUserPriceReport error; saving to local storage', err);
  }

  if (!savedRemotely) {
    const list = readLocalList<UserPriceReport>(LOCAL_PRICE_REPORTS_PREFIX, userId);
    const stored = sanitizeFirestorePayload(payload) as unknown as UserPriceReport;
    const idx = list.findIndex((x) => x.id === payload.id);
    if (idx >= 0) list[idx] = stored;
    else list.push(stored);
    writeLocalList(LOCAL_PRICE_REPORTS_PREFIX, userId, list);
  }

  if (!opts.silent) notifyUserDataChanged();
}

export async function updateUserPriceReport(
  userId: string,
  orig: UserPriceReport,
  input: { rate: number; note?: string }
): Promise<void> {
  await saveUserPriceReport(userId, {
    ...orig,
    rate: input.rate,
    note: input.note?.trim() || undefined,
    updatedAt: Date.now(),
  });
}

export async function deleteUserPriceReport(userId: string, reportId: string): Promise<void> {
  let deletedRemotely = false;
  try {
    if (isRemoteFirestoreUser(userId)) {
      await deleteDoc(doc(db, 'users', userId, PRICE_REPORTS_SUBCOLLECTION, reportId));
      deletedRemotely = true;
    }
  } catch (err) {
    console.warn('Firestore deleteUserPriceReport error; updating local storage', err);
  }

  if (!deletedRemotely) {
    const list = readLocalList<UserPriceReport>(LOCAL_PRICE_REPORTS_PREFIX, userId);
    writeLocalList(
      LOCAL_PRICE_REPORTS_PREFIX,
      userId,
      list.filter((x) => x.id !== reportId)
    );
  }

  notifyUserDataChanged();
}
