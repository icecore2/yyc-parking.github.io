/**
 * Tests for lib/parking/calgary-clock.ts (landing page live statement).
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
  const clock = await import(require('url').pathToFileURL(path.join(__dirname, '..', 'lib', 'parking', 'calgary-clock.ts')).href);
  const { getCalgaryTime, formatClock, skyPhase, downtownVerdict } = clock;

  // Time zone conversion: 2026-11-25T04:37Z is Tue 9:37 PM in Calgary (MST, UTC-7).
  const t = getCalgaryTime(new Date('2026-11-25T04:37:00Z'));
  assert.deepStrictEqual(t, { day: 2, hour: 21, minute: 37 });
  // Summer (MDT, UTC-6): 2026-07-01T18:05Z is Wed 12:05 PM.
  assert.deepStrictEqual(getCalgaryTime(new Date('2026-07-01T18:05:00Z')), { day: 3, hour: 12, minute: 5 });

  assert.strictEqual(formatClock({ day: 2, hour: 21, minute: 37 }), '9:37 PM');
  assert.strictEqual(formatClock({ day: 2, hour: 0, minute: 5 }), '12:05 AM');
  assert.strictEqual(formatClock({ day: 2, hour: 12, minute: 0 }), '12:00 PM');

  assert.strictEqual(skyPhase({ day: 2, hour: 6, minute: 0 }), 'dawn');
  assert.strictEqual(skyPhase({ day: 2, hour: 13, minute: 0 }), 'day');
  assert.strictEqual(skyPhase({ day: 2, hour: 18, minute: 30 }), 'dusk');
  assert.strictEqual(skyPhase({ day: 2, hour: 23, minute: 0 }), 'night');

  const v = (day, hour, minute = 0) => downtownVerdict({ day, hour, minute });
  // Weekday evening → free until tomorrow morning
  assert.match(v(2, 21, 37), /free until tomorrow at 9 AM/);
  // Friday evening → Saturday is paid, so tomorrow
  assert.match(v(5, 20), /free until tomorrow at 9 AM/);
  // Saturday evening and all of Sunday → Monday
  assert.match(v(6, 19), /free until Monday at 9 AM/);
  assert.match(v(0, 13), /free until Monday at 9 AM/);
  // Weekday early morning → free until 9, warns about 7 AM tow zones
  assert.match(v(3, 5), /free until 9 AM/);
  assert.match(v(3, 5), /7 AM/);
  // Rush hours → tow zone message with end time
  assert.match(v(3, 8, 15), /tow zones .* until 9 AM/);
  assert.match(v(3, 16), /tow zones .* until 6 PM/);
  // Rush hour does not apply on Saturday
  assert.doesNotMatch(v(6, 16), /tow zone/);
  // Paid daytime
  assert.match(v(3, 12), /paid until 6 PM/);
  assert.match(v(6, 12), /Saturday/);

  console.log('✓ calgary-clock: all assertions passed');
})().catch((err) => { console.error(err); process.exit(1); });
