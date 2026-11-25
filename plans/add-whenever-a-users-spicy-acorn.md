# Per-user posted prices + official price history graph

## Context
Users want to post the price they actually paid or saw at a pin. Each post must stay private to that user and must never change the shared ("global") data. The zone's History tab should plot two series on one graph:
- **Official**: the server-side rate history for the zone.
- **Mine**: the user's own posted prices.

What exists today:
- History tab (`webapp/components/map/ZoneDetailSheet.tsx:449`): a list of `RateSnapshot`s, stored only in `localStorage` (`firestore.ts:585` `getZoneRateSnapshots` / `:727` `saveZoneRateSnapshots`). It has no graph.
- No server-side history. The sync service overwrites `activeRate` in `parking_data/{id}` on every change (`services/parking-sync/src/remote/firestore-adapter.ts:98`).

Decisions (user confirmed): add a real server-side history in the sync service, and store user posts in Firestore per user with a localStorage fallback for `demo_*` users.

## Part A — Server-side official rate history (sync service)

1. **Types** (`services/parking-sync/src/types.ts`): add `RateHistoryPoint { zoneId; recordedAt; activeRate; peakRate; scheduleHash }`. `peakRate` is the max `ratePerHour` across `rateSchedule`.
2. **SQLite** (`src/db/local-db.ts`):
   - Add a table `rate_history(zone_id TEXT, recorded_at INTEGER, active_rate REAL, peak_rate REAL, schedule_hash TEXT)` with an index on `zone_id`.
   - Add `appendRateHistory(records)`. It inserts a row only when the zone has no history yet, or when its latest `schedule_hash` differs.
   - Add `getRateHistory(zoneId)`.
   - The dedupe uses a hash of `rateSchedule` + `activeRate` truncated to 2dp. A time-of-day value like `isCurrentlyFree` does not count, so the 30-minute cron doesn't add a point every run. Reuse the canonical-hash helper in `src/utils/hasher.ts`.
3. **Remote adapter** (`src/remote/adapter.ts`, `firestore-adapter.ts`, `mock-adapter.ts`):
   - Add `pushRateHistory(points)`.
   - Firestore writes `parking_rate_history/{zoneId}` as `{ zoneId, points: arrayUnion(...) }` in 400-doc batches.
   - The simulated mode only logs.
4. **Coordinator** (`src/index.ts`): after upsert, call `appendRateHistory`. Push only the new points with `pushRateHistory`, next to `pushDiffs`.
5. **Test** (`services/parking-sync/test/test_sync_engine.ts`):
   - Same schedule twice → one point.
   - Changed schedule → two points.
   - Mock adapter receives only the new points.

## Part B — Webapp: read official history
1. **API** — new `webapp/app/api/parking/history/route.ts`, `GET ?zoneId=`:
   - Read `parking_rate_history/{zoneId}` from Firestore with the client SDK, the same way `app/api/parking/route.ts` does.
   - Fallback: the `rate_history` table in `../services/parking-sync/data/local_parking.db`, through the same `eval('require')('node:sqlite')` helper. Extract `getDatabaseSyncClass` into a small shared module, `lib/parking/sqlite.ts`, and use it in both routes.
   - Return `{ source, points: [{recordedAt, rate}] }` sorted ascending. On failure, return `{ source:'empty', points: [] }`.
   - Validate `zoneId` (`^[\w-]{1,100}$`).
2. **Rules** (`webapp/firestore.rules`):
   - Document collection 8 `parking_rate_history/{zoneId}` in the data-model header.
   - Add `match /parking_rate_history/{zoneId} { allow read: if true; allow write: if false; }`.

## Part C — Webapp: per-user posted prices
1. **Type** (`lib/parking/types.ts`): add `UserPriceReport { id; zoneId; rate; note?; observedAt; createdAt; updatedAt?; isExample? }`. Keep `RateSnapshot` until the migration below.
2. **Data layer** (`lib/firebase/firestore.ts`): copy the favorites dual-backend pattern (`getUserFavorites` at `:98` / `saveUserFavorite`). Add:
   - `getUserPriceReports(uid, zoneId)`: Firestore `users/{uid}/price_reports`, filtered `where('zoneId','==',zoneId)`; for `demo_*` users, the localStorage key `yyc_parking_price_reports` scoped by uid.
   - `saveUserPriceReport` and `deleteUserPriceReport`. Both use `sanitizeFirestorePayload` and fire `notifyUserDataChanged()`.
   - **Migration:** on first read, convert the legacy `yyc_zone_snapshots_*` items for that zone (`period` → `note`, `createdAt` → `observedAt`) into reports, then drop the legacy key. Keep the example rows through `createExampleRateSnapshots`, mapped to `isExample: true` reports so the onboarding contract still holds.
   - These functions only write under `users/{uid}`. Nothing touches `parking_data` or `parking_rate_history`.
3. **Rules**:
   - Document collection 9 `users/{uid}/price_reports/{reportId}` in the header.
   - Owner-only read and write.
   - Validate `zoneId` (string, 1–100 chars), `rate` (number 0–1000), `note` (≤200 chars), `observedAt` (number > 0), and keep `createdAt` immutable, matching the existing favorites/sessions helpers.
4. **UI** (`components/map/ZoneDetailSheet.tsx`, History tab):
   - Replace "Take Snapshot" with **"Post a price"**: an inline form with rate (prefilled with `zone.activeRate`), an optional note, and a date that defaults to now.
   - Keep the existing edit and delete rows, now backed by reports.
   - Fetch official history from `/api/parking/history?zoneId=${zone.id}` when the History tab opens.
5. **Graph** — new `components/map/PriceHistoryChart.tsx`, a hand-rolled SVG in the same style as `RateCurveChart.tsx`:
   - X axis is time.
   - **Official** is a stepped emerald line. It is extended to "now" with the current `zone.activeRate`; when there is no history it is a single flat line at the current rate.
   - **Mine** is amber dots, with dashed outlines for `isExample` points.
   - A legend shows both series, plus an empty state.
   - A caption reads "Your posted prices are private and don't change official rates."

## Tests / contracts to update
- `webapp/test/test_example_data_and_onboarding.js:202,219`:
  - It checks for `createRateSnapshot`, `getZoneRateSnapshots` and `saveZoneRateSnapshots`. Update it to the new names (`getUserPriceReports`, `saveUserPriceReport`).
  - Add rules assertions for `price_reports` and `parking_rate_history`.
- New `webapp/test/test_price_reports.js` (source-text assertions, the same style as the other suites):
  - The report functions write only under `'users', userId, 'price_reports'`.
  - `ZoneDetailSheet` renders `PriceHistoryChart` with both series.
  - The history route validates `zoneId`.
- Z-index: the chart is inline in the sheet and adds no layers, so `test_ui_layering.js` is unaffected.

## Verification
1. `npm run sync:test`, then `npm run sync:run` twice. Use `sqlite3` or a node one-liner to confirm `rate_history` has one row per zone and that the second run adds nothing.
2. `cd webapp && npx tsc --noEmit && npm run lint && npm run webapp:test`.
3. `npm run webapp:dev`, open `/app` in the browser pane, pick a pin and open History:
   - The Official line comes from `/api/parking/history`; confirm the request in the network panel.
   - Post a price; an amber dot appears.
   - Reload; the dot is still there (demo user → localStorage).
   - Open the same zone as a different demo uid; the dot isn't there.
   - `/api/parking` and `/api/parking/history` responses are unchanged by the post.
