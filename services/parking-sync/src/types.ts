export type ProviderName =
  | 'MyParking'
  | 'Parkade'
  | 'Impark'
  | 'Indigo Neo'
  | 'Precise ParkLink'
  | 'Calgary Transit';

export const PROVIDER_NAMES: readonly ProviderName[] = [
  'MyParking',
  'Parkade',
  'Impark',
  'Indigo Neo',
  'Precise ParkLink',
  'Calgary Transit',
] as const;

export interface RatePeriod {
  days: string;
  startTime: string;
  endTime: string;
  ratePerHour: number;
  isFree?: boolean;
}

export interface NormalizedParkingRecord {
  id: string; // Global unique ID e.g. 'parkplus_1008', 'parkade_lot54', 'impark_316'
  externalId: string; // Provider-specific ID e.g. '1008', '54', '316'
  provider_name: ProviderName; // Dedicated column required by user e.g. 'MyParking', 'Parkade', 'Impark'
  providerId: string; // Slug e.g. 'parkplus_on_street', 'cpa_off_street', 'impark'
  title: string;
  address: string;
  category: 'MUNICIPAL' | 'COMMERCIAL' | 'TRANSIT';
  stallCount: number;
  stallType: string;
  brz?: string;
  priceZone?: string;
  maxStayHours?: number;
  enforceableHours?: string;
  activeRate: number;
  isCurrentlyFree: boolean;
  rateSchedule: RatePeriod[];
  coordinates: [number, number]; // [lng, lat]
  geometry?:
    | {
        type: 'LineString';
        coordinates: [number, number][];
      }
    | {
        type: 'MultiLineString';
        coordinates: [number, number][][];
      };
  restrictions: string[];
  paymentApp?: string;
  paymentUrl?: string;
  contentHash: string; // SHA-256 canonical hash
  rawData?: Record<string, unknown>;
  fetchedAt: number;
  syncedToRemoteAt?: number | null;
  remoteSyncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
}

/**
 * One official rate observation for a zone. Appended only when the zone's rate
 * schedule changes, so the history is a list of real price changes.
 */
export interface RateHistoryPoint {
  zoneId: string;
  recordedAt: number;
  activeRate: number;
  peakRate: number;
  scheduleHash: string;
}

export interface DiffItem {
  record: NormalizedParkingRecord;
  reason: 'NEW' | 'MODIFIED';
  remoteHash?: string;
  localHash: string;
}

export interface DiffResult {
  toPush: DiffItem[];
  unchangedCount: number;
  totalLocal: number;
  totalRemote: number;
}

export interface SyncPushReport {
  timestamp: number;
  pushedCount: number;
  byProvider: Record<string, number>;
  reasons: {
    newRecords: number;
    modifiedRecords: number;
  };
  durationMs: number;
}
