import type { RemoteDatabaseAdapter } from './adapter.ts';
import type { NormalizedParkingRecord, ProviderName, RateHistoryPoint } from '../types.ts';

export interface FirestoreAdapterOptions {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  collectionName?: string;
}

export class FirestoreRemoteAdapter implements RemoteDatabaseAdapter {
  private collectionName: string;
  private db: any = null;
  private admin: any = null;
  private historyCollectionName = 'parking_rate_history';
  private isConfigured = false;

  constructor(options: FirestoreAdapterOptions = {}) {
    this.collectionName = options.collectionName || 'parking_data';
    this.initialize(options);
  }

  private initialize(options: FirestoreAdapterOptions): void {
    const projectId = options.projectId || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = options.clientEmail || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const rawPrivateKey = options.privateKey || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

    if (projectId && clientEmail && rawPrivateKey && !clientEmail.includes('example')) {
      try {
        // Attempt dynamic require/import of firebase-admin
        const admin = (globalThis as any).firebaseAdmin || null;
        if (admin) {
          const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
          if (!admin.apps.length) {
            admin.initializeApp({
              credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
            });
          }
          this.db = admin.firestore();
          this.admin = admin;
          this.isConfigured = true;
        }
      } catch (err) {
        console.warn('[FirestoreRemoteAdapter] Could not initialize firebase-admin SDK:', err);
      }
    }
  }

  getName(): string {
    return `FirestoreRemoteAdapter (Collection: '${this.collectionName}')`;
  }

  async queryRemoteRecords(): Promise<NormalizedParkingRecord[]> {
    if (!this.db) {
      console.log(`[${this.getName()}] Running in simulated/offline mode - no remote records returned.`);
      return [];
    }

    try {
      const snap = await this.db.collection(this.collectionName).get();
      const records: NormalizedParkingRecord[] = [];

      snap.forEach((docSnap: any) => {
        const data = docSnap.data();
        records.push({
          id: docSnap.id,
          externalId: String(data.externalId || docSnap.id),
          provider_name: data.provider_name as ProviderName,
          providerId: String(data.providerId || 'unknown'),
          title: String(data.title || ''),
          address: String(data.address || ''),
          category: data.category || 'MUNICIPAL',
          stallCount: Number(data.stallCount || 0),
          stallType: String(data.stallType || 'Parallel'),
          brz: data.brz,
          priceZone: data.priceZone,
          maxStayHours: data.maxStayHours,
          enforceableHours: data.enforceableHours,
          activeRate: Number(data.activeRate || 0),
          isCurrentlyFree: Boolean(data.isCurrentlyFree),
          rateSchedule: data.rateSchedule || [],
          coordinates: data.coordinates || [0, 0],
          geometry: data.geometry,
          restrictions: data.restrictions || [],
          paymentApp: data.paymentApp,
          paymentUrl: data.paymentUrl,
          contentHash: String(data.contentHash || ''),
          fetchedAt: Number(data.fetchedAt || 0),
          syncedToRemoteAt: Number(data.syncedToRemoteAt || Date.now()),
          remoteSyncStatus: 'SYNCED',
        });
      });

      return records;
    } catch (err) {
      console.warn(`[${this.getName()}] Error querying remote records:`, err);
      return [];
    }
  }

  async pushRecords(records: NormalizedParkingRecord[]): Promise<number> {
    if (!this.db) {
      console.log(
        `[${this.getName()}] Simulated Push: Would push ${records.length} records to remote table '${this.collectionName}'.`
      );
      return records.length;
    }

    let written = 0;
    const batchSize = 400; // Firestore limit is 500 per batch

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = this.db.batch();
      const chunk = records.slice(i, i + batchSize);

      for (const rec of chunk) {
        const docRef = this.db.collection(this.collectionName).doc(rec.id);
        const docData = {
          id: rec.id,
          externalId: rec.externalId,
          provider_name: rec.provider_name, // Explicit column requested by user
          providerId: rec.providerId,
          title: rec.title,
          address: rec.address,
          category: rec.category,
          stallCount: rec.stallCount,
          stallType: rec.stallType,
          brz: rec.brz || 'None',
          priceZone: rec.priceZone || 'Standard',
          maxStayHours: rec.maxStayHours ?? null,
          enforceableHours: rec.enforceableHours || null,
          activeRate: rec.activeRate,
          isCurrentlyFree: rec.isCurrentlyFree,
          rateSchedule: rec.rateSchedule,
          coordinates: rec.coordinates,
          geometry: rec.geometry || null,
          restrictions: rec.restrictions,
          paymentApp: rec.paymentApp || null,
          paymentUrl: rec.paymentUrl || null,
          contentHash: rec.contentHash,
          last_synced_at: Date.now(),
        };

        batch.set(docRef, docData, { merge: true });
      }

      await batch.commit();
      written += chunk.length;
    }

    return written;
  }

  async pushRateHistory(points: RateHistoryPoint[]): Promise<number> {
    if (points.length === 0) return 0;
    if (!this.db || !this.admin) {
      console.log(
        `[${this.getName()}] Simulated Push: Would append ${points.length} rate-history point(s) to '${this.historyCollectionName}'.`
      );
      return points.length;
    }

    const { FieldValue } = this.admin.firestore;
    const byZone = new Map<string, RateHistoryPoint[]>();
    for (const p of points) {
      const list = byZone.get(p.zoneId) || [];
      list.push(p);
      byZone.set(p.zoneId, list);
    }

    const zoneIds = [...byZone.keys()];
    const batchSize = 400;
    let written = 0;
    for (let i = 0; i < zoneIds.length; i += batchSize) {
      const batch = this.db.batch();
      for (const zoneId of zoneIds.slice(i, i + batchSize)) {
        const zonePoints = byZone.get(zoneId)!;
        const docRef = this.db.collection(this.historyCollectionName).doc(zoneId);
        batch.set(
          docRef,
          {
            zoneId,
            points: FieldValue.arrayUnion(
              ...zonePoints.map((p) => ({
                recordedAt: p.recordedAt,
                activeRate: p.activeRate,
                peakRate: p.peakRate,
                scheduleHash: p.scheduleHash,
              }))
            ),
            updatedAt: Date.now(),
          },
          { merge: true }
        );
        written += zonePoints.length;
      }
      await batch.commit();
    }
    return written;
  }
}
