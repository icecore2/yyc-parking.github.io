/**
 * Test Suite for zoom-based pin clustering on the /app map:
 * pin feature building, supercluster aggregation expressions, provider-mix ring,
 * cluster labels and the MapLibreView wiring contract.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const styleSpec = require('@maplibre/maplibre-gl-style-spec');

const WEBAPP_ROOT = path.resolve(__dirname, '..');
const moduleCache = new Map();

function loadTsModule(fullPath) {
  if (moduleCache.has(fullPath)) return moduleCache.get(fullPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const mod = { exports: {} };
  moduleCache.set(fullPath, mod.exports);
  const localRequire = (specifier) => {
    if (specifier.startsWith('.')) {
      const candidate = path.resolve(path.dirname(fullPath), `${specifier}.ts`);
      if (fs.existsSync(candidate)) return loadTsModule(candidate);
    }
    return require(specifier);
  };
  new Function('exports', 'require', 'module', transpiled.outputText)(mod.exports, localRequire, mod);
  moduleCache.set(fullPath, mod.exports);
  return mod.exports;
}

console.log('🧪 Running Pin Clustering Test Suite...');

const clusters = loadTsModule(path.join(WEBAPP_ROOT, 'lib/parking/pin-clusters.ts'));
const { PROVIDERS } = loadTsModule(path.join(WEBAPP_ROOT, 'lib/parking/providers.ts'));

// -----------------------------------------------------------------------------
// 1. Config: active pins must always be broken out of clusters after flyTo
// -----------------------------------------------------------------------------
assert.ok(clusters.PIN_CLUSTER_MAX_ZOOM < 15.5, 'Clusters must break apart below the preview flyTo zoom (15.5)');
assert.ok(clusters.PIN_CLUSTER_MAX_ZOOM >= 12, 'Clustering should cover city-wide zoom levels');
assert.ok(clusters.PIN_CLUSTER_RADIUS >= 30 && clusters.PIN_CLUSTER_RADIUS <= 80, 'Cluster radius must stay in a sane px range');
assert.deepStrictEqual(
  [...clusters.PIN_CLUSTER_PROVIDER_IDS].sort(),
  Object.keys(PROVIDERS).sort(),
  'Cluster provider counters must cover every registered provider'
);
console.log('  ✓ Cluster zoom/radius config verified');

// -----------------------------------------------------------------------------
// 2. Pin features sit on the resolved sharp-tip anchor, invalid coords dropped
// -----------------------------------------------------------------------------
const zones = [
  { id: 'a', provider: 'parkplus_on_street', isCurrentlyFree: false, activeRate: 3.5, coordinates: [-114.07, 51.04] },
  { id: 'b', provider: 'indigo', isCurrentlyFree: true, activeRate: 0, coordinates: [-114.08, 51.05] },
  { id: 'c', provider: 'indigo', isCurrentlyFree: false, activeRate: NaN, coordinates: [NaN, 51.05] },
];
const anchors = new Map([['a', [-114.0711, 51.0411]]]);
const features = clusters.buildPinFeatures(zones, anchors);
assert.strictEqual(features.length, 2, 'Zones without finite coordinates must be skipped');
assert.deepStrictEqual(features[0].geometry.coordinates, [-114.0711, 51.0411], 'Pin feature must use anchor coordinate');
assert.deepStrictEqual(features[1].geometry.coordinates, [-114.08, 51.05], 'Pin feature falls back to zone coordinate');
assert.deepStrictEqual(features[0].properties, { id: 'a', provider: 'parkplus_on_street', free: 0, rate: 3.5 });
assert.strictEqual(features[1].properties.free, 1);
console.log('  ✓ Pin features anchored and sanitized');

// -----------------------------------------------------------------------------
// 3. clusterProperties are valid MapLibre expressions and aggregate correctly
// -----------------------------------------------------------------------------
const clusterProps = clusters.buildClusterProperties();
const reducers = { '+': (a, b) => a + b, min: (a, b) => Math.min(a, b), max: (a, b) => Math.max(a, b) };
const leafProps = [
  { id: '1', provider: 'parkplus_on_street', free: 0, rate: 3.5 },
  { id: '2', provider: 'parkplus_on_street', free: 0, rate: 2.25 },
  { id: '3', provider: 'indigo', free: 1, rate: 0 },
];
const aggregated = { point_count: leafProps.length };
for (const [key, [op, mapExpr]] of Object.entries(clusterProps)) {
  assert.ok(reducers[op], `Unsupported cluster reducer "${op}" for ${key}`);
  const compiled = styleSpec.createExpression(mapExpr, `sources.pins.clusterProperties.${key}`);
  assert.strictEqual(compiled.result, 'success', `clusterProperties.${key} must be a valid expression`);
  const values = leafProps.map((p) => compiled.value.evaluate({ zoom: 0 }, { type: 'Point', properties: p }));
  aggregated[key] = values.reduce(reducers[op]);
}
assert.strictEqual(aggregated.n_parkplus_on_street, 2);
assert.strictEqual(aggregated.n_indigo, 1);
assert.strictEqual(aggregated.n_impark, 0);
assert.strictEqual(aggregated.free, 1);
assert.strictEqual(aggregated.minRate, 2.25, 'minRate must ignore free zones');
console.log('  ✓ Cluster aggregation expressions evaluate correctly');

// -----------------------------------------------------------------------------
// 4. Provider-mix ring, sizing and labels
// -----------------------------------------------------------------------------
const mix = clusters.getClusterProviderMix(aggregated);
assert.deepStrictEqual(mix.map((s) => s.provider), ['parkplus_on_street', 'indigo'], 'Mix sorted by count, zero counts dropped');
const ring = clusters.buildProviderRingGradient(mix);
assert.ok(ring.startsWith('conic-gradient('), 'Mixed clusters use a conic ring');
assert.ok(ring.includes(`${PROVIDERS.parkplus_on_street.color} 0.0deg 240.0deg`), 'Slices are proportional');
assert.ok(ring.includes(`${PROVIDERS.indigo.color} 240.0deg 360.0deg`), 'Slices close the ring at 360deg');
assert.strictEqual(clusters.buildProviderRingGradient(mix.slice(0, 1)), PROVIDERS.parkplus_on_street.color, 'Single-provider ring is solid');
assert.strictEqual(clusters.buildProviderRingGradient([]), '#64748b');

let prev = 0;
for (const n of [2, 10, 100, 1000, 100000]) {
  const d = clusters.getClusterDiameter(n);
  assert.ok(d >= prev && d >= 32 && d <= 60, `Diameter for ${n} must grow monotonically within 32..60px`);
  prev = d;
}

assert.strictEqual(clusters.formatClusterCount(7), '7');
assert.strictEqual(clusters.formatClusterCount(1000), '1k');
assert.strictEqual(clusters.formatClusterCount(1250), '1.3k');
assert.strictEqual(clusters.formatClusterCount(12500), '13k');

assert.strictEqual(clusters.formatClusterRateHint(aggregated), '1 free');
assert.strictEqual(clusters.formatClusterRateHint({ point_count: 3, free: 3, minRate: 999 }), 'FREE');
assert.strictEqual(clusters.formatClusterRateHint({ point_count: 3, free: 0, minRate: 1.5 }), 'from $1.50');
assert.strictEqual(clusters.formatClusterRateHint({ point_count: 3, free: 0, minRate: 999 }), '');
console.log('  ✓ Provider ring, sizing and labels verified');

// -----------------------------------------------------------------------------
// 5. MapLibreView wiring contract
// -----------------------------------------------------------------------------
const view = fs.readFileSync(path.join(WEBAPP_ROOT, 'components/map/MapLibreView.tsx'), 'utf8');
assert.ok(/cluster:\s*true/.test(view), 'Pin source must enable clustering');
assert.ok(/clusterMaxZoom:\s*PIN_CLUSTER_MAX_ZOOM/.test(view), 'Pin source must use shared clusterMaxZoom');
assert.ok(/clusterProperties:\s*buildClusterProperties\(\)/.test(view), 'Pin source must aggregate provider/rate stats');
assert.ok(/querySourceFeatures\(PIN_SOURCE_ID\)/.test(view), 'Markers must be built only for features in loaded viewport tiles');
assert.ok(/getClusterExpansionZoom/.test(view), 'Clicking a cluster must zoom to its expansion zoom');
assert.ok(/setClusterOptions\(\{\s*cluster:\s*clusterPins/.test(view), 'Cluster toggle must switch source clustering');
const page = fs.readFileSync(path.join(WEBAPP_ROOT, 'app/app/page.tsx'), 'utf8');
assert.ok(/clusterPins=\{showCluster\}/.test(page), 'Map page Cluster checkbox must drive MapLibreView clusterPins');
assert.ok(/\.pin-cluster-marker/.test(view), 'Canvas click handler must ignore cluster marker clicks');
assert.ok(!/zones\.forEach\(\(zone\)\s*=>\s*\{[\s\S]{0,400}new Marker/.test(view), 'Must not create one DOM marker per zone up front');

const css = fs.readFileSync(path.join(WEBAPP_ROOT, 'app/globals.css'), 'utf8');
assert.ok(/\.pin-cluster\s*\{/.test(css), 'globals.css must style .pin-cluster');
assert.ok(/\.pin-cluster-marker\s*\{/.test(css), 'globals.css must style .pin-cluster-marker');
console.log('  ✓ MapLibreView clustering wiring verified');

console.log('✅ Pin clustering tests passed');
