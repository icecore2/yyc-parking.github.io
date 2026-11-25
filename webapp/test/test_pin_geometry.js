/**
 * Comprehensive Test Suite for Pin Sharp-Tip Geometry, Anti-Overlap Staggering,
 * Multi-Path ArcGIS Normalization, Unique Segment IDs & Highlight Contracts.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const WEBAPP_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEBAPP_ROOT, '..');
const moduleCache = new Map();

function loadTsModule(relPathFromRepoOrWebapp, baseDir = WEBAPP_ROOT) {
  const fullPath = path.resolve(baseDir, relPathFromRepoOrWebapp);
  if (moduleCache.has(fullPath)) return moduleCache.get(fullPath);

  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const mod = { exports: {} };
  moduleCache.set(fullPath, mod.exports);

  const localRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      const candidateTs = path.resolve(path.dirname(fullPath), `${specifier}.ts`);
      if (fs.existsSync(candidateTs)) {
        return loadTsModule(candidateTs, path.dirname(fullPath));
      }
      const candidateExact = path.resolve(path.dirname(fullPath), specifier);
      if (fs.existsSync(candidateExact) && candidateExact.endsWith('.ts')) {
        return loadTsModule(candidateExact, path.dirname(fullPath));
      }
    }
    return require(specifier);
  };

  const fn = new Function('exports', 'require', 'module', transpiled.outputText);
  fn(mod.exports, localRequire, mod);
  moduleCache.set(fullPath, mod.exports);
  return mod.exports;
}

function readWebappFile(relPath) {
  return fs.readFileSync(path.join(WEBAPP_ROOT, relPath), 'utf8');
}

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

console.log('🧪 Running Pin Geometry, Anchoring & Stalls Bar Highlight Test Suite...');

const geom = loadTsModule('lib/parking/geometry.ts');

// -----------------------------------------------------------------------------
// 1. Arc-Length Midpoint Accuracy (Fixes 2-point endpoint bug & uneven polylines)
// -----------------------------------------------------------------------------
const twoPtHorizontal = [
  [-114.071, 51.0526],
  [-114.0734, 51.0526],
];
const midHoriz = geom.pointAlongPolyline(twoPtHorizontal, 0.5);
assert.strictEqual(midHoriz[0], -114.0722, '2-point segment midpoint lng must be exact midpoint');
assert.strictEqual(midHoriz[1], 51.0526, '2-point segment midpoint lat must match line');
assert.notDeepStrictEqual(
  midHoriz,
  twoPtHorizontal[1],
  '2-point polyline midpoint must NEVER equal endpoint vertex'
);
assert.ok(
  geom.distancePointToPolylineMeters(midHoriz, twoPtHorizontal) < 0.05,
  'Midpoint must lie strictly on the stalls bar'
);

const twoPtDiagonal = [
  [-114.07, 51.04],
  [-114.072, 51.042],
];
const midDiag = geom.pointAlongPolyline(twoPtDiagonal, 0.5);
assert.strictEqual(midDiag[0], -114.071, 'Diagonal 2-point segment midpoint lng exact');
assert.strictEqual(midDiag[1], 51.041, 'Diagonal 2-point segment midpoint lat exact');
assert.ok(
  geom.distancePointToPolylineMeters(midDiag, twoPtDiagonal) < 0.08,
  'Diagonal midpoint must lie strictly on the diagonal stalls bar'
);

// Uneven 3-point polyline: 100m North, then 10m East -> total 110m; half = 55m along leg 1
const unevenL = [
  [-114.07, 51.04],
  [-114.07, 51.04 + 100 / 111320],
  [-114.07 + 10 / (111320 * Math.cos((51.0447 * Math.PI) / 180)), 51.04 + 100 / 111320],
];
const midUneven = geom.pointAlongPolyline(unevenL, 0.5);
const expectedMidLat = Number((51.04 + 55 / 111320).toFixed(6));
assert.strictEqual(midUneven[0], -114.07, 'Uneven L midpoint should stay on longer vertical leg');
assert.ok(
  Math.abs(midUneven[1] - expectedMidLat) < 1e-5,
  `Expected uneven arc midpoint lat ~${expectedMidLat}, got ${midUneven[1]}`
);
assert.notDeepStrictEqual(
  midUneven,
  unevenL[1],
  'Arc-length midpoint must NOT blindly snap to middle array vertex'
);

// Boundary cases
assert.deepStrictEqual(geom.pointAlongPolyline(twoPtHorizontal, 0), [-114.071, 51.0526]);
assert.deepStrictEqual(geom.pointAlongPolyline(twoPtHorizontal, 1), [-114.0734, 51.0526]);
assert.deepStrictEqual(geom.pointAlongPolyline([[-114.0712345, 51.0456789]], 0.5), [
  -114.071235, 51.045679,
]);
console.log('  ✓ pointAlongPolyline handles 2-point, diagonal, uneven 3-point & boundary lines cleanly');

// -----------------------------------------------------------------------------
// 2. MultiLineString Primary Path Selection (e.g. Zone 1401)
// -----------------------------------------------------------------------------
const shortFrag = [
  [-114.07, 51.04],
  [-114.07005, 51.04],
];
const longMainBar = [
  [-114.071, 51.041],
  [-114.073, 51.041],
];
const primaryMulti = geom.getPrimaryPath({
  type: 'MultiLineString',
  coordinates: [shortFrag, longMainBar],
});
assert.deepStrictEqual(
  primaryMulti,
  longMainBar,
  'getPrimaryPath must choose the longest bar in MultiLineString'
);
console.log('  ✓ getPrimaryPath selects longest stalls bar for MultiLineString zones');

// -----------------------------------------------------------------------------
// 3. Anti-Overlap Along-Bar Staggering & Multi-Segment Unique IDs
// -----------------------------------------------------------------------------
const northSideBar = [
  [-114.071, 51.04509],
  [-114.0725, 51.04509],
]; // ~105m long
const southSideBar = [
  [-114.071, 51.045],
  [-114.0725, 51.045],
]; // ~10m south of northSideBar

const syntheticZones = [
  {
    id: 'parkplus_2',
    zoneNumber: '1004',
    title: 'Zone #1004',
    address: 'Block North',
    rateSchedule: [],
    activeRate: 3.5,
    isCurrentlyFree: false,
    coordinates: geom.pointAlongPolyline(northSideBar, 0.5),
    geometry: { type: 'LineString', coordinates: northSideBar },
    provider: 'parkplus_on_street',
  },
  {
    id: 'parkplus_3880',
    zoneNumber: '1004',
    title: 'Zone #1004',
    address: 'Block South',
    rateSchedule: [],
    activeRate: 3.5,
    isCurrentlyFree: false,
    coordinates: geom.pointAlongPolyline(southSideBar, 0.5),
    geometry: { type: 'LineString', coordinates: southSideBar },
    provider: 'parkplus_on_street',
  },
  {
    id: 'parkplus_3881',
    zoneNumber: '1004',
    title: 'Zone #1004',
    address: 'East Segment',
    rateSchedule: [],
    activeRate: 3.5,
    isCurrentlyFree: false,
    coordinates: geom.pointAlongPolyline(
      [
        [-114.069, 51.045],
        [-114.07, 51.045],
      ],
      0.5
    ),
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.069, 51.045],
        [-114.07, 51.045],
      ],
    },
    provider: 'parkplus_on_street',
  },
  {
    id: 'parkplus_3882',
    zoneNumber: '1004',
    title: 'Zone #1004',
    address: 'West Segment',
    rateSchedule: [],
    activeRate: 3.5,
    isCurrentlyFree: false,
    coordinates: geom.pointAlongPolyline(
      [
        [-114.073, 51.045],
        [-114.074, 51.045],
      ],
      0.5
    ),
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.073, 51.045],
        [-114.074, 51.045],
      ],
    },
    provider: 'parkplus_on_street',
  },
  {
    id: 'lot_centennial',
    title: 'Centennial Parkade',
    address: '608 9 Ave SW',
    rateSchedule: [],
    activeRate: 4.0,
    isCurrentlyFree: false,
    coordinates: [-114.0757, 51.0453],
    provider: 'cpa_off_street',
  },
];

const anchorMap = geom.resolvePinAnchorCoordinates(syntheticZones, 22);
assert.strictEqual(anchorMap.size, syntheticZones.length, 'Every segment must get its own anchor entry');

const northAnchor = anchorMap.get('parkplus_2');
const southAnchor = anchorMap.get('parkplus_3880');
const pairDistance = geom.approxDistanceMeters(northAnchor, southAnchor);
assert.ok(
  pairDistance >= 20,
  `Expected opposite-side anchors staggered >= 20m apart, got ${pairDistance.toFixed(2)}m`
);
assert.ok(
  geom.distancePointToPolylineMeters(northAnchor, northSideBar) < 0.05,
  'Staggered North anchor must stay strictly on its own North stalls bar'
);
assert.ok(
  geom.distancePointToPolylineMeters(southAnchor, southSideBar) < 0.05,
  'Staggered South anchor must stay strictly on its own South stalls bar'
);
assert.deepStrictEqual(
  anchorMap.get('lot_centennial'),
  [-114.0757, 51.0453],
  'Off-street point facility must retain exact point coordinate'
);
console.log(
  `  ✓ Opposite-side pins staggered ${pairDistance.toFixed(1)}m apart while staying glued (<0.05m) to their bars`
);

// -----------------------------------------------------------------------------
// 4. Data-Service Live ArcGIS Transform Integration Test (Mocked Fetch)
// -----------------------------------------------------------------------------
(async () => {
  const dataService = loadTsModule('lib/parking/data-service.ts');
  assert.strictEqual(
    dataService.CACHE_KEY,
    'yyc_parking_zones_v3',
    'data-service must bump CACHE_KEY to yyc_parking_zones_v3 to bust old v2 endpoint cache'
  );

  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      if (String(url).includes('/api/parking')) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          features: [
            {
              attributes: {
                OBJECTID: 2,
                PARKING_ZONE: '1008',
                STATUS: 'Active',
                ADDRESS_DESC: 'Eau Claire Ave SW',
                SEG_CAP: 12,
                ENFORCEABLE_TIME: '09:00 - 18:00 Mon-Sat',
                HTML_ZONE_RATE: '',
              },
              geometry: {
                // 2-point horizontal bar in EPSG:4326-compatible range (already lng/lat)
                paths: [
                  [
                    [-114.071, 51.0526],
                    [-114.0734, 51.0526],
                  ],
                ],
              },
            },
            {
              attributes: {
                OBJECTID: 3880,
                PARKING_ZONE: '1008', // Same PARKING_ZONE number, distinct bar!
                STATUS: 'Active',
                ADDRESS_DESC: 'Eau Claire Ave SW South Side',
                SEG_CAP: 14,
                ENFORCEABLE_TIME: '09:00 - 18:00 Mon-Sat',
                HTML_ZONE_RATE: '',
              },
              geometry: {
                paths: [
                  [
                    [-114.071, 51.0525],
                    [-114.0734, 51.0525],
                  ],
                ],
              },
            },
            {
              attributes: {
                OBJECTID: 300,
                PARKING_ZONE: '1401',
                STATUS: 'Active',
                ADDRESS_DESC: '1 St SW (MultiPath)',
                SEG_CAP: 16,
                HTML_ZONE_RATE: '',
              },
              geometry: {
                paths: [
                  [
                    [-114.065, 51.049],
                    [-114.06502, 51.049],
                  ],
                  [
                    [-114.065, 51.0492],
                    [-114.065, 51.0504],
                  ],
                ],
              },
            },
          ],
        }),
      };
    };

    const resultZones = await dataService.fetchCalgaryParkingZones(true);
    const seg1 = resultZones.find((z) => z.id === 'parkplus_2');
    const seg2 = resultZones.find((z) => z.id === 'parkplus_3880');
    const multiSeg = resultZones.find((z) => z.id === 'parkplus_300');

    assert.ok(seg1 && seg2, 'Duplicate PARKING_ZONE segments must keep distinct parkplus_<OBJECTID> ids');
    assert.strictEqual(seg1.zoneNumber, '1008');
    assert.strictEqual(seg2.zoneNumber, '1008');
    assert.strictEqual(seg1.coordinates[0], -114.0722, '2-point segment must resolve midpoint, not endpoint');
    assert.strictEqual(multiSeg.geometry.type, 'MultiLineString', 'Multi-path feature must preserve MultiLineString');
    assert.ok(
      Math.abs(multiSeg.coordinates[1] - 51.0498) < 1e-5,
      'MultiLineString midpoint must lie on the longer bar path'
    );
    console.log('  ✓ fetchCalgaryParkingZones produces unique IDs, MultiLineString & true midpoints');
  } finally {
    global.fetch = originalFetch;
  }

  // ---------------------------------------------------------------------------
  // 5. CSS, MapLibre & App Integration Contracts
  // ---------------------------------------------------------------------------
  const globalsCss = readWebappFile('app/globals.css');
  const pinMarkerMatch = globalsCss.match(/\.custom-pin-marker\s*\{([^}]*)\}/);
  assert.ok(pinMarkerMatch, '.custom-pin-marker block must exist');
  assert.ok(/pointer-events\s*:\s*none/.test(pinMarkerMatch[1]), '.custom-pin-marker must pass clicks through transparent corners');
  assert.ok(!/position\s*:\s*relative/.test(pinMarkerMatch[1]), '.custom-pin-marker must NOT override MapLibre position: absolute');

  const pinBubbleMatch = globalsCss.match(/\.pin-bubble\s*\{([^}]*)\}/);
  assert.ok(pinBubbleMatch, '.pin-bubble block must exist');
  assert.ok(/position\s*:\s*absolute/.test(pinBubbleMatch[1]), '.pin-bubble must be absolutely positioned');
  assert.ok(/left\s*:\s*50%/.test(pinBubbleMatch[1]) && /bottom\s*:\s*0/.test(pinBubbleMatch[1]), '.pin-bubble must align sharp bottom-left corner at (50%, 0)');
  assert.ok(/transform-origin\s*:\s*0%\s+100%/.test(pinBubbleMatch[1]), '.pin-bubble must rotate & scale around sharp tip (0% 100%)');
  assert.ok(/pointer-events\s*:\s*auto/.test(pinBubbleMatch[1]), '.pin-bubble must capture pointer events');

  const mapLibreView = readWebappFile('components/map/MapLibreView.tsx');
  assert.ok(/anchor:\s*'bottom'/.test(mapLibreView), 'MapLibreView markers must use anchor: bottom');
  assert.ok(/resolvePinAnchorCoordinates/.test(mapLibreView), 'MapLibreView must resolve staggered on-bar coordinates');
  assert.ok(/closest\(['"]\.custom-pin-marker[^'"]*['"]\)/.test(mapLibreView), 'MapLibreView canvas click handler must guard against pin clicks');
  assert.ok(/parking-selected-line-glow/.test(mapLibreView), 'MapLibreView must include amber outer glow stalls bar layer');
  assert.ok(/parking-selected-line-layer/.test(mapLibreView), 'MapLibreView must include amber core stalls bar layer');
  assert.ok(/parking-selected-anchor-layer/.test(mapLibreView), 'MapLibreView must include sharp-tip contact dot layer');
  assert.ok(
    /styleReadyRef\.current/.test(mapLibreView) && /mapStyleReady/.test(mapLibreView),
    'MapLibreView must track style readiness with styleReadyRef/mapStyleReady instead of isStyleLoaded()'
  );
  assert.ok(
    !/isStyleLoaded\s*\(/.test(mapLibreView),
    'MapLibreView must NOT use map.isStyleLoaded() (returns false during raster tile streaming and drops live lines)'
  );
  assert.ok(/dataset\.zoneId/.test(mapLibreView), 'MapLibreView markers must set data-zone-id');

  const miniMapTeaser = readWebappFile('components/landing/MiniMapTeaser.tsx');
  assert.ok(/anchor:\s*'bottom'/.test(miniMapTeaser), 'MiniMapTeaser markers must use anchor: bottom');
  assert.ok(/parking-lines-layer/.test(miniMapTeaser), 'MiniMapTeaser must render stalls lines');
  assert.ok(/parking-selected-line-layer/.test(miniMapTeaser), 'MiniMapTeaser must highlight selected stalls line');
  assert.ok(
    /styleReadyRef\.current/.test(miniMapTeaser) && !/isStyleLoaded\s*\(/.test(miniMapTeaser),
    'MiniMapTeaser must use styleReadyRef and avoid map.isStyleLoaded()'
  );

  const routeTs = readWebappFile('app/api/parking/route.ts');
  assert.ok(/id:\s*docSnap\.id/.test(routeTs) && /id:\s*String\(row\.id/.test(routeTs), 'API route must preserve unique record IDs');
  assert.ok(/pointAlongPolyline/.test(routeTs), 'API route must recompute arc-length midpoint from geometry');

  const myParkingFetcher = readRepoFile('services/parking-sync/src/fetchers/myparking.ts');
  assert.ok(/computeArcLengthMidpoint/.test(myParkingFetcher) && /MultiLineString/.test(myParkingFetcher), 'Sync fetcher must compute arc-length midpoint & handle MultiLineString');

  console.log('  ✓ CSS sharp-tip geometry, MapLibre click isolation & highlight contracts verified');
  console.log('🎉 All Pin Geometry & Stalls Bar Highlight tests passed successfully!');
})().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
