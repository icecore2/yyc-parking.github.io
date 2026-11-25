# Zone Rates & Price History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show correct, time-aware rates when a user inspects a zone, and give the History tab real price history: rate changes stored by the sync service, merged with the live rate from the API and the user's own snapshots.

**Architecture:** The sync service's HTML rate parser is fixed so the stored `rateSchedule` is accurate. It also records a `zone_rate_history` row whenever a zone's schedule changes, and pushes those rows to Firestore at `parking_data/{zoneId}/rate_history`. The webapp gets a pure schedule resolver (`lib/parking/rate-schedule.ts`) that computes the current rate in Calgary time from `zone.rateSchedule`. The inspect UI, the chart and the zone loader all use it. A new `GET /api/parking/history` route serves stored history (Firestore → SQLite → empty). A pure `buildPriceHistory()` merges that history with the live rate and the user's snapshots for the History tab.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Firebase client SDK (server reads), `node:sqlite`, Node 22 `--experimental-strip-types`, plain `node:assert` tests.

**Spec:** The user request: "Fix the rates when inspecting a parking. Also fix the prices history, make sure to use the stored price + what comes from the API." It was clarified to *server-side history*. The diagnosis below is the working spec.

### Diagnosis (what is broken today)

1. `ZoneDetailSheet.tsx:69` calls `parseRateSchedule(zone.enforceableHours)`. `enforceableHours` is an hours string (`"0910-1750 MON-SAT"`), not rate HTML, so this always returns zero intervals. The Rates tab then shows invented numbers: `$activeRate` for weekdays, `activeRate - 1` for Saturday, and a flat chart.
2. The stored `activeRate` is the **peak** rate at sync time (`parseHtmlRates` returns `foundMaxRate`), and `isCurrentlyFree` is "has no paid period". The "Current Live Rate" badge, the preview card and the map pins all show the peak price at any hour.
3. `services/parking-sync/src/utils/rate-parser.ts::parseHtmlRates` mis-parses real headers (counts from the local DB):
   - `Mon-Sat …` (30) and `Mon-Thu` / `Fri` / `Sun …` are all stored as `Mon-Fri`.
   - 24-hour headers (`Weekdays: 09:00 to 15:00`, `Saturday: 09:00 to 18:00`) don't match the 12-hour regex and default to `09:00–18:00`.
   - `Free parking to 9 AM` (≈1,200), `Loading zone:`, `No Parking at this time`, `Saturday: Max 9 Hours`, `Mayor VIP` and `Taxi zone:` each become a bogus `Mon-Fri 09:00–18:00` period. The free one overlaps the real paid periods.
4. The History tab reads only a per-browser localStorage list plus two invented example rows (`"2024 Base Rate" = activeRate - 0.5`). Nothing records real price changes.

## Global Constraints

- Webapp and sync service only. Legacy `js/`, `android/` and `ios/` parsers are out of scope. Note this in the final PR description.
- No new npm dependencies.
- Tests are plain Node scripts using `assert`. New webapp suites that import `.ts` re-exec with `--experimental-strip-types`, using the pattern at the top of `webapp/test/test_calgary_clock.js`. Add each new suite to the `test` script in `webapp/package.json`.
- Webapp modules imported by those tests may only use `import type` for local imports, which strip-types erases. Otherwise they must have no imports.
- Sync service imports use explicit `.ts` extensions and need Node 22 or later.
- All rate-time evaluation uses Calgary wall-clock time via `getCalgaryTime()` (`webapp/lib/parking/calgary-clock.ts`, `America/Edmonton`), never the browser's local time.
- Statutory holidays are not modelled. Only Sunday is treated as the "Sunday/Holidays" day.
- Firestore stays read-only for clients. Any new stored field or path is documented in the data-model header of `webapp/firestore.rules`.
- Before writing the route handler in Task 5, read the route-handler guide in `webapp/node_modules/next/dist/docs/` (per `webapp/AGENTS.md`).

## Review Focus

1. **Overnight and end-of-day windows.** Commercial schedules use `18:00→06:00` and `00:00→23:59`. At 02:00, or at 23:59:30, the resolver must return the window's rate and not "free". *(Task 2 tests.)*
2. **Stale stored rows with overlapping free and paid periods.** Firestore/SQLite rows synced before Task 1 still contain the bogus `Mon-Fri 09:00–18:00 free` period. A paid period must win when both match. *(Task 2 test.)*
3. **Browser not in Calgary.** A user in Toronto at 12:00 local is at 10:00 Calgary, so the resolver must use the 10:00 rate. *(Task 2 test via `getCalgaryTime(new Date('2026-11-25T17:00:00Z'))`.)*
4. **History source missing.** This covers an old SQLite DB without `zone_rate_history`, an empty Firestore subcollection, or a bad `zoneId`. The API returns 200 with `entries: []`, or 400 for a bad id, and the tab still shows the live row. *(Task 5 tests.)*
5. **Non-rate changes must not create history rows.** A geometry-only change (content hash changes, schedule identical) or repeated unchanged sync runs add no `zone_rate_history` row. *(Task 4 test.)*

---

## File Structure

