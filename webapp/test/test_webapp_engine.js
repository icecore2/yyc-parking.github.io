/**
 * Test Suite for Webapp Parking Engine (Rate Parser, Proximity Optimizer & Distance)
 */
const assert = require('assert');

// 1. Time range parser
function parseTimeRangeToMinutes(timeStr) {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;

  let h1 = parseInt(m[1], 10);
  const min1 = parseInt(m[2], 10);
  const p1 = m[3].toUpperCase();
  if (p1 === 'PM' && h1 !== 12) h1 += 12;
  if (p1 === 'AM' && h1 === 12) h1 = 0;

  let h2 = parseInt(m[4], 10);
  const min2 = parseInt(m[5], 10);
  const p2 = m[6].toUpperCase();
  if (p2 === 'PM' && h2 !== 12) h2 += 12;
  if (p2 === 'AM' && h2 === 12) h2 = 0;

  return {
    start: h1 * 60 + min1,
    end: h2 * 60 + min2,
  };
}

// 2. Haversine distance calculator
function calculateDistanceMeters(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 3. Proximity Cheapest Optimizer
function findCheapestSpots(destination, zones, durationHours = 2, maxRadiusMeters = 1000) {
  const results = [];
  for (const zone of zones) {
    const dist = calculateDistanceMeters(destination, zone.coordinates);
    if (dist <= maxRadiusMeters) {
      const walkingMinutes = Math.max(1, Math.round(dist / 80));
      const totalCostDollars = Number((zone.activeRate * durationHours).toFixed(2));
      results.push({
        zone,
        distanceMeters: Math.round(dist),
        walkingMinutes,
        totalCostDollars,
      });
    }
  }

  results.sort((a, b) => {
    if (a.totalCostDollars !== b.totalCostDollars) {
      return a.totalCostDollars - b.totalCostDollars;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  return results;
}

console.log('🧪 Running Webapp Engine Test Suite...');

// Test 1: Time parsing
const t1 = parseTimeRangeToMinutes('09:00 AM to 06:00 PM');
assert.strictEqual(t1.start, 540, '09:00 AM should be 540 min');
assert.strictEqual(t1.end, 1080, '06:00 PM should be 1080 min');
console.log('  ✓ Time range parser correctly parses 09:00 AM to 06:00 PM');

// Test 2: Distance calculation
// Calgary Tower [-114.0645, 51.0435] to Stephen Ave [-114.0719, 51.0447] (~520m)
const dist = calculateDistanceMeters([-114.0645, 51.0435], [-114.0719, 51.0447]);
assert(dist > 450 && dist < 600, `Distance should be ~520m, got ${dist}`);
console.log(`  ✓ Haversine distance accurate (${Math.round(dist)}m)`);

// Test 3: Optimizer ranks cheapest stall first
const mockZones = [
  { id: 'expensive', title: 'Expensive Tower', coordinates: [-114.0646, 51.0436], activeRate: 5.0 },
  { id: 'cheap_stall', title: 'Cheap Street', coordinates: [-114.0660, 51.0440], activeRate: 2.0 },
  { id: 'free_stall', title: 'Free Zone', coordinates: [-114.0680, 51.0445], activeRate: 0.0 },
];
const optResults = findCheapestSpots([-114.0645, 51.0435], mockZones, 2, 1000);
assert.strictEqual(optResults[0].zone.id, 'free_stall', 'Free stall should rank #1');
assert.strictEqual(optResults[1].zone.id, 'cheap_stall', 'Cheap stall should rank #2');
assert.strictEqual(optResults[2].zone.id, 'expensive', 'Expensive stall should rank #3');
console.log('  ✓ Cheapest Spot Optimizer correctly ranks spots by lowest total cost');

console.log('🎉 All Webapp Engine tests passed successfully!');
