/**
 * Tests for lib/parking/rate-schedule.ts (Calgary-time rate schedule resolver).
 * Re-runs itself with --experimental-strip-types so it can import the TS module directly.
 */
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

if (!process.execArgv.includes('--experimental-strip-types') && !process.features.typescript) {
  const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', __filename], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

(async () => {
  const url = require('url');
  const rs = await import(url.pathToFileURL(path.join(__dirname, '..', 'lib', 'parking', 'rate-schedule.ts')).href);
  const clock = await import(url.pathToFileURL(path.join(__dirname, '..', 'lib', 'parking', 'calgary-clock.ts')).href);

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
  assert.strictEqual(rs.resolveRateAt(PP2, at(3, 12)).statusText, '$4.25/hr');

  const wed = rs.buildDayProfile(PP2, 3);
  assert.strictEqual(wed.length, 24);
  assert.deepStrictEqual(wed.slice(8, 19).map((p) => p.rate), [0, 3.75, 3.75, 4.25, 4.25, 3.25, 3.25, 2.25, 2.25, 2.25, 0]);
  assert.strictEqual(wed[0].label, '12 AM');
  assert.strictEqual(wed[13].label, '1 PM');
  assert.strictEqual(wed[9].isEnforced, true);
  assert.ok(rs.buildDayProfile(PP2, 0).every((p) => p.rate === 0));
  assert.deepStrictEqual(rs.summarizeSchedule(PP2), { peakRate: 4.25, minPaidRate: 1 });
  assert.deepStrictEqual(rs.summarizeSchedule([]), { peakRate: 0, minPaidRate: 0 });

  console.log('✓ rate-schedule: all assertions passed');
})().catch((err) => { console.error(err); process.exit(1); });