| File | Responsibility |
|---|---|
| `services/parking-sync/src/utils/rate-parser.ts` (modify) | Parse ParkPlus HTML into an accurate `RatePeriod[]` |
| `services/parking-sync/src/db/local-db.ts` (modify) | `zone_rate_history` table, record-on-change, unsynced queue |
| `services/parking-sync/src/types.ts` (modify) | `RateHistoryEntry` |
| `services/parking-sync/src/remote/{adapter,firestore-adapter,mock-adapter}.ts` (modify) | `pushRateHistory()` |
| `services/parking-sync/src/index.ts` (modify) | Push unsynced history each cycle |
| `webapp/lib/parking/rate-schedule.ts` (create) | Pure resolver: period matching, current rate, 24h profile, peak/min |
| `webapp/lib/parking/rate-parser.ts` (modify) | ArcGIS-fallback HTML parser, same header rules as the sync parser |
| `webapp/lib/parking/price-history.ts` (create) | Pure `buildPriceHistory()` merge and `isValidZoneId()` |
| `webapp/lib/parking/rate-history-sqlite.ts` (create) | SQLite fallback reader for history |
| `webapp/app/api/parking/history/route.ts` (create) | `GET /api/parking/history?zoneId=` |
| `webapp/lib/parking/data-service.ts` (modify) | Apply live rates on load; `fetchZoneRateHistory()` |
| `webapp/components/map/{ZoneDetailSheet,RateCurveChart,ZonePreviewCard}.tsx` (modify) | Inspect UI |
| `webapp/lib/firebase/firestore.ts`, `webapp/lib/parking/example-data.ts` (modify) | Drop invented example snapshots |
| `webapp/firestore.rules` (modify) | Public read on `rate_history` |

---

### Task 1: Fix the sync service's HTML rate parser

**Files:**
- Modify: `services/parking-sync/src/utils/rate-parser.ts`
- Test: `services/parking-sync/test/test_sync_engine.ts` (append a new suite)

**Interfaces:**
- Produces: `parseRateHeader(header: string): { days: string | null; startTime: string | null; endTime: string | null }` (exported), and the existing `parseHtmlRates(html)` with the corrected output below.

Header rules for `parseRateHeader`. Days are case-insensitive and the **first** matching rule wins. Use word boundaries so `Fri` does not match inside `Mon-Fri`:

| Pattern in header | `days` |
|---|---|
| `mon-sat`, `mon to sat` | `Mon-Sat` |
| `mon-thu`, `mon to thu` | `Mon-Thu` |
| `mon-fri`, `mon to fri`, `weekday(s)` | `Mon-Fri` |
| `sat`, `saturday` | `Saturday` |
| `sun`, `sunday`, `holiday` | `Sunday` |
| `fri`, `friday` | `Fri` |
| `daily`, `mon-sun`, `everyday` | `Daily` |
| none of the above | `null` |

Times: accept `9:00 AM to 6:00 PM` (12-hour) **and** `09:00 to 18:00` / `9:00 to 18:00` (24-hour). Output `HH:MM`, or `null` if absent.

`parseHtmlRates` keeps a header/value pair only if one of these holds:
- (a) it has a time range and the value has a `$` price → paid period (`days ?? 'Daily'`);
- (b) it has a time range and the value says free → free period;
- (c) `days === 'Sunday'`, there is no time range and the value says free → `Sunday 00:00–23:59`, free.

All other pairs are dropped: `Free parking to …`, `Loading zone:`, `No Parking…`, `Max 9 Hours`, `Mayor VIP`, `Taxi zone:`. `activeRate` stays the max paid price (it is the stored peak). `isCurrentlyFree = activeRate === 0`. If nothing survives the filter, return `periods: []`, which replaces the invented `Mon-Sat 09:00–18:00` fallback. Empty HTML keeps its current `Daily 00:00–23:59 free` result.

- [ ] **Step 1: Write the failing test** (new suite `--- Test Suite N: ParkPlus HTML rate parsing ---`)

```ts
const PARKPLUS_2_HTML = '<b>Mon-Fri 9:00 AM to 11:00 AM</b><br><br>$3.75 per Hour<br><br><b>Mon-Fri 11:00 AM to 1:30 PM</b><br><br>$4.25 per Hour<br><br><b>Mon-Fri 1:30 PM to 3:30 PM</b><br><br>$3.25 per Hour<br><br><b>Mon-Fri 3:30 PM to 6:00 PM</b><br><br>$2.25 per Hour<br><br><b>Saturday: 9:00 AM to 6:00 PM</b><br><br>$1.00 per Hour<br><br><b>Sunday/Holidays:</b><br><br>Free parking<br><br><b>Free parking to 9 AM</b><br><br>See Signs /Parking Restrictions<br><br>';
const p2 = parseHtmlRates(PARKPLUS_2_HTML);
assert.deepStrictEqual(p2.periods, [
  { days: 'Mon-Fri', startTime: '09:00', endTime: '11:00', ratePerHour: 3.75, isFree: false },
  { days: 'Mon-Fri', startTime: '11:00', endTime: '13:30', ratePerHour: 4.25, isFree: false },
  { days: 'Mon-Fri', startTime: '13:30', endTime: '15:30', ratePerHour: 3.25, isFree: false },
  { days: 'Mon-Fri', startTime: '15:30', endTime: '18:00', ratePerHour: 2.25, isFree: false },
  { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 1, isFree: false },
  { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
]);
assert.strictEqual(p2.activeRate, 4.25);

assert.deepStrictEqual(parseRateHeader('Mon-Sat 9:00 AM to 6:00 PM'), { days: 'Mon-Sat', startTime: '09:00', endTime: '18:00' });
assert.deepStrictEqual(parseRateHeader('Weekdays: 09:00 to 15:00'), { days: 'Mon-Fri', startTime: '09:00', endTime: '15:00' });
assert.deepStrictEqual(parseRateHeader('Sun 9:00 AM to 6:00 PM'), { days: 'Sunday', startTime: '09:00', endTime: '18:00' });
assert.deepStrictEqual(parseRateHeader('Fri 9:00 AM to 6:00 PM'), { days: 'Fri', startTime: '09:00', endTime: '18:00' });
assert.deepStrictEqual(parseRateHeader('Mon-Thu 9:00 AM to 6:00 PM'), { days: 'Mon-Thu', startTime: '09:00', endTime: '18:00' });
assert.deepStrictEqual(parseRateHeader('Saturday: Max 9 Hours'), { days: 'Saturday', startTime: null, endTime: null });

const loadingOnly = parseHtmlRates('<b>Loading zone:</b><br><br>Commercial vehicles 30 min<br><br>');
assert.deepStrictEqual(loadingOnly.periods, []);
assert.strictEqual(loadingOnly.activeRate, 0);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run sync:test`
Expected: FAIL, `parseRateHeader` is not exported, or the `deepStrictEqual` on `p2.periods` fails with 7 periods.

