import path from 'node:path';

/**
 * Loads node:sqlite's DatabaseSync at runtime. `eval('require')` is deliberate: it keeps
 * the bundler from trying to resolve node:sqlite and stays compatible with @types/node v20.
 * Server-only.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDatabaseSyncClass(): any {
  try {
    const mod = eval('require')('node:sqlite');
    return mod?.DatabaseSync || null;
  } catch {
    return null;
  }
}

/** Path to the parking-sync service's local SQLite database. */
export function getLocalParkingDbPath(): string {
  return path.resolve(process.cwd(), '../services/parking-sync/data/local_parking.db');
}
