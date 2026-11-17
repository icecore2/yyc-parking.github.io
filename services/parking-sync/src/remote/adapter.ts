import type { NormalizedParkingRecord } from '../types.ts';

export interface RemoteDatabaseAdapter {
  getName(): string;

  /**
   * Queries existing records currently on the remote database.
   */
  queryRemoteRecords(): Promise<NormalizedParkingRecord[]>;

  /**
   * Pushes (creates or updates) records to the remote database table 'parking_data'.
   * @param records Records to push immediately
   * @returns Total number of records successfully written
   */
  pushRecords(records: NormalizedParkingRecord[]): Promise<number>;
}
