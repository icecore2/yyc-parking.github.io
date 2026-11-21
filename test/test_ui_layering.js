/**
 * UI Layering & Stacking Context Regression Test Suite (Standalone Web App)
 * Ensures clicked/hovered Leaflet pins stay inside #map's isolated stacking
 * context and never overlay blurred dialogs, side sheets, or toolbars.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function readRootFile(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function getCssBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm');
  const match = css.match(regex);
  assert.ok(match, `Expected CSS block for selector "${selector}"`);
  return match[1];
}

function getCssZIndex(block, selector) {
  const match = block.match(/z-index\s*:\s*(-?\d+)/);
  assert.ok(match, `Expected numeric z-index inside CSS block "${selector}"`);
  return parseInt(match[1], 10);
}

function parseTailwindZIndex(classStr, contextLabel) {
  const match = classStr.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/);
  assert.ok(match, `Expected Tailwind z-index class in ${contextLabel}: "${classStr}"`);
  return parseInt(match[1] || match[2], 10);
}

function compareStackingOrder(pathA, pathB) {
  const len = Math.max(pathA.length, pathB.length);
  for (let i = 0; i < len; i++) {
    const a = pathA[i] ?? 0;
    const b = pathB[i] ?? 0;
    if (a !== b) return a - b;
  }
  return 0;
}

console.log('=== RUNNING STANDALONE UI LAYERING & STACKING TESTS ===\n');

const stylesCss = readRootFile('css/styles.css');
const indexHtml = readRootFile('index.html');

// -----------------------------------------------------------------------------
// 1. CSS Map Isolation & Bounded Pin Z-Index Rules
// -----------------------------------------------------------------------------
const mapBlock = getCssBlock(stylesCss, '#map');
assert.ok(/position\s*:\s*relative/.test(mapBlock), '#map must have position: relative');
assert.ok(/isolation\s*:\s*isolate/.test(mapBlock), '#map must have isolation: isolate');
const mapCssZ = getCssZIndex(mapBlock, '#map');
assert.strictEqual(mapCssZ, 1, '#map must have z-index: 1');

const pinSelectors = [
  '.custom-pin-marker',
  '.custom-pin-marker:hover',
  '.custom-pin-marker:hover .pin-bubble',
  '.custom-pin-marker.pin-active',
  '.pin-active .pin-bubble',
];

const pinZ = {};
for (const sel of pinSelectors) {
  const block = getCssBlock(stylesCss, sel);
  const z = getCssZIndex(block, sel);
  assert.ok(z >= 0 && z <= 30, `Selector "${sel}" z-index (${z}) must stay bounded <= 30 inside #map`);
  pinZ[sel] = z;
}
console.log('✔ Standalone CSS #map isolation and bounded pin z-index rules verified');

// -----------------------------------------------------------------------------
// 2. HTML Element Layering Hierarchy
// -----------------------------------------------------------------------------
const mapElMatch = indexHtml.match(/<div id="map" class="([^"]+)"/);
assert.ok(mapElMatch, '#map element must have class attribute');
assert.ok(/\brelative\b/.test(mapElMatch[1]) && /\bisolate\b/.test(mapElMatch[1]), '#map must include relative isolate classes');

const headerZ = parseTailwindZIndex(
  indexHtml.match(/<header class="([^"]+)"/)[1],
  'header'
);

const filterToolbarClass = indexHtml.match(/id="filter-toolbar-row" class="([^"]+)"/)[1];
assert.ok(/\brelative\b/.test(filterToolbarClass), '#filter-toolbar-row must include relative');
const filterToolbarZ = parseTailwindZIndex(filterToolbarClass, '#filter-toolbar-row');

const providerToolbarClass = indexHtml.match(/id="provider-toolbar-row" class="([^"]+)"/)[1];
assert.ok(/\brelative\b/.test(providerToolbarClass), '#provider-toolbar-row must include relative');
const providerToolbarZ = parseTailwindZIndex(providerToolbarClass, '#provider-toolbar-row');

const pickerBannerZ = parseTailwindZIndex(
  indexHtml.match(/id="map-picker-banner" class="([^"]+)"/)[1],
  '#map-picker-banner'
);
const sheetBackdropZ = parseTailwindZIndex(
  indexHtml.match(/id="sheet-backdrop" class="([^"]+)"/)[1],
  '#sheet-backdrop'
);
const detailsSheetZ = parseTailwindZIndex(
  indexHtml.match(/id="details-sheet" class="([^"]+)"/)[1],
  '#details-sheet'
);
const settingsDialogZ = parseTailwindZIndex(
  indexHtml.match(/id="settings-dialog" class="([^"]+)"/)[1],
  '#settings-dialog'
);
const locationsDialogZ = parseTailwindZIndex(
  indexHtml.match(/id="locations-dialog" class="([^"]+)"/)[1],
  '#locations-dialog'
);

assert.strictEqual(filterToolbarZ, 20, '#filter-toolbar-row must be z-20');
assert.strictEqual(providerToolbarZ, 20, '#provider-toolbar-row must be z-20');
assert.strictEqual(headerZ, 30, 'header must be z-30');
assert.strictEqual(sheetBackdropZ, 40, '#sheet-backdrop must be z-40');
assert.strictEqual(detailsSheetZ, 50, '#details-sheet must be z-50');
assert.strictEqual(pickerBannerZ, 50, '#map-picker-banner must be z-50');
assert.strictEqual(settingsDialogZ, 100, '#settings-dialog must be z-[100]');
assert.strictEqual(locationsDialogZ, 100, '#locations-dialog must be z-[100]');

assert.ok(
  mapCssZ < filterToolbarZ &&
    filterToolbarZ < headerZ &&
    headerZ < sheetBackdropZ &&
    sheetBackdropZ < detailsSheetZ &&
    detailsSheetZ < settingsDialogZ &&
    detailsSheetZ < locationsDialogZ,
  'Standalone HTML UI z-index hierarchy violated'
);

// Effective stacking order check: clicked pin inside #map ([1, 20]) vs sheets/dialogs
const clickedPinPath = [mapCssZ, pinZ['.custom-pin-marker.pin-active']];
assert.ok(compareStackingOrder(clickedPinPath, [settingsDialogZ]) < 0, 'Clicked pin must stay below #settings-dialog');
assert.ok(compareStackingOrder(clickedPinPath, [locationsDialogZ]) < 0, 'Clicked pin must stay below #locations-dialog');
assert.ok(compareStackingOrder(clickedPinPath, [sheetBackdropZ]) < 0, 'Clicked pin must stay below #sheet-backdrop');
assert.ok(compareStackingOrder(clickedPinPath, [detailsSheetZ]) < 0, 'Clicked pin must stay below #details-sheet');

console.log('✔ Standalone HTML layering order and dialog containment verified');
console.log('\n======================================================');
console.log('✔ ALL STANDALONE UI LAYERING TESTS PASSED CLEANLY!');
console.log('======================================================');
