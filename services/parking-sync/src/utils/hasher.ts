import crypto from 'node:crypto';
import type { NormalizedParkingRecord } from '../types.ts';

/**
 * Deterministically serializes an object with sorted keys
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    if (typeof obj === 'number') {
      return Number(obj.toFixed(6)).toString();
    }
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(',')}}`;
}

/**
 * Hash of only the price-relevant fields (rate schedule + active rate). Used to decide
 * whether a new official rate-history point is needed. Excludes isCurrentlyFree and
 * other non-price fields so unrelated edits don't create history points.
 */
export function computeRateScheduleHash(
  record: Pick<NormalizedParkingRecord, 'activeRate' | 'rateSchedule'>
): string {
  const canonical = {
    activeRate: Number(Number(record.activeRate || 0).toFixed(2)),
    rateSchedule: Array.isArray(record.rateSchedule)
      ? record.rateSchedule.map((p) => ({
          days: String(p.days || ''),
          startTime: String(p.startTime || ''),
          endTime: String(p.endTime || ''),
          ratePerHour: Number(Number(p.ratePerHour || 0).toFixed(2)),
          isFree: Boolean(p.isFree),
        }))
      : [],
  };
  return crypto.createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

/** Highest hourly rate in the schedule, or activeRate when the schedule is empty. */
export function computePeakRate(
  record: Pick<NormalizedParkingRecord, 'activeRate' | 'rateSchedule'>
): number {
  const rates = (record.rateSchedule || [])
    .map((p) => Number(p.ratePerHour))
    .filter((r) => Number.isFinite(r));
  const peak = rates.length > 0 ? Math.max(...rates) : Number(record.activeRate || 0);
  return Number(peak.toFixed(2));
}

/**
 * Computes a deterministic SHA-256 canonical hash of the critical fields of a parking record.
 * Both local records and remote records must be passed through this function so hash comparison is exact.
 */
export function computeCanonicalHash(
  record: Partial<NormalizedParkingRecord> | Record<string, unknown>
): string {
  const geom = record.geometry as NormalizedParkingRecord['geometry'] | undefined | null;
  const canonicalRepresentation = {
    id: String(record.id || ''),
    provider_name: String(record.provider_name || ''),
    providerId: String(record.providerId || ''),
    title: String(record.title || '').trim(),
    address: String(record.address || '').trim(),
    stallCount: Number(record.stallCount || 0),
    stallType: String(record.stallType || ''),
    priceZone: String(record.priceZone || ''),
    activeRate: Number(Number(record.activeRate || 0).toFixed(2)),
    isCurrentlyFree: Boolean(record.isCurrentlyFree),
    rateSchedule: Array.isArray(record.rateSchedule)
      ? record.rateSchedule.map((p) => ({
          days: String(p.days || ''),
          startTime: String(p.startTime || ''),
          endTime: String(p.endTime || ''),
          ratePerHour: Number(Number(p.ratePerHour || 0).toFixed(2)),
          isFree: Boolean(p.isFree),
        }))
      : [],
    coordinates: Array.isArray(record.coordinates)
      ? [
          Number(Number(record.coordinates[0] || 0).toFixed(6)),
          Number(Number(record.coordinates[1] || 0).toFixed(6)),
        ]
      : [0, 0],
    geometry: geom
      ? geom.type === 'MultiLineString'
        ? {
            type: 'MultiLineString',
            coordinates: Array.isArray(geom.coordinates)
              ? geom.coordinates.map((path) =>
                  Array.isArray(path)
                    ? path.map((pt) => [
                        Number(Number(pt[0]).toFixed(6)),
                        Number(Number(pt[1]).toFixed(6)),
                      ])
                    : []
                )
              : [],
          }
        : {
            type: 'LineString',
            coordinates: Array.isArray(geom.coordinates)
              ? geom.coordinates.map((pt) => [
                  Number(Number(pt[0]).toFixed(6)),
                  Number(Number(pt[1]).toFixed(6)),
                ])
              : [],
          }
      : null,
    restrictions: Array.isArray(record.restrictions)
      ? [...record.restrictions].map((r) => String(r).trim()).sort()
      : [],
  };

  const json = stableStringify(canonicalRepresentation);
  return crypto.createHash('sha256').update(json).digest('hex');
}
