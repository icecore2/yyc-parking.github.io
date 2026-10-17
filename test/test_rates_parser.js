/**
 * Test Suite for Calgary Parking Rate Parser & Profile Generator
 */
const assert = require('assert');

// 1. Time range parser (from js/app.js)
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
    end: h2 * 60 + min2
  };
}

// 2. Schedule parser (from js/app.js)
function parseZoneRateSchedule(htmlRates) {
  const defaultRes = {
    currentRate: 0,
    isCurrentlyFree: true,
    isNoParking: false,
    minRate: 0,
    maxRate: 0,
    intervals: []
  };

  if (!htmlRates || !htmlRates.trim()) {
    return defaultRes;
  }

  const clean = htmlRates
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '')
    .trim();

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const intervals = [];
  const prices = [];
  let hasFreeRule = false;

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i];
    const rateText = lines[i + 1] || '';

    const priceMatch = rateText.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
    const isFree = /free/i.test(rateText) || /free/i.test(header);
    const isNoParking = /no parking/i.test(rateText) || /no parking/i.test(header);

    let price = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      prices.push(price);
    } else if (isFree) {
      price = 0;
      hasFreeRule = true;
    }

    let appliesDays = 'all';
    const hLower = header.toLowerCase();
    if (hLower.includes('mon-fri') || hLower.includes('mon to fri')) {
      appliesDays = 'weekday';
    } else if (hLower.includes('saturday')) {
      appliesDays = 'saturday';
    } else if (hLower.includes('sunday') || hLower.includes('holiday')) {
      appliesDays = 'sunday';
    }

    const timeRange = parseTimeRangeToMinutes(header);

    intervals.push({
      header,
      rateText,
      price,
      isFree,
      isNoParking,
      appliesDays,
      timeRange
    });
  }

  const minRate = prices.length > 0 ? Math.min(...prices) : 0;
  const maxRate = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    minRate,
    maxRate,
    intervals
  };
}

// 3. 24-Hour Profile Builder (from js/app.js)
function generate24HourProfile(rateInfo, dayType = 'weekday') {
  const profile = [];
  const intervals = (rateInfo && rateInfo.intervals) ? rateInfo.intervals : [];

  for (let hour = 0; hour < 24; hour++) {
    const currentMin = hour * 60 + 30; // Mid-hour checkpoint
    let rate = 0;
    let isRestricted = false;
    let label = 'Free Parking (Off-Peak)';

    if (dayType === 'sunday') {
      rate = 0;
      label = 'Free Parking';
    } else {
      let match = null;
      for (const inv of intervals) {
        let dayMatch = false;
        if (inv.appliesDays === 'weekday' && dayType === 'weekday') dayMatch = true;
        else if (inv.appliesDays === 'saturday' && dayType === 'saturday') dayMatch = true;
        else if (inv.appliesDays === 'all') dayMatch = true;

        if (dayMatch && inv.timeRange) {
          if (currentMin >= inv.timeRange.start && currentMin < inv.timeRange.end) {
            match = inv;
            break;
          }
        }
      }

      if (match) {
        if (match.isNoParking) {
          rate = null;
          isRestricted = true;
          label = 'No Parking (Restriction)';
        } else {
          rate = match.price !== null ? match.price : 0;
          label = rate === 0 ? 'Free Parking' : `$${rate.toFixed(2)}/hr`;
        }
      } else {
        rate = 0;
        label = 'Free Parking (Off-Peak)';
      }
    }

    const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
    const meridian = hour >= 12 ? 'PM' : 'AM';
    profile.push({
      hour,
      hourLabel: `${hourDisplay} ${meridian}`,
      rate,
      isRestricted,
      label
    });
  }

  return profile;
}

// 4. Historical Data Model (from js/app.js)
function getZoneHistoricalData(zone, localSnapshots = []) {
  const priceTier = String(zone.priceZone || '4').toLowerCase().replace(/[^0-9]/g, '') || '4';
  const tierNum = parseInt(priceTier, 10) || 4;
  const currentMax = (zone.rateInfo && zone.rateInfo.maxRate > 0) 
    ? zone.rateInfo.maxRate 
    : (tierNum >= 7 ? 4.50 : tierNum >= 4 ? 3.75 : 2.50);

  const baseline = [
    { period: '2023 Q1', rate: Math.max(1.0, +(currentMax - 0.75).toFixed(2)), note: 'Pandemic Recovery Pricing' },
    { period: '2023 Q3', rate: Math.max(1.0, +(currentMax - 0.50).toFixed(2)), note: 'Occupancy Review' },
    { period: '2024 Q1', rate: Math.max(1.0, +(currentMax - 0.50).toFixed(2)), note: 'Annual Rate Revision' },
    { period: '2024 Q3', rate: Math.max(1.0, +(currentMax - 0.25).toFixed(2)), note: 'Demand Balancing Tier Adjustment' },
    { period: '2025 Q1', rate: Math.max(1.0, +(currentMax - 0.25).toFixed(2)), note: 'Semi-Annual Policy Update' },
    { period: '2025 Q3', rate: currentMax, note: 'Core District Optimization' },
    { period: '2026 Q1', rate: currentMax, note: 'Current Active Schedule' }
  ];

  const formattedSnapshots = (localSnapshots || []).map(snap => ({
    period: snap.dateStr,
    rate: snap.peak,
    note: 'Local Sync Snapshot'
  }));

  const initialRate = baseline[0].rate;
  const netChange = +(currentMax - initialRate).toFixed(2);
  const percentChange = initialRate > 0 ? ((netChange / initialRate) * 100).toFixed(1) : '0';

  return {
    tier: zone.priceZone,
    currentPeak: currentMax,
    initialPeak: initialRate,
    netChange,
    percentChange,
    baselinePoints: baseline,
    localSnapshots: formattedSnapshots,
    combinedPoints: [...baseline, ...formattedSnapshots]
  };
}

