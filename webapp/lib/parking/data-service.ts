import { ParkingZone, ParkingZoneGeometry } from './types';
import { parseRateSchedule } from './rate-parser';
import { applyLiveRate } from './rate-schedule';
import { getCalgaryTime, type CalgaryTime } from './calgary-clock';
import { getPrimaryPath, pointAlongPolyline } from './geometry';

interface ArcGISFeature {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: {
    paths?: number[][][];
  };
}

export const ARCGIS_URL =
  'https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=2000&f=json';

export const DEFAULT_ARCGIS_URL = ARCGIS_URL;

const FACTOR = 180 / 20037508.342789244;
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const PI_OVER_2 = Math.PI / 2;

function toWgs84(x: number, y: number): [number, number] {
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    const lng = x * FACTOR;
    const lat = RAD2DEG * (2 * Math.atan(Math.exp(y * FACTOR * DEG2RAD)) - PI_OVER_2);
    return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
  }
  return [Number(x.toFixed(6)), Number(y.toFixed(6))];
}

// Representative sample zones for Calgary Core (Stephen Ave, Eau Claire, Beltline, 17th Ave, Kensington)
export const SAMPLE_CALGARY_ZONES: ParkingZone[] = [
  {
    id: '1008',
    zoneNumber: '1008',
    title: 'Zone #1008',
    address: 'Eau Claire Ave SW, Fr 4 St SW To 5 St SW',
    blockSide: 'North',
    stallCount: 18,
    stallType: 'Parallel',
    brz: 'Downtown',
    priceZone: 'Tier 3 ($3.50)',
    maxStayHours: 3,
    enforceableHours: '09:00 - 18:00 Mon-Sat',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 3.5 },
      { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 2.0 },
      { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 3.5,
    isCurrentlyFree: false,
    coordinates: [-114.0722, 51.0526],
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.071, 51.0526],
        [-114.0734, 51.0526],
      ],
    },
    provider: 'parkplus_on_street',
    restrictions: ['No Parking 07:00-09:00 AM Mon-Fri (Rush Hour Tow Zone)'],
  },
  {
    id: '1042',
    zoneNumber: '1042',
    title: 'Zone #1042',
    address: '8 Avenue SW (Stephen Ave), Fr 5 St SW To 6 St SW',
    blockSide: 'South',
    stallCount: 14,
    stallType: 'Parallel',
    brz: 'Downtown',
    priceZone: 'Tier 4 ($4.50)',
    maxStayHours: 2,
    enforceableHours: '09:00 - 18:00 Mon-Sat',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 4.5 },
      { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 2.5 },
      { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 4.5,
    isCurrentlyFree: false,
    coordinates: [-114.0741, 51.0456],
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.0728, 51.0456],
        [-114.0754, 51.0456],
      ],
    },
    provider: 'parkplus_on_street',
    restrictions: ['Pedestrian Mall Active: Vehicle restrictions apply after 6 PM on summer weekends'],
  },
  {
    id: '1210',
    zoneNumber: '1210',
    title: 'Zone #1210',
    address: '10 Avenue SW, Fr 1 St SW To 2 St SW',
    blockSide: 'North',
    stallCount: 22,
    stallType: 'Parallel',
    brz: 'Beltline',
    priceZone: 'Tier 2 ($2.50)',
    maxStayHours: 3,
    enforceableHours: '09:00 - 18:00 Mon-Sat',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 2.5 },
      { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 1.5 },
      { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 2.5,
    isCurrentlyFree: false,
    coordinates: [-114.0667, 51.0438],
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.0652, 51.0438],
        [-114.0682, 51.0438],
      ],
    },
    provider: 'parkplus_on_street',
    restrictions: ['No Stopping 15:30-18:00 Mon-Fri (Eastbound Rush Hour)'],
  },
  {
    id: '1330',
    zoneNumber: '1330',
    title: 'Zone #1330',
    address: '17 Avenue SW, Fr 4 St SW To 5 St SW',
    blockSide: 'South',
    stallCount: 16,
    stallType: 'Angle',
    brz: '17th Ave',
    priceZone: 'Tier 3 ($3.00)',
    maxStayHours: 2,
    enforceableHours: '09:00 - 20:00 Mon-Sat',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '09:00', endTime: '20:00', ratePerHour: 3.0 },
      { days: 'Saturday', startTime: '09:00', endTime: '20:00', ratePerHour: 2.5 },
      { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 3.0,
    isCurrentlyFree: false,
    coordinates: [-114.0729, 51.0379],
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.0715, 51.0379],
        [-114.0743, 51.0379],
      ],
    },
    provider: 'parkplus_on_street',
  },
  {
    id: '1505',
    zoneNumber: '1505',
    title: 'Zone #1505',
    address: 'Kensington Rd NW, Fr 10 St NW To 11 St NW',
    blockSide: 'North',
    stallCount: 20,
    stallType: 'Parallel',
    brz: 'Kensington',
    priceZone: 'Tier 2 ($2.50)',
    maxStayHours: 2,
    enforceableHours: '09:00 - 18:00 Mon-Sat',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: 2.5 },
      { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 2.0 },
      { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 2.5,
    isCurrentlyFree: false,
    coordinates: [-114.0862, 51.0531],
    geometry: {
      type: 'LineString',
      coordinates: [
        [-114.0845, 51.0531],
        [-114.0879, 51.0531],
      ],
    },
    provider: 'parkplus_on_street',
  },
  // Municipal Lots & Parkades
  {
    id: 'lot_centennial',
    title: 'Centennial Parkade (Lot 54)',
    address: '608 9 Avenue SW',
    stallCount: 960,
    stallType: 'Multi-Level Covered Parkade',
    brz: 'Downtown Core',
    priceZone: 'City Parkade ($4.00/hr)',
    enforceableHours: '24/7 Pay Parking',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 4.0 },
      { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.5 },
      { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.5 },
    ],
    activeRate: 4.0,
    isCurrentlyFree: false,
    coordinates: [-114.0757, 51.0453],
    provider: 'cpa_off_street',
  },
  {
    id: 'lot_platform',
    title: 'Platform Parkade (East Village)',
    address: '407 9 Avenue SE',
    stallCount: 500,
    stallType: 'Multi-Level Innovation Parkade',
    brz: 'East Village',
    priceZone: 'City Parkade ($3.25/hr)',
    enforceableHours: '24/7 Pay Parking',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 3.25 },
      { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.0 },
      { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.0 },
    ],
    activeRate: 3.25,
    isCurrentlyFree: false,
    coordinates: [-114.0535, 51.0448],
    provider: 'cpa_off_street',
  },
  // Calgary Transit Park & Ride
  {
    id: 'transit_chinook',
    title: 'Chinook CTrain Station Park & Ride',
    address: '309 61 Avenue SW',
    stallCount: 382,
    stallType: 'Surface Commuter Lot',
    brz: 'Transit Hub',
    priceZone: 'Free after 11am ($0.00)',
    enforceableHours: 'Reserved 02:00-11:00 AM Mon-Fri | Free 11:00 AM+ & Weekends',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '02:00', endTime: '11:00', ratePerHour: 3.0 },
      { days: 'Mon-Fri', startTime: '11:00', endTime: '23:59', ratePerHour: 0, isFree: true },
      { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
    ],
    activeRate: 0,
    isCurrentlyFree: true,
    coordinates: [-114.0703, 50.9984],
    provider: 'calgary_transit',
    restrictions: ['100% Free after 11:00 AM weekdays and all day on weekends & holidays'],
  },
  // Commercial Impark
  {
    id: 'impark_tower',
    title: 'Calgary Tower Parkade (Lot 6)',
    address: '120 10 Avenue SW',
    stallCount: 350,
    stallType: 'Multi-Storey Parkade',
    brz: 'Downtown Core',
    priceZone: 'Commercial ($5.00/hr)',
    enforceableHours: '24/7 Pay Station',
    rateSchedule: [
      { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 5.0 },
      { days: 'Evening & Weekend', startTime: '18:00', endTime: '06:00', ratePerHour: 2.0 },
    ],
    activeRate: 5.0,
    isCurrentlyFree: false,
    coordinates: [-114.0645, 51.0435],
    provider: 'impark',
  },
];

