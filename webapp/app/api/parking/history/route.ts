import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import fs from 'node:fs';
import { db } from '@/lib/firebase/client';
import { getDatabaseSyncClass, getLocalParkingDbPath } from '@/lib/parking/sqlite';
import type { OfficialRatePoint } from '@/lib/parking/types';

/**
 * GET /api/parking/history?zoneId=<parking_data id>
 *
 * Official rate history for one zone, written only by the parking-sync service.
 * Reads Firestore `parking_rate_history/{zoneId}`, then falls back to the local
 * SQLite `rate_history` table. User-posted prices are never part of this response.
 */

const ZONE_ID_PATTERN = /^[\w-]{1,100}$/;
const MAX_POINTS = 200;

type HistorySource = 'firestore' | 'local_sqlite' | 'empty';

function normalize(points: OfficialRatePoint[]): OfficialRatePoint[] {
  return points
    .filter((p) => Number.isFinite(p.recordedAt) && Number.isFinite(p.rate) && p.rate >= 0)
    .sort((a, b) => a.recordedAt - b.recordedAt)
    .slice(-MAX_POINTS);
}

async function readFromFirestore(zoneId: string): Promise<OfficialRatePoint[] | null> {
  if (!db || !db.type) return null;
  const snap = await getDoc(doc(db, 'parking_rate_history', zoneId));
  if (!snap.exists()) return null;
  const raw = snap.data().points;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return normalize(
    raw.map((p: Record<string, unknown>) => ({
      recordedAt: Number(p.recordedAt),
      rate: Number(p.activeRate),
    }))
  );
}

function readFromLocalSqlite(zoneId: string): OfficialRatePoint[] | null {
  const DatabaseSync = getDatabaseSyncClass();
  if (!DatabaseSync) return null;
  const dbPath = getLocalParkingDbPath();
  if (!fs.existsSync(dbPath)) return null;

  const sqlite = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const hasTable = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rate_history'")
      .get();
    if (!hasTable) return null;
    const rows = sqlite
      .prepare(
        'SELECT recorded_at, active_rate FROM rate_history WHERE zone_id = ? ORDER BY recorded_at ASC'
      )
      .all(zoneId) as { recorded_at: number; active_rate: number }[];
    if (rows.length === 0) return null;
    return normalize(
      rows.map((r) => ({ recordedAt: Number(r.recorded_at), rate: Number(r.active_rate) }))
    );
  } finally {
    sqlite.close();
  }
}

export async function GET(request: Request) {
  const zoneId = new URL(request.url).searchParams.get('zoneId') || '';
  if (!ZONE_ID_PATTERN.test(zoneId)) {
    return NextResponse.json({ error: 'Invalid zoneId' }, { status: 400 });
  }

  let source: HistorySource = 'empty';
  let points: OfficialRatePoint[] = [];

  try {
    const remote = await readFromFirestore(zoneId);
    if (remote) {
      source = 'firestore';
      points = remote;
    }
  } catch (err) {
    console.warn('[api/parking/history] Firestore read failed; trying local SQLite', err);
  }

  if (source === 'empty') {
    try {
      const local = readFromLocalSqlite(zoneId);
      if (local) {
        source = 'local_sqlite';
        points = local;
      }
    } catch (err) {
      console.warn('[api/parking/history] Local SQLite read failed', err);
    }
  }

  return NextResponse.json(
    { zoneId, source, points },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
