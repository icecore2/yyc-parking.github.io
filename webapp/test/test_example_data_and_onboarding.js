/**
 * Test Suite for Editable Example Data, Walkthrough Progress, CSV Safety & Integration Contracts
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const WEBAPP_ROOT = path.resolve(__dirname, '..');

function loadTsModule(relPath) {
  const fullPath = path.join(WEBAPP_ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(mod.exports, require, mod);
  return mod.exports;
}

function readWebappFile(relPath) {
  return fs.readFileSync(path.join(WEBAPP_ROOT, relPath), 'utf8');
}

const ex = loadTsModule('lib/parking/example-data.ts');

console.log('🧪 Running Example Data & Onboarding Test Suite...');

// 1. Example Data Catalog Integrity
assert.ok(ex.EXAMPLE_VEHICLES.length >= 1, 'Expected at least 1 example vehicle');
assert.ok(ex.EXAMPLE_SESSIONS.length === 3, 'Expected 3 example parking sessions');
assert.ok(ex.EXAMPLE_LOCATIONS.length === 3, 'Expected 3 example custom locations');
assert.ok(ex.EXAMPLE_FAVORITES.length >= 1, 'Expected at least 1 example favorite');

for (const list of [
  ex.EXAMPLE_VEHICLES,
  ex.EXAMPLE_SESSIONS,
  ex.EXAMPLE_LOCATIONS,
  ex.EXAMPLE_FAVORITES,
]) {
  for (const item of list) {
    assert.strictEqual(item.isExample, true, `Example item ${item.id} must have isExample: true`);
    assert.ok(item.id.startsWith('example_'), `Example item ${item.id} should have example_ prefix`);
  }
}

const snapshots = ex.createExampleRateSnapshots(4.0);
assert.strictEqual(snapshots.length, 2, 'Expected 2 example rate snapshots');
assert.ok(snapshots.every((s) => s.isExample === true), 'All default rate snapshots must be marked isExample');
assert.strictEqual(snapshots[0].rate, 3.5, 'Base rate snapshot should compute activeRate - 0.5');
assert.strictEqual(snapshots[1].rate, 4.0, 'Current rate snapshot should match activeRate');
console.log('  ✓ Example data catalogs & rate snapshots properly tagged');

// 2. Placeholder Name & Example Flag Helpers
assert.strictEqual(ex.isPlaceholderDisplayName(null), true);
assert.strictEqual(ex.isPlaceholderDisplayName(''), true);
assert.strictEqual(ex.isPlaceholderDisplayName('  '), true);
assert.strictEqual(ex.isPlaceholderDisplayName('Calgary Commuter'), true);
assert.strictEqual(ex.isPlaceholderDisplayName('calgary driver'), true);
assert.strictEqual(ex.isPlaceholderDisplayName('Calgary Driver (Demo Mode)'), true);
assert.strictEqual(ex.isPlaceholderDisplayName('Jordan Lee'), false);

const stripped = ex.stripExampleFlag(ex.EXAMPLE_VEHICLES[0]);
assert.strictEqual('isExample' in stripped, false, 'stripExampleFlag must remove isExample key');
assert.strictEqual(stripped.plate, 'BXY-8492', 'stripExampleFlag must preserve data fields');
console.log('  ✓ Placeholder display name detection and stripExampleFlag verified');

// 3. Merge, Dismiss & Restore Semantics
const realVeh = {
  id: 'veh_real_1',
  plate: 'XYZ-999',
  description: 'Toyota RAV4',
  isPrimary: true,
  createdAt: 1731000000000,
};

const mergedInitial = ex.mergeWithExamples([], ex.EXAMPLE_VEHICLES, []);
assert.strictEqual(mergedInitial.length, 1);
assert.strictEqual(mergedInitial[0].isExample, true);

const mergedBoth = ex.mergeWithExamples([realVeh], ex.EXAMPLE_VEHICLES, []);
assert.strictEqual(mergedBoth.length, 2);
assert.strictEqual(mergedBoth[0].id, 'veh_real_1');
assert.strictEqual(mergedBoth[0].isExample, false);
assert.strictEqual(mergedBoth[1].id, 'example_vehicle_1');
assert.strictEqual(mergedBoth[1].isExample, true);

const mergedDismissed = ex.mergeWithExamples([realVeh], ex.EXAMPLE_VEHICLES, ['example_vehicle_1']);
assert.strictEqual(mergedDismissed.length, 1);
assert.strictEqual(mergedDismissed[0].id, 'veh_real_1');
assert.strictEqual(ex.hasExampleItems(mergedDismissed), false);

let obState = { ...ex.DEFAULT_ONBOARDING_STATE };
obState = ex.dismissExampleIds(obState, ['example_vehicle_1', 'example_exp_1', 'example_vehicle_1']);
assert.deepStrictEqual(obState.dismissedExampleIds, ['example_vehicle_1', 'example_exp_1']);
obState = ex.restoreExampleIds(obState, ['example_vehicle_1']);
assert.deepStrictEqual(obState.dismissedExampleIds, ['example_exp_1']);
console.log('  ✓ mergeWithExamples, dismissExampleIds, and restoreExampleIds verified');

// 4. Walkthrough Progress Computation
const freshProgress = ex.computeWalkthroughProgress({
  displayName: 'Calgary Driver',
  vehicles: ex.EXAMPLE_VEHICLES,
  locations: ex.EXAMPLE_LOCATIONS,
  favorites: ex.EXAMPLE_FAVORITES,
  sessions: ex.EXAMPLE_SESSIONS,
  onboardingState: ex.DEFAULT_ONBOARDING_STATE,
});
assert.strictEqual(freshProgress.completedCount, 0, 'Fresh user should start at 0/5');
assert.strictEqual(freshProgress.allDone, false);
assert.strictEqual(freshProgress.remainingExampleCount, ex.ALL_EXAMPLE_IDS.length);

const partialProgress = ex.computeWalkthroughProgress({
  displayName: 'Maya Patel',
  vehicles: [realVeh],
  locations: ex.EXAMPLE_LOCATIONS,
  favorites: ex.EXAMPLE_FAVORITES,
  sessions: ex.EXAMPLE_SESSIONS,
  onboardingState: {
    ...ex.DEFAULT_ONBOARDING_STATE,
    dismissedExampleIds: ['example_vehicle_1'],
  },
});
assert.strictEqual(partialProgress.completedCount, 2, 'Profile + Vehicle should mark 2/5 complete');
assert.strictEqual(partialProgress.steps.profile.completed, true);
assert.strictEqual(partialProgress.steps.vehicles.completed, true);
assert.strictEqual(partialProgress.steps.vehicles.hasRealData, true);
assert.strictEqual(partialProgress.steps.locations.completed, false);

const clearedProgress = ex.computeWalkthroughProgress({
  displayName: 'Maya Patel',
  vehicles: [],
  locations: [],
  favorites: [],
  sessions: [],
  onboardingState: {
    ...ex.DEFAULT_ONBOARDING_STATE,
    dismissedExampleIds: [...ex.ALL_EXAMPLE_IDS],
  },
});
assert.strictEqual(clearedProgress.completedCount, 5, 'Clearing all examples + real name completes 5/5');
assert.strictEqual(clearedProgress.allDone, true);
assert.strictEqual(clearedProgress.remainingExampleCount, 0);
console.log('  ✓ Walkthrough progress calculation (0/5, 2/5, 5/5) verified');

// 5. Expense CSV Safety (Never silently export example rows)
const csvDefaultOnlyExamples = ex.buildExpenseCsvContent(ex.EXAMPLE_SESSIONS);
assert.strictEqual(csvDefaultOnlyExamples.exportedCount, 0);
assert.strictEqual(csvDefaultOnlyExamples.skippedExampleCount, 3);

const csvPreviewWithExamples = ex.buildExpenseCsvContent(ex.EXAMPLE_SESSIONS, { includeExamples: true });
assert.strictEqual(csvPreviewWithExamples.exportedCount, 3);
assert.strictEqual(csvPreviewWithExamples.skippedExampleCount, 0);

const realSession = {
  id: 'session_real_1',
  zoneId: '1008',
  address: '5 Ave SW, "Downtown"',
  startTime: 1732000000000,
  durationHours: 2,
  hourlyRate: 3.5,
  totalCostDollars: 7.0,
  expiryTime: 1732007200000,
  alertLeadMinutes: 15,
  active: false,
  notes: 'Client "ABC" visit',
  isExample: false,
};
const csvMixed = ex.buildExpenseCsvContent([realSession, ...ex.EXAMPLE_SESSIONS]);
assert.strictEqual(csvMixed.exportedCount, 1, 'Only real sessions should export by default');
assert.strictEqual(csvMixed.skippedExampleCount, 3);
assert.ok(csvMixed.csv.includes('""Downtown""'), 'CSV must properly escape embedded double quotes');
assert.ok(csvMixed.csv.includes('Client ""ABC"" visit'), 'CSV must properly escape notes quotes');
assert.ok(!csvMixed.csv.includes('Stephen Ave'), 'Example rows must not leak into real CSV export');
console.log('  ✓ CRA expense CSV export excludes example rows by default and escapes quotes');

// 6. Firestore Rules & App Integration Contracts
const rules = readWebappFile('firestore.rules');
assert.ok(/match \/vehicles\/\{vehicleId\}/.test(rules), 'firestore.rules must define vehicles subcollection');
assert.ok(/match \/locations\/\{locationId\}/.test(rules), 'firestore.rules must define locations subcollection');
assert.ok(/match \/preferences\/\{prefId\}/.test(rules), 'firestore.rules must define preferences subcollection');
assert.ok(/prefId == 'onboarding'/.test(rules), 'firestore.rules must scope preferences to onboarding');
assert.ok(/match \/price_reports\/\{reportId\}/.test(rules), 'firestore.rules must define price_reports subcollection');
assert.ok(/match \/parking_rate_history\/\{zoneId\}/.test(rules), 'firestore.rules must define parking_rate_history');
assert.ok(/areImmutableFieldsUnchanged\(\['id', 'createdAt'\]\)/.test(rules), 'sessions update must allow editing startTime');

const layoutTsx = readWebappFile('app/layout.tsx');
assert.ok(/<WalkthroughProvider>/.test(layoutTsx), 'layout.tsx must mount WalkthroughProvider');

const authCtx = readWebappFile('lib/firebase/auth-context.tsx');
assert.ok(/updateUserDisplayName/.test(authCtx), 'auth-context.tsx must expose updateUserDisplayName');
assert.ok(/isNewUser/.test(authCtx), 'auth-context.tsx must expose isNewUser');
assert.ok(!/createdAt:\s*1730000000000/.test(authCtx), 'auth-context.tsx must use Date.now() instead of hardcoded timestamp');

const firestoreTs = readWebappFile('lib/firebase/firestore.ts');
assert.ok(/sanitizeFirestorePayload/.test(firestoreTs), 'firestore.ts must strip isExample before remote writes');
assert.ok(/getUserVehicles/.test(firestoreTs) && /getUserLocations/.test(firestoreTs) && /getUserOnboardingState/.test(firestoreTs));
assert.ok(/saveOrReplaceVehicle/.test(firestoreTs) && /saveOrReplaceFavorite/.test(firestoreTs) && /saveOrReplaceLocation/.test(firestoreTs) && /createPriceReport/.test(firestoreTs));

const accountTsx = readWebappFile('app/account/page.tsx');
assert.ok(/id="favorites"/.test(accountTsx), 'account page must provide #favorites anchor for Navbar link');
assert.ok(/Registered Vehicles/.test(accountTsx) && /ExampleDataBanner/.test(accountTsx));

const expensesTsx = readWebappFile('app/expenses/page.tsx');
assert.ok(/buildExpenseCsvContent/.test(expensesTsx) && /TransactionFormDialog/.test(expensesTsx));
assert.ok(/encodeURIComponent\(csvBody\)/.test(expensesTsx), 'CSV download must encode # and special chars via encodeURIComponent');

const appPageTsx = readWebappFile('app/app/page.tsx');
assert.ok(/setActiveLocationId\(\(prev\) =>/.test(appPageTsx), 'handleClearExampleLocations must use functional state updater');

const locDialogTsx = readWebappFile('components/map/LocationsDialog.tsx');
assert.ok(/setResolvedCoords/.test(locDialogTsx) && /onUpdateLocation/.test(locDialogTsx));

const zoneSheetTsx = readWebappFile('components/map/ZoneDetailSheet.tsx');
assert.ok(/getUserPriceReports/.test(zoneSheetTsx) && /saveUserPriceReport/.test(zoneSheetTsx));
assert.ok(/item\.isExample && <ExampleBadge/.test(zoneSheetTsx), 'ZoneDetailSheet must badge example price reports');
console.log('  ✓ Firestore rules and UI integration contracts verified');

console.log('🎉 All Example Data & Onboarding tests passed successfully!');
