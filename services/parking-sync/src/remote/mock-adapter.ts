import type { RemoteDatabaseAdapter } from './adapter.ts';
import type { NormalizedParkingRecord, RateHistoryPoint } from '../types.ts';

export class MockRemoteAdapter implements RemoteDatabaseAdapter {
  private remoteStore = new Map<string, NormalizedParkingRecord>();
  private historyStore = new Map<string, RateHistoryPoint[]>();

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

  async pushRateHistory(points: RateHistoryPoint[]): Promise<number> {
    for (const p of points) {
      const list = this.historyStore.get(p.zoneId) || [];
      list.push({ ...p });
      this.historyStore.set(p.zoneId, list);
    }
    return points.length;
  }

  public getHistory(zoneId: string): RateHistoryPoint[] {
    return (this.historyStore.get(zoneId) || []).map((p) => ({ ...p }));
  }

  public getDirect(id: string): NormalizedParkingRecord | undefined {
    return this.remoteStore.get(id);
  }

  public clear(): void {
    this.remoteStore.clear();
    this.historyStore.clear();
  }
}
