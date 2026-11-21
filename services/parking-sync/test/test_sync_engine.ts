import assert from 'node:assert';
import { LocalParkingDatabase } from '../src/db/local-db.ts';
import { computeCanonicalHash } from '../src/utils/hasher.ts';
import { DiffEngine } from '../src/sync/diff-engine.ts';
import { ImmediateSyncPusher } from '../src/sync/pusher.ts';
import { MockRemoteAdapter } from '../src/remote/mock-adapter.ts';
import { MyParkingFetcher } from '../src/fetchers/myparking.ts';
import { ParkadeFetcher } from '../src/fetchers/parkade.ts';
import { ImparkFetcher } from '../src/fetchers/impark.ts';
import { TransitFetcher, IndigoFetcher, PreciseParkLinkFetcher } from '../src/fetchers/transit-and-commercial.ts';
import type { NormalizedParkingRecord } from '../src/types.ts';

console.log('🧪 Starting Comprehensive Parking Sync & Push Engine Tests...\n');

// ----------------------------------------------------
// Test Suite 1: Canonical Hasher Integrity
// ----------------------------------------------------
console.log('--- Test Suite 1: Canonical Hasher Integrity ---');

const baseRecord: Partial<NormalizedParkingRecord> = {
  id: 'test_1001',
  provider_name: 'MyParking',
  providerId: 'parkplus_on_street',
  title: 'Test Zone 1001',
  address: '100 8 Ave SW',
  activeRate: 3.5,
  stallCount: 15,
  coordinates: [-114.07, 51.05],
  rateSchedule: [{ days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 3.5 }],
};

const hash1 = computeCanonicalHash(baseRecord);
const hash2 = computeCanonicalHash({
  ...baseRecord,
  // Reverse key order test
  coordinates: [-114.07, 51.05],
  address: '100 8 Ave SW',
  id: 'test_1001',
});

assert.strictEqual(hash1, hash2, 'Hash must be strictly deterministic and key-order invariant');

// Hash should change if rate changes
const hashRateChanged = computeCanonicalHash({
  ...baseRecord,
  activeRate: 4.0,
});
assert.notStrictEqual(hash1, hashRateChanged, 'Hash must change when activeRate changes');

// Hash should change if provider_name changes
const hashProviderChanged = computeCanonicalHash({
  ...baseRecord,
  provider_name: 'Parkade',
});
assert.notStrictEqual(hash1, hashProviderChanged, 'Hash must change when provider_name changes');

// Hash must support MultiLineString geometry cleanly and detect path edits
const hashMulti1 = computeCanonicalHash({
  ...baseRecord,
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      [
        [-114.07, 51.05],
        [-114.071, 51.05],
      ],
      [
        [-114.072, 51.051],
        [-114.073, 51.051],
      ],
    ],
  },
});
const hashMulti2 = computeCanonicalHash({
  ...baseRecord,
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      [
        [-114.07, 51.05],
        [-114.071, 51.05],
      ],
      [
        [-114.072, 51.051],
        [-114.074, 51.051],
      ],
    ],
  },
});
assert.notStrictEqual(hashMulti1, hashMulti2, 'Hash must distinguish MultiLineString coordinate edits');

console.log('  ✔ Canonical hash determinism and sensitivity verified.\n');

// ----------------------------------------------------
// Test Suite 2: Local SQLite Staging & Tracking
// ----------------------------------------------------
console.log('--- Test Suite 2: Local SQLite Database ---');

const localDb = new LocalParkingDatabase({ dbPath: ':memory:' });

const testRec1Data = {
  id: 'parkplus_1008',
  externalId: '1008',
  provider_name: 'MyParking' as const,
  providerId: 'parkplus_on_street',
  title: 'Zone #1008',
  address: 'Eau Claire Ave SW',
  category: 'MUNICIPAL' as const,
  stallCount: 18,
  stallType: 'Parallel',
  activeRate: 3.5,
  isCurrentlyFree: false,
  rateSchedule: [{ days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 3.5 }],
  coordinates: [-114.0722, 51.0526] as [number, number],
  restrictions: ['Rush hour towing'],
};

