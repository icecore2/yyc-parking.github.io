/**
 * UI Layering & Stacking Context Regression Test Suite (Next.js Webapp)
 * Ensures clicked/hovered map pins and popups never overlay blurred dialogs,
 * side sheets, toolbars, or dropdowns.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WEBAPP_ROOT = path.resolve(__dirname, '..');

function readWebappFile(relPath) {
  return fs.readFileSync(path.join(WEBAPP_ROOT, relPath), 'utf8');
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

console.log('🧪 Running Webapp UI Layering & Stacking Context Test Suite...');

// -----------------------------------------------------------------------------
// 1. CSS Pin & Popup Z-Index Bounds & Map Isolation (globals.css)
// -----------------------------------------------------------------------------
const globalsCss = readWebappFile('app/globals.css');

const mapBlock = getCssBlock(globalsCss, '.maplibregl-map');
assert.ok(/position\s*:\s*relative/.test(mapBlock), '.maplibregl-map must have position: relative');
assert.ok(/isolation\s*:\s*isolate/.test(mapBlock), '.maplibregl-map must have isolation: isolate');
assert.strictEqual(getCssZIndex(mapBlock, '.maplibregl-map'), 0, '.maplibregl-map must have z-index: 0');

const markerSelectors = [
  '.custom-pin-marker',
  '.custom-pin-marker:hover',
  '.custom-pin-marker.pin-active',
  '.yyc-marker-container:hover',
  '.yyc-marker-selected',
  '.custom-target-marker',
  '.maplibregl-popup',
];

const markerZ = {};
for (const sel of markerSelectors) {
  const block = getCssBlock(globalsCss, sel);
  const z = getCssZIndex(block, sel);
  assert.ok(z >= 0 && z <= 30, `Selector "${sel}" z-index (${z}) must stay bounded <= 30 inside map stacking context`);
  markerZ[sel] = z;
}

assert.ok(
  markerZ['.custom-pin-marker.pin-active'] > markerZ['.custom-pin-marker:hover'],
  'Active pin should stack above hovered pin inside the map container'
);
assert.ok(
  markerZ['.custom-pin-marker:hover'] > markerZ['.custom-pin-marker'],
  'Hovered pin should stack above default pin inside the map container'
);
console.log('  ✓ CSS map container isolation & bounded pin/popup z-index rules verified');

// -----------------------------------------------------------------------------
// 2. Component Stacking Context Isolation & Modal Popup Dismissal
// -----------------------------------------------------------------------------
const mapLibreView = readWebappFile('components/map/MapLibreView.tsx');
assert.ok(
  /<div className="[^"]*\brelative\b[^"]*\bz-0\b[^"]*\bisolate\b[^"]*">\s*<div ref=\{mapContainer\} className="[^"]*\brelative\b[^"]*\bz-0\b[^"]*\bisolate\b[^"]*"/.test(
    mapLibreView
  ),
  'MapLibreView wrapper and mapContainer must establish relative z-0 isolate stacking contexts'
);
assert.ok(
  /hasOpenModal\?: boolean/.test(mapLibreView) &&
    /\(isPickingLocation \|\| hasOpenModal\) && activePopupRef\.current/.test(mapLibreView),
  'MapLibreView must dismiss active MapLibre popup when a modal dialog opens or location picking starts'
);

const appPage = readWebappFile('app/app/page.tsx');
assert.ok(
  /hasOpenModal=\{[\s\S]*showLocationsDialog[\s\S]*showSettingsDialog[\s\S]*alarmZone[\s\S]*proGateInfo/.test(
    appPage
  ),
  'MapAppPage must pass hasOpenModal state to MapLibreView for all modal dialogs'
);

const miniMapTeaser = readWebappFile('components/landing/MiniMapTeaser.tsx');
assert.ok(
  /<div ref=\{mapContainer\} className="[^"]*\brelative\b[^"]*\bz-0\b[^"]*\bisolate\b[^"]*"/.test(
    miniMapTeaser
  ),
  'MiniMapTeaser mapContainer must isolate its WebGL/marker stacking context with relative z-0 isolate'
);
const teaserFloatMatch = miniMapTeaser.match(/Selected Zone Float Sheet[\s\S]*?<div className="([^"]+)"/);
assert.ok(teaserFloatMatch, 'MiniMapTeaser Selected Zone Float Sheet className must exist');
const teaserFloatZ = parseTailwindZIndex(teaserFloatMatch[1], 'MiniMapTeaser float sheet');
assert.ok(teaserFloatZ >= 10, `MiniMapTeaser float sheet z-index (${teaserFloatZ}) must stay above map (z-0)`);
console.log('  ✓ MapLibreView, MapAppPage modal popup dismissal & MiniMapTeaser isolation verified');

// -----------------------------------------------------------------------------
// 3. Strict UI Layering Hierarchy Verification
// -----------------------------------------------------------------------------
const mapOverlays = readWebappFile('components/map/MapOverlays.tsx');
const secondaryToolbar = readWebappFile('components/map/SecondaryToolbar.tsx');
const providerToolbar = readWebappFile('components/map/ProviderToolbar.tsx');
const originalHeader = readWebappFile('components/map/OriginalHeader.tsx');
const zoneDetailSheet = readWebappFile('components/map/ZoneDetailSheet.tsx');
const sheetUi = readWebappFile('components/ui/sheet.tsx');
const dialogUi = readWebappFile('components/ui/dialog.tsx');
const selectUi = readWebappFile('components/ui/select.tsx');
const dropdownUi = readWebappFile('components/ui/dropdown-menu.tsx');
const tooltipUi = readWebappFile('components/ui/tooltip.tsx');

const mapContainerZ = parseTailwindZIndex(
  mapLibreView.match(/<div ref=\{mapContainer\} className="([^"]+)"/)[1],
  'MapLibreView mapContainer'
);

const overlayStatusZ = parseTailwindZIndex(
  mapOverlays.match(/Status & Zone Count[\s\S]*?<div className="([^"]+)"/)[1],
  'MapOverlays status badge'
);
const pickerBannerZ = parseTailwindZIndex(
  mapOverlays.match(/id="map-picker-banner"[\s\S]*?className="([^"]+)"/)[1],
  'MapOverlays picker banner'
);

const secondaryToolbarClass = secondaryToolbar.match(/id="filter-toolbar-row"[\s\S]*?className="([^"]+)"/)[1];
assert.ok(/\brelative\b/.test(secondaryToolbarClass), 'SecondaryToolbar must include relative positioning');
const secondaryToolbarZ = parseTailwindZIndex(secondaryToolbarClass, 'SecondaryToolbar');

const providerToolbarClass = providerToolbar.match(/id="provider-toolbar-row"[\s\S]*?className="([^"]+)"/)[1];
assert.ok(/\brelative\b/.test(providerToolbarClass), 'ProviderToolbar must include relative positioning');
const providerToolbarZ = parseTailwindZIndex(providerToolbarClass, 'ProviderToolbar');

const headerZ = parseTailwindZIndex(
  originalHeader.match(/<header className="([^"]+)"/)[1],
  'OriginalHeader'
);

const zoneDetailSheetZ = parseTailwindZIndex(
  zoneDetailSheet.match(/<aside[\s\S]*?className="([^"]+)"/)[1],
  'ZoneDetailSheet'
);

const sheetOverlayZ = parseTailwindZIndex(
  sheetUi.match(/SheetPrimitive\.Overlay[\s\S]*?'([^']+)'/)[1],
  'SheetOverlay'
);
const sheetContentZ = parseTailwindZIndex(
  sheetUi.match(/const sheetVariants = cva\(\s*'([^']+)'/)[1],
  'SheetContent'
);

const dialogOverlayZ = parseTailwindZIndex(
  dialogUi.match(/DialogPrimitive\.Overlay[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'DialogOverlay'
);
const dialogContentZ = parseTailwindZIndex(
  dialogUi.match(/DialogPrimitive\.Content[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'DialogContent'
);

const selectContentZ = parseTailwindZIndex(
  selectUi.match(/SelectPrimitive\.Content[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'SelectContent'
);
const dropdownSubContentZ = parseTailwindZIndex(
  dropdownUi.match(/DropdownMenuPrimitive\.SubContent[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'DropdownMenuSubContent'
);
const dropdownContentZ = parseTailwindZIndex(
  dropdownUi.match(/DropdownMenuPrimitive\.Content[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'DropdownMenuContent'
);
const tooltipContentZ = parseTailwindZIndex(
  tooltipUi.match(/TooltipPrimitive\.Content[\s\S]*?className=\{cn\(\s*'([^']+)'/)[1],
  'TooltipContent'
);

assert.strictEqual(mapContainerZ, 0, 'Map container must be at z-0');
assert.strictEqual(overlayStatusZ, 20, 'MapOverlays must be at z-20');
assert.strictEqual(secondaryToolbarZ, 20, 'SecondaryToolbar must be at z-20');
assert.strictEqual(providerToolbarZ, 20, 'ProviderToolbar must be at z-20');
assert.strictEqual(headerZ, 30, 'OriginalHeader must be at z-30');
assert.strictEqual(zoneDetailSheetZ, 40, 'ZoneDetailSheet must be at z-40');
assert.strictEqual(pickerBannerZ, 50, 'Map picker banner must be at z-50');
assert.strictEqual(sheetOverlayZ, 1000, 'SheetOverlay must be at z-[1000]');
assert.strictEqual(sheetContentZ, 1010, 'SheetContent must be at z-[1010]');
assert.strictEqual(dialogOverlayZ, 1100, 'DialogOverlay must be at z-[1100]');
assert.strictEqual(dialogContentZ, 1110, 'DialogContent must be at z-[1110]');
assert.strictEqual(selectContentZ, 1200, 'SelectContent must be at z-[1200]');
assert.strictEqual(dropdownSubContentZ, 1200, 'DropdownMenuSubContent must be at z-[1200]');
assert.strictEqual(dropdownContentZ, 1200, 'DropdownMenuContent must be at z-[1200]');
assert.strictEqual(tooltipContentZ, 1200, 'TooltipContent must be at z-[1200]');

assert.ok(
  mapContainerZ < overlayStatusZ &&
    overlayStatusZ < headerZ &&
    headerZ < zoneDetailSheetZ &&
    zoneDetailSheetZ < pickerBannerZ &&
    pickerBannerZ < sheetOverlayZ &&
    sheetOverlayZ < sheetContentZ &&
    sheetContentZ < dialogOverlayZ &&
    dialogOverlayZ < dialogContentZ &&
    dialogContentZ < selectContentZ,
  'Strict global z-index layering order violated'
);
console.log('  ✓ Strict UI layering hierarchy verified (z-0 → z-20 → z-30 → z-40 → z-50 → z-1000 → z-1100 → z-1200)');

// -----------------------------------------------------------------------------
// 4. Effective Stacking Order Simulation (Clicked Pin vs. Blurred Dialog & Overlays)
// -----------------------------------------------------------------------------
// Because .maplibregl-map / mapContainer creates an isolated stacking context at z=0,
// a clicked pin (.pin-active, local z=20) resolves as [0, 20] in the root context.
const clickedPinStackPath = [mapContainerZ, markerZ['.custom-pin-marker.pin-active']];
const hoveredPinStackPath = [mapContainerZ, markerZ['.custom-pin-marker:hover']];
const popupStackPath = [mapContainerZ, markerZ['.maplibregl-popup']];

assert.ok(
  compareStackingOrder(clickedPinStackPath, [dialogOverlayZ]) < 0,
  'Clicked pin must render strictly below blurred DialogOverlay'
);
assert.ok(
  compareStackingOrder(clickedPinStackPath, [dialogContentZ]) < 0,
  'Clicked pin must render strictly below DialogContent'
);
assert.ok(
  compareStackingOrder(popupStackPath, [dialogOverlayZ]) < 0,
  'Map popup must render strictly below blurred DialogOverlay'
);
assert.ok(
  compareStackingOrder(hoveredPinStackPath, [dialogOverlayZ]) < 0,
  'Hovered pin must render strictly below blurred DialogOverlay'
);
assert.ok(
  compareStackingOrder(clickedPinStackPath, [zoneDetailSheetZ]) < 0,
  'Clicked pin must render strictly below ZoneDetailSheet'
);
assert.ok(
  compareStackingOrder(clickedPinStackPath, [overlayStatusZ]) < 0,
  'Clicked pin must render strictly below MapOverlays'
);
assert.ok(
  compareStackingOrder([0, markerZ['.custom-pin-marker']], [teaserFloatZ]) < 0,
  'Teaser map pin must render strictly below MiniMapTeaser floating zone card'
);
assert.ok(
  compareStackingOrder([dialogContentZ], [selectContentZ]) < 0,
  'Select/Dropdown/Tooltip inside dialogs must render strictly above DialogContent'
);
console.log('  ✓ Effective stacking simulation confirms clicked pins stay beneath blurred dialogs & overlays');

console.log('🎉 All Webapp UI Layering tests passed successfully!');
