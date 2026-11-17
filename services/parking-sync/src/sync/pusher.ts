import type { DiffItem, NormalizedParkingRecord, SyncPushReport } from '../types.ts';
import type { RemoteDatabaseAdapter } from '../remote/adapter.ts';
import { LocalParkingDatabase } from '../db/local-db.ts';

export class ImmediateSyncPusher {
  /**
   * Pushes diff records immediately to the remote database table 'parking_data'
   * and updates local tracking state to SYNCED.
   */
  async pushDiffs(
    diffItems: DiffItem[],
    remoteAdapter: RemoteDatabaseAdapter,
    localDb?: LocalParkingDatabase
  ): Promise<SyncPushReport> {
    const startTime = Date.now();
    const byProvider: Record<string, number> = {};
    let newRecords = 0;
    let modifiedRecords = 0;

    if (diffItems.length === 0) {
      console.log('[Pusher] No diffs detected. Remote database is already 100% up to date.');
      return {
        timestamp: startTime,
        pushedCount: 0,
        byProvider: {},
        reasons: { newRecords: 0, modifiedRecords: 0 },
        durationMs: Date.now() - startTime,
      };
    }

    const recordsToPush: NormalizedParkingRecord[] = [];
    const pushedIds: string[] = [];

    for (const item of diffItems) {
      recordsToPush.push(item.record);
      pushedIds.push(item.record.id);

      const pName = item.record.provider_name;
      byProvider[pName] = (byProvider[pName] || 0) + 1;

      if (item.reason === 'NEW') {
        newRecords++;
      } else {
        modifiedRecords++;
      }
    }

    console.log(
      `[Pusher] 🚀 Triggering Immediate Push of ${diffItems.length} diffs to remote table 'parking_data'...`
    );
    console.log(
      `[Pusher] Breakdown: ${newRecords} new, ${modifiedRecords} modified records.`
    );
    for (const [provider, count] of Object.entries(byProvider)) {
      console.log(`  • ${provider}: ${count} record(s)`);
    }

    // Push to remote database
    const pushedCount = await remoteAdapter.pushRecords(recordsToPush);

    // Update local database status to SYNCED
    if (localDb) {
      localDb.markRecordsSynced(pushedIds, Date.now());
      console.log(`[Pusher] Updated ${pushedIds.length} records in local database to 'SYNCED'.`);
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Pusher] Push completed successfully in ${durationMs}ms.`);

    return {
      timestamp: startTime,
      pushedCount,
      byProvider,
      reasons: {
        newRecords,
        modifiedRecords,
      },
      durationMs,
    };
  }
}