- [ ] **Step 3: Implement `parseRateHeader` and rework `parseHtmlRates` in `src/utils/rate-parser.ts`** following the rules above. Leave `toWgs84` untouched.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run sync:test`
Expected: all suites PASS. Existing fetcher suites that assert MyParking periods may need their expectations corrected to the new rules. Change only expectations that encoded the bugs listed in the Diagnosis.

- [ ] **Step 5: Commit**

```bash
git add services/parking-sync/src/utils/rate-parser.ts services/parking-sync/test/test_sync_engine.ts
git commit -m "fix(sync): parse ParkPlus rate headers for all day/time formats"
```

---

### Task 2: Webapp schedule resolver

**Files:**
- Create: `webapp/lib/parking/rate-schedule.ts`
- Create: `webapp/test/test_rate_schedule.js`
- Modify: `webapp/package.json` (append `&& node test/test_rate_schedule.js` to `test`)

**Interfaces:**
- Consumes: `RatePeriod`, `HourlyRatePoint` (types, `import type` from `./types`); `CalgaryTime` (type from `./calgary-clock`).
- Produces:
  - `periodAppliesAt(period: RatePeriod, t: CalgaryTime): boolean`
  - `resolveRateAt(schedule: RatePeriod[] | undefined, t: CalgaryTime): { rate: number; isFree: boolean; period: RatePeriod | null; statusText: string }`
  - `buildDayProfile(schedule: RatePeriod[] | undefined, day: number): HourlyRatePoint[]` (24 points, each sampled at `hour:30`; `isEnforced = rate > 0`; `label` as in today's `generate24HourProfile`)
  - `summarizeSchedule(schedule: RatePeriod[] | undefined): { peakRate: number; minPaidRate: number }` (`0`/`0` when no paid period)

Day labels (`period.days`) map to weekday sets (0 = Sun): `Mon-Fri` {1–5}, `Mon-Sat` {1–6}, `Mon-Thu` {1–4}, `Fri` {5}, `Saturday` {6}, `Sunday` {0}, `Weekend` {0,6}. `Daily`, `Evening`, `Night` and any unknown label mean every day. `Evening & Weekend` means the time window on every day **plus** all day Sat/Sun.

Time window: `endTime` `23:59` is treated as end-of-day (1440). If `end <= start` the window wraps past midnight: it matches `minutes >= start || minutes < end`, using the same day set.

Resolution: among the periods that apply, the first **paid** one (`!isFree && ratePerHour > 0`) wins. If only free ones apply, the result is free. If none apply, the result is free with `statusText` `'Free (outside paid hours)'`. Paid `statusText` is `` `$${rate.toFixed(2)}/hr` ``. A matched free period gives `'Free parking'`.

- [ ] **Step 1: Write the failing test** `webapp/test/test_rate_schedule.js` (strip-types re-exec header copied from `test_calgary_clock.js`; import `rate-schedule.ts` and `calgary-clock.ts`)

```js
const PP2 = [ // stored parkplus_2 row as it exists today, bogus free period included
  { days: 'Mon-Fri', startTime: '09:00', endTime: '11:00', ratePerHour: 3.75, isFree: false },
  { days: 'Mon-Fri', startTime: '11:00', endTime: '13:30', ratePerHour: 4.25, isFree: false },
  { days: 'Mon-Fri', startTime: '13:30', endTime: '15:30', ratePerHour: 3.25, isFree: false },
  { days: 'Mon-Fri', startTime: '15:30', endTime: '18:00', ratePerHour: 2.25, isFree: false },
  { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 1, isFree: false },
  { days: 'Sunday', startTime: '09:00', endTime: '18:00', ratePerHour: 0, isFree: true },
  { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 0, isFree: true },
];
const PARKADE = [
  { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 4 },
  { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.5 },
  { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.5 },
];
const at = (day, hour, minute = 0) => ({ day, hour, minute });

