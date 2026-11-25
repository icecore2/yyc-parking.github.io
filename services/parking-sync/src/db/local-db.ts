import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NormalizedParkingRecord, ProviderName, RateHistoryPoint } from '../types.ts';
import { computePeakRate, computeRateScheduleHash } from '../utils/hasher.ts';

export interface LocalDbOptions {
  dbPath?: string; // e.g. path to file or ':memory:'
}

export class LocalParkingDatabase {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(options: LocalDbOptions = {}) {
    if (options.dbPath) {
      this.dbPath = options.dbPath;
    } else {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      const dataDir = path.resolve(currentDir, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'local_parking.db');
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_parking_zones (
        id TEXT PRIMARY KEY,
        external_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        title TEXT NOT NULL,
        address TEXT NOT NULL,
        category TEXT NOT NULL,
        stall_count INTEGER DEFAULT 0,
        stall_type TEXT DEFAULT 'Parallel',
        brz TEXT DEFAULT 'None',
        price_zone TEXT DEFAULT 'Standard',
        max_stay_hours REAL,
        enforceable_hours TEXT,
        active_rate REAL DEFAULT 0,
        is_currently_free INTEGER DEFAULT 0,
        rate_schedule_json TEXT NOT NULL,
        coordinates_lng REAL NOT NULL,
        coordinates_lat REAL NOT NULL,
        geometry_json TEXT,
        restrictions_json TEXT,
        payment_app TEXT,
        payment_url TEXT,
        raw_data_json TEXT,
        content_hash TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        synced_to_remote_at INTEGER,
        remote_sync_status TEXT DEFAULT 'PENDING'
      );

      CREATE INDEX IF NOT EXISTS idx_lpz_provider_name ON local_parking_zones(provider_name);
      CREATE INDEX IF NOT EXISTS idx_lpz_content_hash ON local_parking_zones(content_hash);
      CREATE INDEX IF NOT EXISTS idx_lpz_sync_status ON local_parking_zones(remote_sync_status);

      CREATE TABLE IF NOT EXISTS rate_history (
        zone_id TEXT NOT NULL,
        recorded_at INTEGER NOT NULL,
        active_rate REAL NOT NULL,
        peak_rate REAL NOT NULL,
        schedule_hash TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_rate_history_zone ON rate_history(zone_id, recorded_at);
    `);
  }

  /**
   * Upserts normalized records into the local database first.
   * If record doesn't exist or content_hash changed, status is set to PENDING.
   * If record exists with the exact same content_hash, only fetched_at is updated.
   */
  public upsertLocalRecords(records: NormalizedParkingRecord[]): {
    inserted: number;
    updated: number;
    unchanged: number;
  } {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    const selectStmt = this.db.prepare(
      'SELECT content_hash, remote_sync_status FROM local_parking_zones WHERE id = ?'
    );

    const insertStmt = this.db.prepare(`
      INSERT INTO local_parking_zones (
        id, external_id, provider_name, provider_id, title, address, category,
        stall_count, stall_type, brz, price_zone, max_stay_hours, enforceable_hours,
        active_rate, is_currently_free, rate_schedule_json, coordinates_lng, coordinates_lat,
        geometry_json, restrictions_json, payment_app, payment_url, raw_data_json,
        content_hash, fetched_at, synced_to_remote_at, remote_sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, NULL, 'PENDING'
      )
    `);

    const updateStmt = this.db.prepare(`
      UPDATE local_parking_zones SET
        external_id = ?, provider_name = ?, provider_id = ?, title = ?, address = ?, category = ?,
        stall_count = ?, stall_type = ?, brz = ?, price_zone = ?, max_stay_hours = ?, enforceable_hours = ?,
        active_rate = ?, is_currently_free = ?, rate_schedule_json = ?, coordinates_lng = ?, coordinates_lat = ?,
        geometry_json = ?, restrictions_json = ?, payment_app = ?, payment_url = ?, raw_data_json = ?,
        content_hash = ?, fetched_at = ?, remote_sync_status = 'PENDING'
      WHERE id = ?
    `);

    const touchStmt = this.db.prepare(
      'UPDATE local_parking_zones SET fetched_at = ? WHERE id = ?'
    );

    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const rec of records) {
        const existing = selectStmt.get(rec.id) as
          | { content_hash: string; remote_sync_status: string }
          | undefined;

        const rateScheduleJson = JSON.stringify(rec.rateSchedule || []);
        const geometryJson = rec.geometry ? JSON.stringify(rec.geometry) : null;
        const restrictionsJson = JSON.stringify(rec.restrictions || []);
        const rawDataJson = rec.rawData ? JSON.stringify(rec.rawData) : null;
        const [lng, lat] = rec.coordinates;

        if (!existing) {
          insertStmt.run(
            rec.id,
            rec.externalId,
            rec.provider_name,
            rec.providerId,
            rec.title,
            rec.address,
            rec.category,
            rec.stallCount,
            rec.stallType,
            rec.brz || 'None',
            rec.priceZone || 'Standard',
            rec.maxStayHours ?? null,
            rec.enforceableHours || null,
            rec.activeRate,
            rec.isCurrentlyFree ? 1 : 0,
            rateScheduleJson,
            lng,
            lat,
            geometryJson,
            restrictionsJson,
            rec.paymentApp || null,
            rec.paymentUrl || null,
            rawDataJson,
            rec.contentHash,
            rec.fetchedAt
          );
          inserted++;
        } else if (existing.content_hash !== rec.contentHash) {
          updateStmt.run(
            rec.externalId,
            rec.provider_name,
            rec.providerId,
            rec.title,
            rec.address,
            rec.category,
            rec.stallCount,
            rec.stallType,
            rec.brz || 'None',
            rec.priceZone || 'Standard',
            rec.maxStayHours ?? null,
            rec.enforceableHours || null,
            rec.activeRate,
            rec.isCurrentlyFree ? 1 : 0,
            rateScheduleJson,
            lng,
            lat,
            geometryJson,
            restrictionsJson,
            rec.paymentApp || null,
            rec.paymentUrl || null,
            rawDataJson,
            rec.contentHash,
            rec.fetchedAt,
            rec.id
          );
          updated++;
        } else {
          touchStmt.run(rec.fetchedAt, rec.id);
          unchanged++;
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return { inserted, updated, unchanged };
  }

  /**
   * Retrieves all local records as typed NormalizedParkingRecord array.
   */
  public getAllRecords(): NormalizedParkingRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM local_parking_zones ORDER BY id ASC')
      .all() as Record<string, unknown>[];

    return rows.map((row) => this.mapRowToRecord(row));
  }

  /**
   * Retrieves a single record by ID.
   */
  public getRecordById(id: string): NormalizedParkingRecord | null {
    const row = this.db
      .prepare('SELECT * FROM local_parking_zones WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    return row ? this.mapRowToRecord(row) : null;
  }

  /**
   * Marks records as SYNCED after successful remote push.
   */
  public markRecordsSynced(ids: string[], timestamp: number = Date.now()): void {
    if (ids.length === 0) return;
    const stmt = this.db.prepare(
      'UPDATE local_parking_zones SET remote_sync_status = ?, synced_to_remote_at = ? WHERE id = ?'
    );
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const id of ids) {
        stmt.run('SYNCED', timestamp, id);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Returns count summary of records by provider and sync status.
   */
  public getStats(): {
    total: number;
    synced: number;
    pending: number;
    byProvider: Record<string, number>;
  } {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) as cnt FROM local_parking_zones')
      .get() as { cnt: number };
    const syncedRow = this.db
      .prepare("SELECT COUNT(*) as cnt FROM local_parking_zones WHERE remote_sync_status = 'SYNCED'")
      .get() as { cnt: number };
    const pendingRow = this.db
      .prepare("SELECT COUNT(*) as cnt FROM local_parking_zones WHERE remote_sync_status = 'PENDING'")
      .get() as { cnt: number };

    const providerRows = this.db
      .prepare('SELECT provider_name, COUNT(*) as cnt FROM local_parking_zones GROUP BY provider_name')
      .all() as { provider_name: string; cnt: number }[];

    const byProvider: Record<string, number> = {};
    for (const r of providerRows) {
      byProvider[r.provider_name] = r.cnt;
    }

    return {
      total: totalRow.cnt,
      synced: syncedRow.cnt,
      pending: pendingRow.cnt,
      byProvider,
    };
  }

  /**
   * Appends an official rate-history point for each record whose rate schedule is new
   * or differs from its latest recorded point. Returns only the inserted points.
   */
  public appendRateHistory(
    records: NormalizedParkingRecord[],
    now: number = Date.now()
  ): RateHistoryPoint[] {
    const latestStmt = this.db.prepare(
      'SELECT schedule_hash FROM rate_history WHERE zone_id = ? ORDER BY recorded_at DESC, rowid DESC LIMIT 1'
    );
    const insertStmt = this.db.prepare(
      'INSERT INTO rate_history (zone_id, recorded_at, active_rate, peak_rate, schedule_hash) VALUES (?, ?, ?, ?, ?)'
    );

    const inserted: RateHistoryPoint[] = [];
    this.db.exec('BEGIN TRANSACTION');
    try {
      for (const rec of records) {
        const scheduleHash = computeRateScheduleHash(rec);
        const latest = latestStmt.get(rec.id) as { schedule_hash: string } | undefined;
        if (latest && latest.schedule_hash === scheduleHash) continue;

        const point: RateHistoryPoint = {
          zoneId: rec.id,
          recordedAt: now,
          activeRate: Number(Number(rec.activeRate || 0).toFixed(2)),
          peakRate: computePeakRate(rec),
          scheduleHash,
        };
        insertStmt.run(point.zoneId, point.recordedAt, point.activeRate, point.peakRate, point.scheduleHash);
        inserted.push(point);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
    return inserted;
  }

  public getRateHistory(zoneId: string): RateHistoryPoint[] {
    const rows = this.db
      .prepare(
        'SELECT zone_id, recorded_at, active_rate, peak_rate, schedule_hash FROM rate_history WHERE zone_id = ? ORDER BY recorded_at ASC, rowid ASC'
      )
      .all(zoneId) as {
      zone_id: string;
      recorded_at: number;
      active_rate: number;
      peak_rate: number;
      schedule_hash: string;
    }[];
    return rows.map((r) => ({
      zoneId: r.zone_id,
      recordedAt: Number(r.recorded_at),
      activeRate: Number(r.active_rate),
      peakRate: Number(r.peak_rate),
      scheduleHash: r.schedule_hash,
    }));
  }

  public close(): void {
    this.db.close();
  }

  private mapRowToRecord(row: Record<string, unknown>): NormalizedParkingRecord {
    return {
      id: String(row.id),
      externalId: String(row.external_id),
      provider_name: row.provider_name as ProviderName,
      providerId: String(row.provider_id),
      title: String(row.title),
      address: String(row.address),
      category: row.category as 'MUNICIPAL' | 'COMMERCIAL' | 'TRANSIT',
      stallCount: Number(row.stall_count),
      stallType: String(row.stall_type),
      brz: String(row.brz || 'None'),
      priceZone: String(row.price_zone || 'Standard'),
      maxStayHours: row.max_stay_hours !== null ? Number(row.max_stay_hours) : undefined,
      enforceableHours: row.enforceable_hours ? String(row.enforceable_hours) : undefined,
      activeRate: Number(row.active_rate),
      isCurrentlyFree: Boolean(row.is_currently_free),
      rateSchedule: row.rate_schedule_json ? JSON.parse(String(row.rate_schedule_json)) : [],
      coordinates: [Number(row.coordinates_lng), Number(row.coordinates_lat)],
      geometry: row.geometry_json ? JSON.parse(String(row.geometry_json)) : undefined,
      restrictions: row.restrictions_json ? JSON.parse(String(row.restrictions_json)) : [],
      paymentApp: row.payment_app ? String(row.payment_app) : undefined,
      paymentUrl: row.payment_url ? String(row.payment_url) : undefined,
      contentHash: String(row.content_hash),
      rawData: row.raw_data_json ? JSON.parse(String(row.raw_data_json)) : undefined,
      fetchedAt: Number(row.fetched_at),
      syncedToRemoteAt: row.synced_to_remote_at ? Number(row.synced_to_remote_at) : null,
      remoteSyncStatus: row.remote_sync_status as 'PENDING' | 'SYNCED' | 'FAILED',
    };
  }
}