export const CACHE_KEY = 'yyc_parking_zones_v3';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let inMemoryCache: { zones: ParkingZone[]; timestamp: number } | null = null;

function getCachedZones(): ParkingZone[] | null {
  const now = Date.now();
  if (inMemoryCache && now - inMemoryCache.timestamp < CACHE_TTL_MS) {
    return inMemoryCache.zones;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.zones && now - parsed.timestamp < CACHE_TTL_MS) {
          inMemoryCache = parsed;
          return parsed.zones;
        }
      }
    } catch {
      // Ignore sessionStorage exceptions
    }
  }
  return null;
}

function setCachedZones(zones: ParkingZone[]) {
  const record = { zones, timestamp: Date.now() };
  inMemoryCache = record;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(record));
    } catch {
      // Ignore quota exceeded
    }
  }
}

export function getLastDataFetchTime(): number {
  if (inMemoryCache) return inMemoryCache.timestamp;
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.timestamp) return parsed.timestamp;
      }
    } catch {
      // Ignore
    }
  }
  return Date.now();
}

/**
 * Returns copies of the zones with activeRate/isCurrentlyFree resolved from each zone's
 * rateSchedule at Calgary time t, and peakRate set to the schedule's highest paid rate.
 * Zones without a schedule keep their stored rate, which also becomes their peakRate.
 */
export function withLiveRates(zones: ParkingZone[], t: CalgaryTime): ParkingZone[] {
  return zones.map((zone) => applyLiveRate(zone, t));
}

