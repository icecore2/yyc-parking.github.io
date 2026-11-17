import type { NormalizedParkingRecord, DiffItem, DiffResult } from '../types.ts';
import type { RemoteDatabaseAdapter } from '../remote/adapter.ts';
import { computeCanonicalHash } from '../utils/hasher.ts';

export class DiffEngine {
  /**
   * Queries existing remote records, calculates canonical hashes for remote records
   * using the service's hashing function, and compares with local records.
   */
  async computeDiff(
    localRecords: NormalizedParkingRecord[],
    remoteAdapter: RemoteDatabaseAdapter
  ): Promise<DiffResult> {
    console.log(
      `[DiffEngine] Querying existing records from remote database using ${remoteAdapter.getName()}...`
    );
    const remoteRecords = await remoteAdapter.queryRemoteRecords();

    // Map remote records by ID and compute hash using service hashing algorithm
    const remoteMap = new Map<string, { record: NormalizedParkingRecord; hash: string }>();
    for (const r of remoteRecords) {
      const hash = computeCanonicalHash(r);
      remoteMap.set(r.id, { record: r, hash });
    }

    const toPush: DiffItem[] = [];
    let unchangedCount = 0;

    for (const local of localRecords) {
      const localHash = computeCanonicalHash(local);
      const remoteEntry = remoteMap.get(local.id);

      if (!remoteEntry) {
        // Record does not exist on remote -> NEW
        toPush.push({
          record: local,
          reason: 'NEW',
          localHash,
        });
      } else if (remoteEntry.hash !== localHash) {
        // Record exists, but hash is different -> MODIFIED
        toPush.push({
          record: local,
          reason: 'MODIFIED',
          remoteHash: remoteEntry.hash,
          localHash,
        });
      } else {
        // Hashes match exactly -> UNCHANGED
        unchangedCount++;
      }
    }

    return {
      toPush,
      unchangedCount,
      totalLocal: localRecords.length,
      totalRemote: remoteRecords.length,
    };
  }
}