assert.strictEqual(rs.resolveRateAt(PP2, at(3, 12)).rate, 4.25);            // paid beats overlapping free
assert.strictEqual(rs.resolveRateAt(PP2, at(3, 8, 59)).isFree, true);
assert.strictEqual(rs.resolveRateAt(PP2, at(6, 10)).rate, 1);
assert.strictEqual(rs.resolveRateAt(PP2, at(0, 12)).isFree, true);
assert.strictEqual(rs.resolveRateAt(PP2, at(3, 18)).isFree, true);          // end is exclusive
assert.strictEqual(rs.resolveRateAt(PARKADE, at(2, 2)).rate, 1.5);          // overnight wrap
assert.strictEqual(rs.resolveRateAt(PARKADE, at(6, 23, 59)).rate, 1.5);     // 23:59 = end of day
assert.strictEqual(rs.resolveRateAt(PARKADE, at(2, 10)).rate, 4);
assert.strictEqual(rs.resolveRateAt([], at(2, 10)).isFree, true);
assert.strictEqual(rs.resolveRateAt(undefined, at(2, 10)).statusText, 'Free (outside paid hours)');
const eveWk = [{ days: 'Evening & Weekend', startTime: '18:00', endTime: '06:00', ratePerHour: 3 }];
assert.strictEqual(rs.resolveRateAt(eveWk, at(6, 12)).rate, 3);
assert.strictEqual(rs.resolveRateAt(eveWk, at(3, 12)).isFree, true);
// Calgary time, not browser time: 17:00Z on Wed 2026-11-25 = 10:00 MST
assert.strictEqual(rs.resolveRateAt(PP2, clock.getCalgaryTime(new Date('2026-11-25T17:00:00Z'))).rate, 3.75);

const wed = rs.buildDayProfile(PP2, 3);
assert.strictEqual(wed.length, 24);
assert.deepStrictEqual(wed.slice(8, 19).map((p) => p.rate), [0, 3.75, 3.75, 4.25, 4.25, 3.25, 3.25, 2.25, 2.25, 2.25, 0]);
assert.ok(rs.buildDayProfile(PP2, 0).every((p) => p.rate === 0));
assert.deepStrictEqual(rs.summarizeSchedule(PP2), { peakRate: 4.25, minPaidRate: 1 });
assert.deepStrictEqual(rs.summarizeSchedule([]), { peakRate: 0, minPaidRate: 0 });
```

- [ ] **Step 2: Run to verify it fails**

Run: `node webapp/test/test_rate_schedule.js`
Expected: FAIL, `Cannot find module …/rate-schedule.ts`.

- [ ] **Step 3: Implement the four functions in `webapp/lib/parking/rate-schedule.ts`** per the rules above.

- [ ] **Step 4: Run to verify it passes**

Run: `node webapp/test/test_rate_schedule.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/lib/parking/rate-schedule.ts webapp/test/test_rate_schedule.js webapp/package.json
git commit -m "feat(rates): add Calgary-time rate schedule resolver"
```

---

### Task 3: Use the resolver everywhere rates are shown

**Files:**
- Modify: `webapp/lib/parking/rate-parser.ts`, `webapp/lib/parking/data-service.ts`
- Modify: `webapp/components/map/ZoneDetailSheet.tsx` (Overview + Rates tabs only), `webapp/components/map/RateCurveChart.tsx`, `webapp/components/map/ZonePreviewCard.tsx`
- Test: `webapp/test/test_rate_schedule.js` (append)

**Interfaces:**
- Consumes: Task 2's `resolveRateAt`, `buildDayProfile`, `summarizeSchedule`; `getCalgaryTime()`.
- Produces:
  - `parseRateSchedule(html): { minRate: number; maxRate: number; periods: RatePeriod[] }` in `rate-parser.ts`. `intervals`, `ParsedInterval`, `getCurrentRate` and `generate24HourProfile` are deleted. Change the local import to `import type`.
  - `withLiveRates(zones: ParkingZone[], t: CalgaryTime): ParkingZone[]` exported from `data-service.ts`. For each zone with a non-empty `rateSchedule`, it returns a copy with `activeRate`/`isCurrentlyFree` set from `resolveRateAt`. Zones with no schedule pass through unchanged.
  - `RateCurveChart` props become `{ schedule: RatePeriod[]; initialDay: number }`.

Changes:
- `rate-parser.ts::parseRateSchedule` uses the same header and keep/drop rules as Task 1. Port `parseRateHeader` into this file; it is the webapp copy, as CLAUDE.md's per-platform rule requires.
- `data-service.ts`: the ArcGIS branch drops `getCurrentRate` and the invented `Mon-Sat 09:00–18:00` fallback schedule. Every return path of `fetchCalgaryParkingZones`, cached ones included, returns `withLiveRates(zones, getCalgaryTime())`. Cache the raw zones, not the live-rated ones.
- `ZoneDetailSheet.tsx`:
  - Hold `const [now, setNow] = useState(() => getCalgaryTime())`, refreshed every 60 s with `setInterval` and cleared on unmount.
  - Compute `const live = resolveRateAt(zone.rateSchedule, now)` and `const { peakRate } = summarizeSchedule(zone.rateSchedule)`.
  - The Overview badge shows `live.isFree ? 'FREE NOW' : live.statusText`. The line below it reads `` `Peak $${peakRate.toFixed(2)}/hr` ``, or `'No paid periods posted'` when `peakRate === 0`.
  - Enforceable Schedule shows `zone.enforceableHours` only when present (no invented default). Max stay shows `` `${zone.maxStayHours} Hours` `` or `Not posted`.
  - The Rates tab renders `<RateCurveChart schedule={zone.rateSchedule} initialDay={now.day} />`. Schedule Breakdown lists every `zone.rateSchedule` row as `` `${days} ${startTime}–${endTime}` `` → `FREE` or `$x.xx/hr`, and highlights the row `=== live.period`. An empty schedule shows `No published rate schedule for this zone.` Delete the invented fallback rows.
  - The ParkPlus "free on Sundays" tip renders only when `zone.provider === 'parkplus_on_street'`.
- `RateCurveChart.tsx`: seven day pills (`S M T W T F S`, value 0–6), defaulting to `initialDay`. Profile comes from `buildDayProfile`. Y max is `Math.max(1, …rates)`. Footer: `Free all day` when every point is 0, otherwise `Peak $x.xx/hr`.
- `ZonePreviewCard.tsx`: the badge uses `resolveRateAt(zone.rateSchedule, getCalgaryTime())`, same text rule as the sheet.

- [ ] **Step 1: Write the failing tests** (append to `test_rate_schedule.js`; also import `rate-parser.ts` and read source text with `fs`)

```js
const parsed = parser.parseRateSchedule(PARKPLUS_2_HTML); // same fixture string as Task 1, copied into this file
assert.strictEqual(parsed.periods.length, 6);
assert.strictEqual(parsed.maxRate, 4.25);
assert.strictEqual(parser.getCurrentRate, undefined);

