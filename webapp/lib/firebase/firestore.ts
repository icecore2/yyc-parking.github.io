import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './client';
import { UserFavoriteSpot, ParkingSession } from '../parking/types';

const LOCAL_FAVORITES_KEY = 'yyc_parking_favorites';
const LOCAL_SESSIONS_KEY = 'yyc_parking_sessions';

export async function getUserFavorites(userId: string): Promise<UserFavoriteSpot[]> {
  try {
    if (db && db.type && userId && !userId.startsWith('demo_')) {
      const snap = await getDocs(collection(db, 'users', userId, 'favorites'));
      const items: UserFavoriteSpot[] = [];
      snap.forEach((d) => items.push(d.data() as UserFavoriteSpot));
      return items;
    }
  } catch (err) {
    console.warn('Firestore getUserFavorites error; reading local storage', err);
  }

  // Fallback to local storage
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export async function saveUserFavorite(userId: string, spot: UserFavoriteSpot): Promise<void> {
  try {
    if (db && db.type && userId && !userId.startsWith('demo_')) {
      await setDoc(doc(db, 'users', userId, 'favorites', spot.id), spot);
      return;
    }
  } catch (err) {
    console.warn('Firestore saveUserFavorite error; saving to local storage', err);
  }

  // Fallback
  if (typeof window !== 'undefined') {
    const list = await getUserFavorites(userId);
    const existingIdx = list.findIndex((x) => x.id === spot.id || x.zoneId === spot.zoneId);
    if (existingIdx >= 0) {
      list[existingIdx] = spot;
    } else {
      list.push(spot);
    }
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(list));
  }
}

export async function deleteUserFavorite(userId: string, spotId: string): Promise<void> {
  try {
    if (db && db.type && userId && !userId.startsWith('demo_')) {
      await deleteDoc(doc(db, 'users', userId, 'favorites', spotId));
      return;
    }
  } catch (err) {
    console.warn('Firestore deleteUserFavorite error; updating local storage', err);
  }

  if (typeof window !== 'undefined') {
    const list = await getUserFavorites(userId);
    const filtered = list.filter((x) => x.id !== spotId);
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(filtered));
  }
}

export async function getUserParkingSessions(userId: string): Promise<ParkingSession[]> {
  try {
    if (db && db.type && userId && !userId.startsWith('demo_')) {
      const snap = await getDocs(collection(db, 'users', userId, 'sessions'));
      const items: ParkingSession[] = [];
      snap.forEach((d) => items.push(d.data() as ParkingSession));
      return items.sort((a, b) => b.startTime - a.startTime);
    }
  } catch (err) {
    console.warn('Firestore getUserParkingSessions error; reading local storage', err);
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (raw) {
      try {
        const parsed: ParkingSession[] = JSON.parse(raw);
        return parsed.sort((a, b) => b.startTime - a.startTime);
      } catch {
        return [];
      }
    }
  }
  return [];
}

export async function saveParkingSession(userId: string, session: ParkingSession): Promise<void> {
  try {
    if (db && db.type && userId && !userId.startsWith('demo_')) {
      await setDoc(doc(db, 'users', userId, 'sessions', session.id), session);
      return;
    }
  } catch (err) {
    console.warn('Firestore saveParkingSession error; saving to local storage', err);
  }

  if (typeof window !== 'undefined') {
    const list = await getUserParkingSessions(userId);
    list.unshift(session);
    localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(list));
  }
}
