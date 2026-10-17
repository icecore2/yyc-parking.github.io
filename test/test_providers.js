/**
 * Test Suite for Multi-Provider Parking System & Branded Pin Generator
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const providers = require('../js/providers.js');

console.log('=== RUNNING MULTI-PROVIDER & BRANDED PIN TESTS ===\n');

// -----------------------------------------------------------------------------
// Test Suite 1: Provider Registry Integrity
// -----------------------------------------------------------------------------
console.log('--- Test Suite 1: Provider Registry Integrity ---');
const expectedProviders = [
  'parkplus_on_street',
  'cpa_off_street',
  'calgary_transit',
  'impark',
  'indigo',
  'precise_parklink'
];

expectedProviders.forEach(pId => {
  const p = providers.PROVIDERS[pId];
  assert.ok(p, `Provider ${pId} should exist in PROVIDERS registry`);
  assert.ok(p.name && p.name.length > 0, `Provider ${pId} should have a valid name`);
  assert.ok(p.shortName && p.shortName.length > 0, `Provider ${pId} should have a shortName`);
  assert.ok(p.operator && p.operator.length > 0, `Provider ${pId} should have an operator name`);
  assert.ok(p.color && p.color.startsWith('#'), `Provider ${pId} should have a valid hex color`);
  assert.ok(p.logoSvg && p.logoSvg.includes('<svg'), `Provider ${pId} should have a valid SVG logo`);
  assert.ok(p.badgeClass && p.badgeClass.length > 0, `Provider ${pId} should have badge styling`);
});
console.log('✔ All 6 providers registered with valid metadata and SVG logos');

// -----------------------------------------------------------------------------
// Test Suite 2: Provider Lookup & Badge Generation
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Provider Lookup & Badge Generation ---');
// Lookup existing
const impark = providers.getProvider('impark');
assert.strictEqual(impark.id, 'impark');
assert.strictEqual(impark.name, 'Impark (Imperial Parking)');

// Lookup unknown (fallback to parkplus_on_street)
const fallback = providers.getProvider('unknown_provider_xyz');
assert.strictEqual(fallback.id, 'parkplus_on_street');

// Badge generation
const badgeHtml = providers.renderProviderBadge('calgary_transit');
assert.ok(badgeHtml.includes('Calgary Transit'), 'Badge should render provider name');
assert.ok(badgeHtml.includes('<svg'), 'Badge should include SVG logo');
assert.ok(badgeHtml.includes('border-red-500'), 'Badge should include transit red color styling');

const compactBadge = providers.renderProviderBadge('indigo', { compact: true });
assert.ok(compactBadge.includes('Indigo Neo'), 'Compact badge should render shortName');
console.log('✔ Provider lookups and badge HTML generation passed');

// -----------------------------------------------------------------------------
// Test Suite 3: Curated Commercial Parking Dataset Verification
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Commercial Parking Dataset ---');
const commercialFilePath = path.join(__dirname, '../data/commercial_parking.json');
assert.ok(fs.existsSync(commercialFilePath), 'data/commercial_parking.json must exist');

const commercialData = JSON.parse(fs.readFileSync(commercialFilePath, 'utf8'));
assert.ok(Array.isArray(commercialData), 'commercial_parking.json must be an array');
assert.ok(commercialData.length >= 10, 'Must contain at least 10 major commercial parking facilities');

commercialData.forEach(facility => {
  assert.ok(facility.id, 'Facility must have an id');
  assert.ok(['impark', 'indigo', 'precise_parklink'].includes(facility.providerId), `Valid providerId: ${facility.providerId}`);
  assert.ok(facility.name, `Facility ${facility.id} must have a name`);
  assert.ok(facility.address && facility.address.includes('Calgary'), `Facility ${facility.id} address must specify Calgary`);
  assert.ok(Array.isArray(facility.coordinates) && facility.coordinates.length === 2, `Facility ${facility.id} must have [lng, lat] coordinates`);

  const [lng, lat] = facility.coordinates;
  assert.ok(lat >= 50.8 && lat <= 51.3, `Latitude ${lat} must be within Calgary bounds`);
  assert.ok(lng >= -114.4 && lng <= -113.8, `Longitude ${lng} must be within Calgary bounds`);

  assert.ok(facility.paymentApp, `Facility ${facility.id} must have a paymentApp name`);
  assert.ok(facility.paymentUrl && facility.paymentUrl.startsWith('http'), `Facility ${facility.id} must have a valid paymentUrl`);
});
console.log(`✔ Verified ${commercialData.length} commercial facilities across Impark, Indigo, and Precise ParkLink`);

// -----------------------------------------------------------------------------
// Test Suite 4: Calgary Transit Park & Ride Station Inventory
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Transit Park & Ride Inventory ---');
const stations = providers.TRANSIT_PARK_AND_RIDE_STATIONS;
assert.ok(Array.isArray(stations), 'TRANSIT_PARK_AND_RIDE_STATIONS must be an array');
assert.ok(stations.length >= 20, 'Should cover at least 20 CTrain stations with Park & Ride');

let totalCommuterStalls = 0;
stations.forEach(stn => {
  assert.ok(stn.name, 'Station must have a name');
  assert.ok(stn.stalls > 0, `Station ${stn.name} must have positive stall count`);
  totalCommuterStalls += stn.stalls;

  assert.ok(stn.lat >= 50.8 && stn.lat <= 51.3, `Station ${stn.name} lat must be in Calgary`);
  assert.ok(stn.lng >= -114.4 && stn.lng <= -113.8, `Station ${stn.name} lng must be in Calgary`);
  assert.ok(stn.leg, `Station ${stn.name} must have a transit leg`);
});
console.log(`✔ Verified ${stations.length} CTrain Park & Ride stations representing ${totalCommuterStalls.toLocaleString()} commuter stalls`);

// -----------------------------------------------------------------------------
// Test Suite 5: Geometric Calculations (Polygon Centroid)
// -----------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Geometric Calculations ---');
function getPolygonCentroid(latLngs) {
  if (!latLngs || latLngs.length === 0) return [51.0447, -114.0719];
  let sumLat = 0;
  let sumLng = 0;
  latLngs.forEach(pt => {
    sumLat += pt[0];
    sumLng += pt[1];
  });
  return [sumLat / latLngs.length, sumLng / latLngs.length];
}

const squarePolygon = [
  [51.0400, -114.0600],
  [51.0500, -114.0600],
  [51.0500, -114.0700],
  [51.0400, -114.0700]
];
const center = getPolygonCentroid(squarePolygon);
assert.strictEqual(+center[0].toFixed(4), 51.0450);
assert.strictEqual(+center[1].toFixed(4), -114.0650);
console.log('✔ Polygon centroid calculation verified');

console.log('\n======================================================');
console.log('✔ ALL MULTI-PROVIDER & BRANDED PIN TESTS PASSED CLEANLY!');
console.log('======================================================\n');