const src = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const sheet = src('components/map/ZoneDetailSheet.tsx');
assert.ok(!/parseRateSchedule\(zone\.enforceableHours\)/.test(sheet), 'Rates tab must not parse enforceableHours as rate HTML');
assert.ok(!/activeRate - 1\.0/.test(sheet), 'Invented Saturday fallback removed');
assert.ok(/resolveRateAt\(zone\.rateSchedule/.test(sheet));
assert.ok(/<RateCurveChart[^>]*schedule=\{zone\.rateSchedule\}/.test(sheet));
assert.ok(/resolveRateAt\(/.test(src('components/map/ZonePreviewCard.tsx')));
assert.ok(/withLiveRates\(/.test(src('lib/parking/data-service.ts')));
```

Behaviour of `withLiveRates` is covered by the resolver tests. Do not import `data-service.ts` in tests, because it pulls in non-type imports.

- [ ] **Step 2: Run to verify it fails**

Run: `node webapp/test/test_rate_schedule.js`
Expected: FAIL on `parsed.periods.length` (7) or on the sheet source assertions.

- [ ] **Step 3: Implement the changes listed above.**

- [ ] **Step 4: Verify**

Run: `cd webapp && npx tsc --noEmit && npm run lint && npm test`
Expected: no type errors and all suites PASS.

Then use the preview tool. Start `npm run webapp:dev`, open `/app`, open zone `#2` (`parkplus_2`), and check:
- the Overview badge matches the current Calgary-time period;
- the Rates tab shows six rows with the 09:00–11:00 $3.75 row highlighted during that window;
- the chart's Wed pill shows the stepped 3.75/4.25/3.25/2.25 shape and Sun is flat.

Take a screenshot.

- [ ] **Step 5: Commit**

```bash
git add webapp/lib/parking webapp/components/map webapp/test/test_rate_schedule.js
git commit -m "fix(rates): show live Calgary-time rates and real schedule when inspecting a zone"
```

---

### Task 4: Record rate history in the sync service and push it to Firestore

**Files:**
- Modify: `services/parking-sync/src/types.ts`, `src/db/local-db.ts`, `src/remote/adapter.ts`, `src/remote/firestore-adapter.ts`, `src/remote/mock-adapter.ts`, `src/index.ts`
- Modify: `webapp/firestore.rules`
- Test: `services/parking-sync/test/test_sync_engine.ts` (append a suite)

**Interfaces:**
- Produces (sync `types.ts`, and mirrored in `webapp/lib/parking/types.ts` for Task 5):
  ```ts
  export interface RateHistoryEntry {
    zoneId: string;
    recordedAt: number;      // epoch ms = record.fetchedAt when the change was seen
    peakRate: number;        // max paid ratePerHour, 0 if none
    minPaidRate: number;     // min paid ratePerHour, 0 if none
    scheduleHash: string;    // computeCanonicalHash({ rateSchedule })
    rateSchedule: RatePeriod[];
  }
  ```
- `LocalParkingDatabase`:
  - `upsertLocalRecords` return type gains `rateHistoryRecorded: number`;
  - `getRateHistory(zoneId: string, limit = 50): RateHistoryEntry[]` (newest first);
  - `getUnsyncedRateHistory(): Array<RateHistoryEntry & { rowId: number }>`;
  - `markRateHistorySynced(rowIds: number[], timestamp?: number): void`.
- `RemoteDatabaseAdapter.pushRateHistory(entries: RateHistoryEntry[]): Promise<number>`.
- Firestore path: `parking_data/{zoneId}/rate_history/{recordedAt}`, with doc fields equal to `RateHistoryEntry`.

Table, created in `initializeSchema` with `IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS zone_rate_history (
  row_id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id TEXT NOT NULL,
  recorded_at INTEGER NOT NULL,
  peak_rate REAL NOT NULL,
  min_paid_rate REAL NOT NULL,
  schedule_hash TEXT NOT NULL,
  rate_schedule_json TEXT NOT NULL,
  synced_to_remote_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_zrh_zone_time ON zone_rate_history(zone_id, recorded_at DESC);
```

Recording rule, inside the existing upsert transaction and run for **every** record whichever branch (insert, update or touch) it takes: compute `scheduleHash`. If the zone's newest history row is missing or has a different `schedule_hash`, insert a row. The "missing" case seeds a baseline for existing DBs on the first run. Peak and min use only periods with `!isFree && ratePerHour > 0`.

Coordinator (`index.ts::runSyncCycle`): after `pushDiffs`, call `remoteAdapter.pushRateHistory(unsynced)`, then `markRateHistorySynced`. Leave rows unsynced if the push throws. Log and continue. The Firestore adapter batches in chunks of 400 like `pushRecords`, and in simulated mode it logs and returns `entries.length`. The mock stores entries in a `Map<string, RateHistoryEntry[]>` and exposes `getRateHistoryDirect(zoneId)`.

Rules: add the following block, and add section `8. Subcollection: parking_data/{documentId}/rate_history/{entryId}` to the header data model listing the six fields:

```
match /parking_data/{documentId}/rate_history/{entryId} {
  allow read: if true;
  allow write: if false;
}
```

- [ ] **Step 1: Write the failing test** (use `new LocalParkingDatabase({ dbPath: ':memory:' })` and a `MockRemoteAdapter`)

```ts
const histDb = new LocalParkingDatabase({ dbPath: ':memory:' });
const mk = (fetchedAt: number, rate: number, geomShift = 0) => {
  const r = { ...baseRecord, category: 'MUNICIPAL', externalId: '1001', stallType: 'Parallel', isCurrentlyFree: false, restrictions: [], fetchedAt,
    coordinates: [-114.07 + geomShift, 51.05],
    rateSchedule: [{ days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: rate, isFree: false }] } as NormalizedParkingRecord;
  return { ...r, contentHash: computeCanonicalHash(r) };
};
assert.strictEqual(histDb.upsertLocalRecords([mk(1000, 3.5)]).rateHistoryRecorded, 1);        // baseline
assert.strictEqual(histDb.upsertLocalRecords([mk(2000, 3.5)]).rateHistoryRecorded, 0);        // unchanged
assert.strictEqual(histDb.upsertLocalRecords([mk(3000, 3.5, 0.001)]).rateHistoryRecorded, 0); // geometry-only change
assert.strictEqual(histDb.upsertLocalRecords([mk(4000, 4.0)]).rateHistoryRecorded, 1);        // price change
const hist = histDb.getRateHistory('test_1001');
assert.deepStrictEqual(hist.map((h) => [h.recordedAt, h.peakRate, h.minPaidRate]), [[4000, 4, 4], [1000, 3.5, 3.5]]);

const histRemote = new MockRemoteAdapter();
const unsynced = histDb.getUnsyncedRateHistory();
assert.strictEqual(unsynced.length, 2);
assert.strictEqual(await histRemote.pushRateHistory(unsynced), 2);
histDb.markRateHistorySynced(unsynced.map((u) => u.rowId));
assert.strictEqual(histDb.getUnsyncedRateHistory().length, 0);
assert.strictEqual(histRemote.getRateHistoryDirect('test_1001').length, 2);
```

Also, in `webapp/test/test_example_data_and_onboarding.js` next to the existing rules checks:

```js
assert.ok(/match \/parking_data\/\{documentId\}\/rate_history\/\{entryId\}[\s\S]*?allow read: if true;[\s\S]*?allow write: if false;/.test(rulesText));
```

Use the variable the file already holds the rules source in.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run sync:test`
Expected: FAIL, `rateHistoryRecorded` is `undefined`.

- [ ] **Step 3: Implement the table, the methods, the adapter method on all three adapters, the coordinator call and the rules change.**

- [ ] **Step 4: Run to verify it passes**

Run: `npm run sync:test && npm run webapp:test`
Expected: PASS. Then run `npm run sync:run` once against the real local DB and check that `SELECT count(*) FROM zone_rate_history` in `services/parking-sync/data/local_parking.db` equals the zone count (baseline rows).

- [ ] **Step 5: Commit**

```bash
git add services/parking-sync webapp/firestore.rules webapp/test/test_example_data_and_onboarding.js
git commit -m "feat(sync): record zone rate history on schedule change and push to Firestore"
```

---

### Task 5: History API route

**Files:**
- Create: `webapp/lib/parking/price-history.ts` (only `isValidZoneId` in this task; Task 6 adds the merge)
- Create: `webapp/lib/parking/rate-history-sqlite.ts`
- Create: `webapp/app/api/parking/history/route.ts`
- Modify: `webapp/lib/parking/types.ts` (add `RateHistoryEntry`, identical to Task 4)
- Modify: `webapp/lib/parking/data-service.ts` (add the client fetcher)
- Test: create `webapp/test/test_price_history.js` (strip-types header) and add it to the `test` script

**Interfaces:**
- `isValidZoneId(id: unknown): id is string` checks `/^[A-Za-z0-9_-]{1,100}$/`.
- `readRateHistoryFromSqlite(dbPath: string, zoneId: string, limit = 50): RateHistoryEntry[]` loads `node:sqlite` with `process.getBuiltinModule('node:sqlite')`. Do not use `eval('require')`: `require` is undefined when the test imports this file as ESM, and `getBuiltinModule` also stays invisible to the bundler. It returns `[]` when the file is missing, the table is missing, or anything throws. Rows come back newest first.
- `GET /api/parking/history?zoneId=…`:
  - responds `400 { error: 'invalid zoneId' }` if the id is invalid;
  - otherwise tries Firestore `collection(db, 'parking_data', zoneId, 'rate_history')` with `orderBy('recordedAt','desc')` and `limit(50)`, gated on `db && db.type` as in the existing route;
  - falls back to `readRateHistoryFromSqlite(path.resolve(process.cwd(), '../services/parking-sync/data/local_parking.db'), zoneId)`;
  - responds `200 { zoneId, source: 'remote_database' | 'local_database_staging' | 'empty', entries }`;
  - sends header `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`.
- `fetchZoneRateHistory(zoneId: string): Promise<RateHistoryEntry[]>` in `data-service.ts` calls the route with `encodeURIComponent`. It returns `[]` on a non-OK response or a network error.

- [ ] **Step 1: Write the failing test**

```js
assert.strictEqual(ph.isValidZoneId('parkplus_2'), true);
assert.strictEqual(ph.isValidZoneId('../etc'), false);
assert.strictEqual(ph.isValidZoneId(''), false);
assert.strictEqual(ph.isValidZoneId(undefined), false);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-'));
const legacy = path.join(tmp, 'legacy.db');                       // DB without the history table
new (require('node:sqlite').DatabaseSync)(legacy).exec('CREATE TABLE local_parking_zones (id TEXT)');
assert.deepStrictEqual(sq.readRateHistoryFromSqlite(legacy, 'parkplus_2'), []);
assert.deepStrictEqual(sq.readRateHistoryFromSqlite(path.join(tmp, 'missing.db'), 'parkplus_2'), []);

const withTable = path.join(tmp, 'h.db');
const d = new (require('node:sqlite').DatabaseSync)(withTable);
d.exec(`CREATE TABLE zone_rate_history (row_id INTEGER PRIMARY KEY, zone_id TEXT, recorded_at INTEGER, peak_rate REAL, min_paid_rate REAL, schedule_hash TEXT, rate_schedule_json TEXT, synced_to_remote_at INTEGER)`);
d.exec(`INSERT INTO zone_rate_history VALUES (1,'parkplus_2',1000,3.5,1,'a','[]',NULL),(2,'parkplus_2',2000,4.25,1,'b','[]',NULL),(3,'other',3000,9,9,'c','[]',NULL)`);
d.close();
assert.deepStrictEqual(sq.readRateHistoryFromSqlite(withTable, 'parkplus_2').map((e) => [e.recordedAt, e.peakRate]), [[2000, 4.25], [1000, 3.5]]);

const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'app/api/parking/history/route.ts'), 'utf8');
assert.ok(/isValidZoneId\(/.test(routeSrc) && /status:\s*400/.test(routeSrc));
assert.ok(/'rate_history'/.test(routeSrc) && /readRateHistoryFromSqlite\(/.test(routeSrc));
```

- [ ] **Step 2: Run to verify it fails**

Run: `node webapp/test/test_price_history.js`
Expected: FAIL, `Cannot find module …/price-history.ts`.

- [ ] **Step 3: Implement** the two lib files, the route (after reading the Next route-handler docs), the type, and `fetchZoneRateHistory`.

- [ ] **Step 4: Verify**

Run: `node webapp/test/test_price_history.js && cd webapp && npx tsc --noEmit`
Expected: PASS and no type errors. With the dev server running, `GET /api/parking/history?zoneId=parkplus_2` returns `source: 'local_database_staging'` with at least one entry after Task 4's `sync:run`, and `?zoneId=..%2Fx` returns 400.

- [ ] **Step 5: Commit**

```bash
git add webapp/lib/parking webapp/app/api/parking/history webapp/test/test_price_history.js webapp/package.json
git commit -m "feat(api): serve stored zone rate history with Firestore and SQLite fallback"
```

---

### Task 6: History tab merges stored history, the live API rate and user snapshots

**Files:**
- Modify: `webapp/lib/parking/price-history.ts` (add the merge)
- Modify: `webapp/components/map/ZoneDetailSheet.tsx` (History tab)
- Modify: `webapp/lib/firebase/firestore.ts`, `webapp/lib/parking/example-data.ts`, `webapp/test/test_example_data_and_onboarding.js`
- Test: `webapp/test/test_price_history.js` (append)

**Interfaces:**
- Consumes: `RateHistoryEntry`, `fetchZoneRateHistory` (Task 5); `resolveRateAt`, `summarizeSchedule` (Task 2); `RateSnapshot`.
- Produces:
  ```ts
  export interface PriceHistoryRow {
    id: string;
    source: 'live' | 'stored' | 'snapshot';
    label: string;
    at: number | null;
    rate: number;              // live: current rate; stored: peakRate; snapshot: snapshot.rate
    isFree: boolean;           // live only can be true
    peakRate: number | null;   // live + stored
    change: number | null;     // see rules
  }
  export function buildPriceHistory(input: {
    stored: RateHistoryEntry[];
    live: { rate: number; isFree: boolean; peakRate: number; observedAt: number };
    snapshots: RateSnapshot[];
  }): PriceHistoryRow[];
  ```
- `getZoneRateSnapshots(userId, zoneId)` drops its `activeRate` parameter and returns stored user snapshots only. `createExampleRateSnapshots` is deleted.

Merge rules:
1. The first row is always `live`: `id: 'live'`, `label: 'Now (live)'`, `at: observedAt`. `change` is `live.peakRate - newestStored.peakRate` rounded to 2 dp, or `null` if there is no stored entry or the difference is 0.
2. Then come `stored` rows (`id: \`stored_${recordedAt}\``) and `snapshot` rows (`id: snap.id`), merged and sorted by `at` descending. Stored `label` is `` `Peak since ${new Date(recordedAt).toLocaleDateString('en-CA', { timeZone: 'America/Edmonton', year: 'numeric', month: 'short', day: 'numeric' })}` ``. Stored `change` is `peakRate - nextOlderStored.peakRate` (2 dp), or `null` for the oldest or a 0 diff. Snapshot `label` is `snap.period`, with `change: null`.
3. Snapshots without `createdAt` go last, in their input order.
4. Input arrays are not mutated.

UI:
- On mount, and when `zone.id` changes, call `fetchZoneRateHistory(zone.id)` and store the entries in state.
- Build rows with `buildPriceHistory({ stored, live: { ...resolveRateAt(zone.rateSchedule, now), peakRate, observedAt: Date.now() }, snapshots: savedSnapshots })`, reusing Task 3's `now`/`peakRate`.
- Render the live row with a `Live` badge, stored rows with a `Synced` badge, and snapshot rows with the existing edit/delete controls. Show `change` as `▲ $0.50` or `▼ $0.25` when it is non-null.
- Show a muted `Loading stored history…` line while the fetch is pending.
- Remove the "Clear Examples" button and its handler, and the `isExample` branches in the snapshot editor.
- `Take Snapshot` stores the **current** resolved rate (`live.rate`), not `zone.activeRate`.
- Replace the hard-coded "Occupancy Trends" card text (`11:30 AM - 1:30 PM`), which is invented data, by deleting the card.

- [ ] **Step 1: Write the failing tests** (append to `test_price_history.js`)

```js
const D = Date.UTC(2026, 10, 1);
const stored = [
  { zoneId: 'z', recordedAt: D + 2e9, peakRate: 4.25, minPaidRate: 1, scheduleHash: 'b', rateSchedule: [] },
  { zoneId: 'z', recordedAt: D,       peakRate: 3.75, minPaidRate: 1, scheduleHash: 'a', rateSchedule: [] },
];
const snaps = [{ id: 'snap_1', period: 'Nov 10', rate: 2.25, createdAt: D + 1e9 }, { id: 'snap_old', period: 'legacy', rate: 1 }];
const frozen = JSON.stringify([stored, snaps]);
const rows = ph.buildPriceHistory({ stored, live: { rate: 0, isFree: true, peakRate: 4.75, observedAt: D + 3e9 }, snapshots: snaps });
assert.deepStrictEqual(rows.map((r) => r.id), ['live', `stored_${D + 2e9}`, 'snap_1', `stored_${D}`, 'snap_old']);
assert.strictEqual(rows[0].isFree, true);
assert.strictEqual(rows[0].change, 0.5);               // live peak 4.75 vs newest stored 4.25
assert.strictEqual(rows[1].change, 0.5);               // 4.25 vs 3.75
assert.strictEqual(rows[3].change, null);              // oldest stored
assert.strictEqual(rows[1].label, 'Peak since Nov 23, 2026');
assert.strictEqual(JSON.stringify([stored, snaps]), frozen);

const onlyLive = ph.buildPriceHistory({ stored: [], live: { rate: 3.75, isFree: false, peakRate: 4.25, observedAt: D }, snapshots: [] });
assert.strictEqual(onlyLive.length, 1);
assert.strictEqual(onlyLive[0].change, null);

const sheet = fs.readFileSync(path.join(__dirname, '..', 'components/map/ZoneDetailSheet.tsx'), 'utf8');
assert.ok(/fetchZoneRateHistory\(zone\.id\)/.test(sheet) && /buildPriceHistory\(/.test(sheet));
assert.ok(!/Clear Examples/.test(sheet) && !/11:30 AM - 1:30 PM/.test(sheet));
```

`D + 2e9` ms is Nov 24 03:33 UTC, which is the evening of Nov 23 in Edmonton. This checks that the label uses Calgary time, not UTC. The string was checked against Node 22.14's ICU.

In `test_example_data_and_onboarding.js`, replace the four `createExampleRateSnapshots` assertions (lines 53–57) with `assert.strictEqual(ex.createExampleRateSnapshots, undefined);`. Keep the `getZoneRateSnapshots`/`saveZoneRateSnapshots` usage check at line 219.

- [ ] **Step 2: Run to verify it fails**

Run: `node webapp/test/test_price_history.js`
Expected: FAIL, `ph.buildPriceHistory is not a function`.

- [ ] **Step 3: Implement** `buildPriceHistory`, the snapshot-helper changes, and the History tab UI.

- [ ] **Step 4: Verify**

Run: `cd webapp && npx tsc --noEmit && npm run lint && npm test`
Expected: all PASS.

Then use the preview. Open zone `#2` → History, and check:
- a `Now (live)` row appears first, followed by at least one `Synced` row from SQLite;
- `Take Snapshot` adds a snapshot row in time order;
- no `Example` rows appear.

Take a screenshot.

- [ ] **Step 5: Commit**

```bash
git add webapp/lib webapp/components/map/ZoneDetailSheet.tsx webapp/test
git commit -m "feat(history): merge stored rate history with live API rate and user snapshots"
```
