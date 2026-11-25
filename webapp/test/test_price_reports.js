/**
 * Per-user posted prices + official rate history.
 *
 * Contract: a user's posted price is written only under users/{uid}/price_reports and is
 * never merged into the official parking_data / parking_rate_history data. The History tab
 * graphs both series side by side.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const WEBAPP_ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(WEBAPP_ROOT, relPath), 'utf8');
}

function loadTsModule(relPath) {
  const source = read(relPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', transpiled.outputText)(mod.exports, require, mod);
  return mod.exports;
}

console.log('🧪 Running Price Reports & Rate History Test Suite...');

// 1. Example price reports are tagged and derived from the zone's rate
const ex = loadTsModule('lib/parking/example-data.ts');
const now = 1_800_000_000_000;
const examples = ex.createExamplePriceReports('parkplus_1008', 4.0, now);
assert.strictEqual(examples.length, 2);
assert.ok(examples.every((r) => r.isExample === true && r.zoneId === 'parkplus_1008'));
assert.ok(examples.every((r) => r.id.startsWith('example_')), 'example ids keep the example_ prefix');
assert.deepStrictEqual(examples.map((r) => r.rate), [3.5, 4.0]);
assert.ok(examples[0].observedAt < examples[1].observedAt && examples[1].observedAt < now);
console.log('  ✓ Example price reports are tagged and dated in the past');

// 2. Data layer: user posts only touch users/{uid}/price_reports
const firestoreTs = read('lib/firebase/firestore.ts');
const reportSection = firestoreTs.slice(firestoreTs.indexOf('// Per-user posted prices'));
assert.ok(reportSection.length > 0, 'firestore.ts must have a price reports section');
for (const fn of ['getUserPriceReports', 'saveUserPriceReport', 'deleteUserPriceReport', 'createPriceReport']) {
  assert.ok(new RegExp(`export (async )?function ${fn}\\b`).test(reportSection), `${fn} must be exported`);
}
assert.ok(/'price_reports'/.test(reportSection));
const pathCalls = reportSection.match(/(?:doc|collection)\(\s*db\s*,[^)]*\)/g) || [];
assert.ok(pathCalls.length >= 3, 'expected Firestore path calls in the price report section');
for (const call of pathCalls) {
  assert.ok(
    /'users',\s*userId,\s*PRICE_REPORTS_SUBCOLLECTION/.test(call),
    `price report Firestore access must stay under users/{uid}/price_reports: ${call}`
  );
}
assert.ok(!/parking_data|parking_rate_history/.test(reportSection.replace(/\/\/.*$/gm, '')),
  'price report code must never reference the official collections');
assert.ok(/sanitizeFirestorePayload\(payload\)/.test(reportSection), 'reports must strip isExample/undefined');
assert.ok(/notifyUserDataChanged\(\)/.test(reportSection));
assert.ok(/LOCAL_SNAPSHOTS_PREFIX/.test(reportSection), 'legacy snapshots must be migrated');
console.log('  ✓ Price reports are private to users/{uid}/price_reports');

// 3. Rules: owner-only reports, read-only official history
const rules = read('firestore.rules');
const reportsBlock = rules.slice(rules.indexOf('match /price_reports/{reportId}'));
assert.ok(/allow read: if isOwner\(uid\);/.test(reportsBlock.slice(0, 600)));
assert.ok(/isValidPriceReport\(request\.resource\.data, reportId\)/.test(reportsBlock));
assert.ok(/data\.rate <= 1000/.test(rules) && /data\.note\.size\(\) <= 200/.test(rules));
assert.ok(
  /match \/parking_rate_history\/\{zoneId\} \{\s*allow read: if true;\s*allow write: if false;/.test(rules),
  'parking_rate_history must be public read, no client writes'
);
assert.ok(/9\. Collection: users\/\{uid\}\/price_reports/.test(rules), 'data model header documents price_reports');
assert.ok(/8\. Collection: parking_rate_history/.test(rules), 'data model header documents parking_rate_history');
console.log('  ✓ Firestore rules: owner-only reports, read-only official history');

// 4. History API route validates input and never reads user data
const historyRoute = read('app/api/parking/history/route.ts');
assert.ok(/ZONE_ID_PATTERN\s*=\s*\/\^\[\\w-\]\{1,100\}\$\//.test(historyRoute), 'zoneId must be validated');
assert.ok(/status: 400/.test(historyRoute));
assert.ok(/'parking_rate_history'/.test(historyRoute) && /FROM rate_history/.test(historyRoute));
assert.ok(!/price_reports|'users'/.test(historyRoute), 'official history route must not read user data');
assert.ok(/getDatabaseSyncClass/.test(read('app/api/parking/route.ts')), 'parking route reuses shared sqlite helper');
console.log('  ✓ /api/parking/history validates zoneId and serves official data only');

// 5. UI: History tab renders both series
const sheet = read('components/map/ZoneDetailSheet.tsx');
assert.ok(/<PriceHistoryChart[\s\S]*official=\{officialHistory\}[\s\S]*mine=\{priceReports\}/.test(sheet));
assert.ok(/\/api\/parking\/history\?zoneId=\$\{encodeURIComponent\(zone\.id\)\}/.test(sheet));
assert.ok(/Post a price/.test(sheet));
assert.ok(!/Snapshot/.test(sheet), 'legacy snapshot UI must be gone');

const chart = read('components/map/PriceHistoryChart.tsx');
assert.ok(/data-series="official"/.test(chart) && /data-series="mine"/.test(chart));
assert.ok(/private and don&apos;t change official rates/.test(chart));
assert.ok(!/z-\[|zIndex/.test(chart), 'chart is inline and must not add stacking layers');
console.log('  ✓ History tab graphs official and personal series');

console.log('🎉 All Price Reports & Rate History tests passed!');