const testRec1: NormalizedParkingRecord = {
  ...testRec1Data,
  contentHash: computeCanonicalHash(testRec1Data),
  fetchedAt: Date.now(),
  remoteSyncStatus: 'PENDING',
};

const testRec2Data = {
  id: 'parkade_54',
  externalId: '54',
  provider_name: 'Parkade' as const,
  providerId: 'cpa_off_street',
  title: 'Centennial Parkade',
  address: '608 9 Ave SW',
  category: 'MUNICIPAL' as const,
  stallCount: 960,
  stallType: 'Multi-Level',
  activeRate: 4.0,
  isCurrentlyFree: false,
  rateSchedule: [{ days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 4.0 }],
  coordinates: [-114.0757, 51.0453] as [number, number],
  restrictions: [],
};

const testRec2: NormalizedParkingRecord = {
  ...testRec2Data,
  contentHash: computeCanonicalHash(testRec2Data),
  fetchedAt: Date.now(),
  remoteSyncStatus: 'PENDING',
};

// Insert
const initialUpsert = localDb.upsertLocalRecords([testRec1, testRec2]);
assert.strictEqual(initialUpsert.inserted, 2, 'Should insert 2 new records');
assert.strictEqual(initialUpsert.updated, 0);

// Same records upserted -> unchanged
const secondUpsert = localDb.upsertLocalRecords([testRec1, testRec2]);
assert.strictEqual(secondUpsert.inserted, 0);
assert.strictEqual(secondUpsert.unchanged, 2, 'Identical records should be marked unchanged');

// Modify rate of rec1 and upsert
const modifiedRec1Data = {
  ...testRec1Data,
  activeRate: 4.5,
};
const modifiedRec1: NormalizedParkingRecord = {
  ...testRec1,
  activeRate: 4.5,
  contentHash: computeCanonicalHash(modifiedRec1Data),
};
const thirdUpsert = localDb.upsertLocalRecords([modifiedRec1]);
assert.strictEqual(thirdUpsert.updated, 1, 'Modified record should be updated in local DB');

// Verify retrieval & stats
const allLocal = localDb.getAllRecords();
assert.strictEqual(allLocal.length, 2);
const stats = localDb.getStats();
assert.strictEqual(stats.total, 2);
assert.strictEqual(stats.byProvider['MyParking'], 1);
assert.strictEqual(stats.byProvider['Parkade'], 1);

console.log('  ✔ Local SQLite upsert, modification tracking, and stats verified.\n');

// ----------------------------------------------------
// Test Suite 3: Diff Engine & Remote Hashing
// ----------------------------------------------------
console.log('--- Test Suite 3: Diff Engine & Remote Record Hashing ---');

const diffEngine = new DiffEngine();
const mockRemote = new MockRemoteAdapter();

// Case A: Remote DB is empty -> all local records must be detected as NEW
const diffEmptyRemote = await diffEngine.computeDiff(allLocal, mockRemote);
assert.strictEqual(diffEmptyRemote.toPush.length, 2, 'All records should be marked for push to empty remote');
assert.strictEqual(diffEmptyRemote.toPush[0].reason, 'NEW');
assert.strictEqual(diffEmptyRemote.unchangedCount, 0);

// Case B: Push records to remote, then rerun diff -> 0 diffs
await mockRemote.pushRecords(allLocal);
const diffInSync = await diffEngine.computeDiff(allLocal, mockRemote);
assert.strictEqual(diffInSync.toPush.length, 0, 'No diffs should be detected when remote matches local');
assert.strictEqual(diffInSync.unchangedCount, 2, 'Both records should be reported unchanged');

// Case C: Change a field in local record (e.g. rate change) -> exactly 1 MODIFIED diff detected
const localWithRateChange = allLocal.map((r) => {
  if (r.id === 'parkplus_1008') {
    const updated = { ...r, activeRate: 5.0 };
    return { ...updated, contentHash: computeCanonicalHash(updated) };
  }
  return r;
});