// RUN TESTS
console.log('=== RUNNING COMPREHENSIVE RATE & HISTORY TESTS ===');

// Test 1: Time range parsing
const tr1 = parseTimeRangeToMinutes('Mon-Fri 9:00 AM to 11:00 AM');
assert.deepStrictEqual(tr1, { start: 540, end: 660 }, '9 AM to 11 AM should be 540 to 660 mins');

const tr2 = parseTimeRangeToMinutes('Mon-Fri 1:30 PM to 3:30 PM');
assert.deepStrictEqual(tr2, { start: 810, end: 930 }, '1:30 PM to 3:30 PM should be 810 to 930 mins');

// Test 2: Standard Calgary Parking schedule parsing
const sampleSchedule = `<b>Mon-Fri 9:00 AM to 11:00 AM</b><br><br>$4.00 per Hour<br><br><b>Mon-Fri 11:00 AM to 1:30 PM</b><br><br>$4.25 per Hour<br><br><b>Mon-Fri 1:30 PM to 3:30 PM</b><br><br>$3.25 per Hour<br><br><b>Mon-Fri 3:30 PM to 6:00 PM</b><br><br>$2.25 per Hour<br><br><b>Saturday: 9:00 AM to 6:00 PM</b><br><br>$1.00 per Hour<br><br><b>Sunday/Holidays:</b><br><br>Free parking<br><br>`;

const rateInfo = parseZoneRateSchedule(sampleSchedule);
assert.strictEqual(rateInfo.maxRate, 4.25, 'Max rate should be 4.25');
assert.strictEqual(rateInfo.intervals.length, 6, 'Should extract 6 intervals');

// Test 3: 24-hour Profile generation
const profileWk = generate24HourProfile(rateInfo, 'weekday');
assert.strictEqual(profileWk.length, 24, 'Profile must have 24 hourly buckets');
assert.strictEqual(profileWk[0].rate, 0, 'Midnight should be free');
assert.strictEqual(profileWk[8].rate, 0, '8:30 AM should be free before 9 AM');
assert.strictEqual(profileWk[10].rate, 4.0, '10:30 AM should be $4.00/hr');
assert.strictEqual(profileWk[12].rate, 4.25, '12:30 PM should be $4.25/hr');
assert.strictEqual(profileWk[14].rate, 3.25, '2:30 PM should be $3.25/hr');
assert.strictEqual(profileWk[16].rate, 2.25, '4:30 PM should be $2.25/hr');
assert.strictEqual(profileWk[19].rate, 0, '7:30 PM should be free after 6 PM');

const profileSat = generate24HourProfile(rateInfo, 'saturday');
assert.strictEqual(profileSat[12].rate, 1.0, 'Saturday 12:30 PM should be $1.00/hr');
assert.strictEqual(profileSat[7].rate, 0, 'Saturday 7:30 AM should be free');
assert.strictEqual(profileSat[20].rate, 0, 'Saturday 8:30 PM should be free');

const profileSun = generate24HourProfile(rateInfo, 'sunday');
for (let h = 0; h < 24; h++) {
  assert.strictEqual(profileSun[h].rate, 0, `Sunday at hour ${h} must be free`);
}

// Test 4: Rush hour restriction parsing
const rushHourHtml = `<b>Mon-Fri 9:00 AM to 11:00 AM</b><br><br>$4.00 per Hour<br><br><b>Mon-Fri 11:00 AM to 1:30 PM</b><br><br>$4.25 per Hour<br><br><b>Mon-Fri 1:30 PM to 3:30 PM</b><br><br>$3.25 per Hour<br><br><b>Mon-Fri 3:30 PM to 6:00 PM</b><br><br>No Parking at this time<br><br>`;
const rushRateInfo = parseZoneRateSchedule(rushHourHtml);
const rushProfile = generate24HourProfile(rushRateInfo, 'weekday');
assert.strictEqual(rushProfile[16].rate, null, '4:30 PM should be restricted (rate null)');
assert.strictEqual(rushProfile[16].isRestricted, true, 'isRestricted should be true');

// Test 5: Historical trend modeling and snapshots
const dummyZone = {
  zoneNumber: '1008',
  priceZone: '5',
  rateInfo: { maxRate: 4.25 }
};
const dummySnapshots = [
  { dateStr: 'Oct 16, 07:45 PM', peak: 4.25 }
];
const hist = getZoneHistoricalData(dummyZone, dummySnapshots);
assert.strictEqual(hist.baselinePoints.length, 7, 'Baseline must contain 7 periods');
assert.strictEqual(hist.combinedPoints.length, 8, 'Combined points must be 7 baseline + 1 snapshot');
assert.strictEqual(hist.currentPeak, 4.25);
assert.strictEqual(hist.initialPeak, 3.50);
assert.strictEqual(hist.netChange, 0.75);
assert.strictEqual(hist.percentChange, '21.4');

console.log('✔ All 5 test suites passed cleanly with 0 errors!');
