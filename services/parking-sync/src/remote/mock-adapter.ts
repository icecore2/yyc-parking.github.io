import type { RemoteDatabaseAdapter } from './adapter.ts';
import type { NormalizedParkingRecord } from '../types.ts';

export class MockRemoteAdapter implements RemoteDatabaseAdapter {
  private remoteStore = new Map<string, NormalizedParkingRecord>();

  constructor(initialRecords: NormalizedParkingRecord[] = []) {
    for (const r of initialRecords) {
      this.remoteStore.set(r.id, { ...r });
    }
  }

  getName(): string {
    return 'MockRemoteAdapter (In-Memory)';
  }

  async queryRemoteRecords(): Promise<NormalizedParkingRecord[]> {
    return Array.from(this.remoteStore.values()).map((r) => ({ ...r }));
  }

  async pushRecords(records: NormalizedParkingRecord[]): Promise<number> {
    for (const r of records) {
      this.remoteStore.set(r.id, { ...r, syncedToRemoteAt: Date.now() });
    }
    return records.length;
  }

  public getDirect(id: string): NormalizedParkingRecord | undefined {
    return this.remoteStore.get(id);
  }

  public clear(): void {
    this.remoteStore.clear();
  }
}
