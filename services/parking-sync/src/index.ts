import { LocalParkingDatabase } from './db/local-db.ts';
import { MyParkingFetcher } from './fetchers/myparking.ts';
import { ParkadeFetcher } from './fetchers/parkade.ts';
import { ImparkFetcher } from './fetchers/impark.ts';
import { TransitFetcher, IndigoFetcher, PreciseParkLinkFetcher } from './fetchers/transit-and-commercial.ts';
import { DiffEngine } from './sync/diff-engine.ts';
import { ImmediateSyncPusher } from './sync/pusher.ts';
import { FirestoreRemoteAdapter } from './remote/firestore-adapter.ts';
import { MockRemoteAdapter } from './remote/mock-adapter.ts';
import type { RemoteDatabaseAdapter } from './remote/adapter.ts';
import type { NormalizedParkingRecord } from './types.ts';

export class ParkingSyncCoordinator {
  private localDb: LocalParkingDatabase;
  private remoteAdapter: RemoteDatabaseAdapter;
  private diffEngine: DiffEngine;
  private pusher: ImmediateSyncPusher;

  constructor(options: { localDb?: LocalParkingDatabase; remoteAdapter?: RemoteDatabaseAdapter } = {}) {
    this.localDb = options.localDb || new LocalParkingDatabase();

    if (options.remoteAdapter) {
      this.remoteAdapter = options.remoteAdapter;
    } else if (process.env.USE_MOCK_REMOTE === '1' || !process.env.FIREBASE_ADMIN_PROJECT_ID) {
      this.remoteAdapter = new FirestoreRemoteAdapter();
    } else {
      this.remoteAdapter = new FirestoreRemoteAdapter();
    }

    this.diffEngine = new DiffEngine();
    this.pusher = new ImmediateSyncPusher();
  }

  async runSyncCycle(): Promise<{
    fetchedTotal: number;
    localStats: ReturnType<LocalParkingDatabase['getStats']>;
    diffsCount: number;
    pushedCount: number;
  }> {
    console.log('\n======================================================');
    console.log(`[Sync Coordinator] 🚀 Starting Parking Ingestion & Push Cycle at ${new Date().toISOString()}`);
    console.log('======================================================');

    // 1. Ingest from all providers
    const fetchers = [
      new MyParkingFetcher(),
      new ParkadeFetcher(),
      new ImparkFetcher(),
      new TransitFetcher(),
      new IndigoFetcher(),
      new PreciseParkLinkFetcher(),
    ];

    const allFetched: NormalizedParkingRecord[] = [];

    for (const fetcher of fetchers) {
      console.log(`[Ingest] Fetching records from provider '${fetcher.providerName}'...`);
      try {
        const records = await fetcher.fetchRecords();
        console.log(`  ✔ Received ${records.length} records for '${fetcher.providerName}'.`);
        allFetched.push(...records);
      } catch (err) {
        console.error(`  ✖ Failed to fetch from '${fetcher.providerName}':`, err);
      }
    }

    // 2. Store to Local Database First
    console.log(`\n[Local DB] Storing ${allFetched.length} records in local SQLite database first...`);
    const { inserted, updated, unchanged } = this.localDb.upsertLocalRecords(allFetched);
    console.log(`  ✔ Local SQLite upsert complete: ${inserted} new, ${updated} modified, ${unchanged} unchanged.`);

    const localStats = this.localDb.getStats();
    console.log(`  📊 Local DB Total: ${localStats.total} records across providers:`);
    for (const [pName, count] of Object.entries(localStats.byProvider)) {
      console.log(`     • ${pName}: ${count}`);
    }

    // 3. Diff Engine: Query existing remote records, hash using service algorithm, and compare
    const localRecords = this.localDb.getAllRecords();
    const diffResult = await this.diffEngine.computeDiff(localRecords, this.remoteAdapter);

    console.log(`\n[Diff Engine] Evaluation Results:`);
    console.log(`  • Total Local Records: ${diffResult.totalLocal}`);
    console.log(`  • Total Remote Records: ${diffResult.totalRemote}`);
    console.log(`  • Diff Items Detected: ${diffResult.toPush.length}`);
    console.log(`  • Unchanged (in-sync): ${diffResult.unchangedCount}`);

    // 4. Trigger Immediate Push if diffs are detected
    const pushReport = await this.pusher.pushDiffs(
      diffResult.toPush,
      this.remoteAdapter,
      this.localDb
    );

    console.log('\n======================================================');
    console.log(`[Sync Coordinator] Cycle finished: ${pushReport.pushedCount} records pushed to remote table.`);
    console.log('======================================================\n');

    return {
      fetchedTotal: allFetched.length,
      localStats,
      diffsCount: diffResult.toPush.length,
      pushedCount: pushReport.pushedCount,
    };
  }

  public getLocalDb(): LocalParkingDatabase {
    return this.localDb;
  }
}

// CLI entrypoint execution
const isMainModule =
  process.argv[1]?.endsWith('src/index.ts') ||
  process.argv[1]?.endsWith('src\\index.ts') ||
  process.argv[1]?.endsWith('src/index.js') ||
  process.argv[1]?.endsWith('src\\index.js');

if (isMainModule) {
  const coordinator = new ParkingSyncCoordinator();
  const isWatchMode = process.argv.includes('--watch') || process.argv.includes('-w');

  if (isWatchMode) {
    const intervalArg = process.argv.find((arg) => arg.startsWith('--interval='));
    const intervalMinutes = intervalArg
      ? parseInt(intervalArg.split('=')[1], 10)
      : parseInt(process.env.SYNC_INTERVAL_MINUTES || '15', 10);

    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    console.log(`\n======================================================`);
    console.log(`[Sync Daemon] 🔄 Starting recurring sync daemon`);
    console.log(`[Sync Daemon] Schedule interval: every ${intervalMinutes} minute(s)`);
    console.log(`[Sync Daemon] Press Ctrl+C to terminate cleanly`);
    console.log(`======================================================\n`);

    let isRunning = true;
    const shutdown = () => {
      console.log('\n[Sync Daemon] Gracefully shutting down sync daemon...');
      isRunning = false;
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    const loop = async () => {
      while (isRunning) {
        try {
          await coordinator.runSyncCycle();
        } catch (err) {
          console.error('[Sync Daemon] Error during sync cycle:', err);
        }

        if (!isRunning) break;
        console.log(`[Sync Daemon] Sleeping for ${intervalMinutes} minute(s) until next cycle...`);
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    loop();
  } else {
    coordinator
      .runSyncCycle()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Fatal sync error:', err);
        process.exit(1);
      });
  }
}