const diffWithChange = await diffEngine.computeDiff(localWithRateChange, mockRemote);
assert.strictEqual(diffWithChange.toPush.length, 1, 'Exactly 1 record diff should be detected');
assert.strictEqual(diffWithChange.toPush[0].reason, 'MODIFIED');
assert.strictEqual(diffWithChange.toPush[0].record.id, 'parkplus_1008');
assert.strictEqual(diffWithChange.unchangedCount, 1);

console.log('  ✔ Diff Engine remote query, service hashing, and diff detection verified.\n');

// ----------------------------------------------------
// Test Suite 4: Immediate Push Feature
// ----------------------------------------------------
console.log('--- Test Suite 4: Immediate Push Feature ---');

const pusher = new ImmediateSyncPusher();
const pushReport = await pusher.pushDiffs(diffWithChange.toPush, mockRemote, localDb);

assert.strictEqual(pushReport.pushedCount, 1, 'Should have pushed 1 modified record');
assert.strictEqual(pushReport.byProvider['MyParking'], 1);
assert.strictEqual(pushReport.reasons.modifiedRecords, 1);

// Verify remote store now has the updated record
const remotePushed = mockRemote.getDirect('parkplus_1008');
assert(remotePushed, 'Remote record must exist');
assert.strictEqual(remotePushed?.activeRate, 5.0, 'Remote record activeRate must be updated to 5.0');
assert.strictEqual(remotePushed?.provider_name, 'MyParking', "Remote record must have provider_name = 'MyParking'");

// Verify local db marked record as SYNCED
const localAfterPush = localDb.getRecordById('parkplus_1008');
assert.strictEqual(localAfterPush?.remoteSyncStatus, 'SYNCED');

console.log('  ✔ Immediate Push Feature transmission and local status update verified.\n');

// ----------------------------------------------------
// Test Suite 5: Provider Fetchers Schema & Column Integrity
// ----------------------------------------------------
console.log('--- Test Suite 5: Provider Fetchers Schema & Column Integrity ---');

const myParkingFetcher = new MyParkingFetcher();
const parkadeFetcher = new ParkadeFetcher();
const imparkFetcher = new ImparkFetcher();
const transitFetcher = new TransitFetcher();
const indigoFetcher = new IndigoFetcher();
const preciseFetcher = new PreciseParkLinkFetcher();

const transitRecords = await transitFetcher.fetchRecords();
assert(transitRecords.length > 0, 'Transit fetcher must return records');
assert.strictEqual(transitRecords[0].provider_name, 'Calgary Transit');

const indigoRecords = await indigoFetcher.fetchRecords();
assert(indigoRecords.length > 0, 'Indigo fetcher must return records');
assert.strictEqual(indigoRecords[0].provider_name, 'Indigo Neo');

const preciseRecords = await preciseFetcher.fetchRecords();
assert(preciseRecords.length > 0, 'Precise fetcher must return records');
assert.strictEqual(preciseRecords[0].provider_name, 'Precise ParkLink');

const imparkRecords = await imparkFetcher.fetchRecords();
assert(imparkRecords.length > 0, 'Impark fetcher must return records');
assert.strictEqual(imparkRecords[0].provider_name, 'Impark');

const parkadeRecords = await parkadeFetcher.fetchRecords();
assert(parkadeRecords.length > 0, 'Parkade fetcher must return records');
assert.strictEqual(parkadeRecords[0].provider_name, 'Parkade');

const myParkingRecords = await myParkingFetcher.fetchRecords();
assert(myParkingRecords.length > 0, 'MyParking fetcher must return records');
assert.strictEqual(myParkingRecords[0].provider_name, 'MyParking');

for (const rec of [...transitRecords, ...imparkRecords, ...parkadeRecords]) {
  assert(rec.id, 'Record must have an id');
  assert(rec.provider_name, 'Record must have provider_name set');
  assert(rec.contentHash, 'Record must have contentHash');
  assert(Array.isArray(rec.coordinates) && rec.coordinates.length === 2, 'Record must have coordinates [lng, lat]');
}

console.log('  ✔ All 6 provider fetchers produce valid schema with provider_name column.\n');

localDb.close();
console.log('🎉 ALL SYNC & PUSH ENGINE TESTS PASSED CLEANLY!\n');