export async function fetchCalgaryParkingZones(forceRefresh = false): Promise<ParkingZone[]> {
  if (forceRefresh) {
    inMemoryCache = null;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(CACHE_KEY);
      } catch {
        // Ignore sessionStorage exceptions
      }
    }
  } else {
    // Check fast cache first
    const cached = getCachedZones();
    if (cached && cached.length > 0) {
      return withLiveRates(cached, getCalgaryTime());
    }
  }

  // 1. Try fetching from remote database table ('parking_data' via /api/parking)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/parking', {
      signal: controller.signal,
      cache: forceRefresh ? 'no-store' : 'default',
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.zones && Array.isArray(json.zones) && json.zones.length > 0) {
        setCachedZones(json.zones);
        return withLiveRates(json.zones, getCalgaryTime());
      }
    }
  } catch (err) {
    console.warn('[data-service] Remote database table fetch timed out or unavailable; falling back to direct provider:', err);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(ARCGIS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`ArcGIS returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const features: ArcGISFeature[] = data.features || [];

    if (features.length === 0) {
      setCachedZones(SAMPLE_CALGARY_ZONES);
      return withLiveRates(SAMPLE_CALGARY_ZONES, getCalgaryTime());
    }

    const liveZones: ParkingZone[] = [];

    for (let i = 0; i < features.length; i++) {
      const feat = features[i];
      const attrs = feat.attributes || {};
      const geom = feat.geometry || {};

      const status = String(attrs.STATUS || 'Active').trim().toLowerCase();
      if (status === 'removed' || status === 'inactive') continue;

      const paths = geom.paths;
      if (!paths || paths.length === 0) continue;

      const wgsPaths: [number, number][][] = paths
        .filter((p) => Array.isArray(p) && p.length > 0)
        .map((p) => p.map((pt) => toWgs84(pt[0], pt[1])));
      if (wgsPaths.length === 0) continue;

      const geometry: ParkingZoneGeometry =
        wgsPaths.length === 1
          ? { type: 'LineString', coordinates: wgsPaths[0] }
          : { type: 'MultiLineString', coordinates: wgsPaths };

      const primaryPath = getPrimaryPath(geometry) || wgsPaths[0];
      const midpoint = pointAlongPolyline(primaryPath, 0.5);

      const htmlRates = attrs.HTML_ZONE_RATE ? String(attrs.HTML_ZONE_RATE) : '';
      const enforceableTime = attrs.ENFORCEABLE_TIME ? String(attrs.ENFORCEABLE_TIME).trim() : undefined;
      const { periods } = parseRateSchedule(htmlRates, enforceableTime);

      const objectId =
        attrs.OBJECTID !== undefined && attrs.OBJECTID !== null
          ? String(attrs.OBJECTID).trim()
          : '';
      const zoneNumber = attrs.PARKING_ZONE
        ? String(attrs.PARKING_ZONE).trim()
        : objectId || String(i);
      const uniqueId = objectId
        ? `parkplus_${objectId}`
        : `parkplus_${zoneNumber}_${i}`;

      const restrictions: string[] = [];
      if (attrs.NO_PARKING) restrictions.push(`No Parking: ${attrs.NO_PARKING}`);
      if (attrs.NO_STOPPING) restrictions.push(`No Stopping: ${attrs.NO_STOPPING}`);
      if (attrs.PARKING_RESTRICT_TIME && attrs.PARKING_RESTRICT_TIME !== 'none') {
        restrictions.push(`Restriction Hours: ${attrs.PARKING_RESTRICT_TIME}`);
      }

      const stallCount = Number(attrs.SEG_CAP || attrs.ZONE_CAP) || 10;

      liveZones.push({
        id: uniqueId,
        zoneNumber,
        title: `Zone #${zoneNumber}`,
        address: String(attrs.ADDRESS_DESC || 'Calgary, AB').trim(),
        blockSide: attrs.BLOCK_SIDE ? String(attrs.BLOCK_SIDE).trim() : undefined,
        stallCount,
        stallType: attrs.STALL_TYPE ? String(attrs.STALL_TYPE).trim() : 'Parallel',
        brz: attrs.BRZ_NAME ? String(attrs.BRZ_NAME).trim() : 'None',
        priceZone: attrs.PRICE_ZONE ? String(attrs.PRICE_ZONE).trim() : 'Standard',
        maxStayHours: attrs.MAX_TIME ? Number(attrs.MAX_TIME) : undefined,
        enforceableHours: enforceableTime,
        rateSchedule: periods,
        // Resolved at Calgary time by withLiveRates on every return path.
        activeRate: 0,
        isCurrentlyFree: true,
        coordinates: midpoint,
        geometry,
        provider: 'parkplus_on_street',
        restrictions,
      });
    }

    // Append our curated off-street parkades and transit lots
    const offStreetCurated = SAMPLE_CALGARY_ZONES.filter(
      (z) => z.provider !== 'parkplus_on_street'
    );

    const fullDataset = [...liveZones, ...offStreetCurated];
    setCachedZones(fullDataset);
    return withLiveRates(fullDataset, getCalgaryTime());
  } catch (err) {
    console.warn('Live Calgary ArcGIS fetch failed or timed out; using robust sample dataset.', err);
    setCachedZones(SAMPLE_CALGARY_ZONES);
    return withLiveRates(SAMPLE_CALGARY_ZONES, getCalgaryTime());
  }
}
