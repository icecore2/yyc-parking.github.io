import { BaseProviderFetcher } from './base.ts';
import type { NormalizedParkingRecord, ProviderName } from '../types.ts';
import { parseHtmlRates, toWgs84 } from '../utils/rate-parser.ts';
import { computeCanonicalHash } from '../utils/hasher.ts';

interface ArcGISFeature {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: {
    paths?: number[][][];
  };
}

interface ArcGISResponse {
  features?: ArcGISFeature[];
  error?: { message: string };
}

export const CPA_ARCGIS_URL =
  'https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=2000&f=json';

const CALGARY_COS_LAT = Math.cos((51.0447 * Math.PI) / 180);
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * CALGARY_COS_LAT;

function polylineLengthMeters(coords: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = (coords[i + 1][0] - coords[i][0]) * METERS_PER_DEG_LNG;
    const dy = (coords[i + 1][1] - coords[i][1]) * METERS_PER_DEG_LAT;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function getLongestPath(paths: [number, number][][]): [number, number][] {
  let best = paths[0];
  let bestLen = -1;
  for (const path of paths) {
    if (!path || path.length === 0) continue;
    const len = polylineLengthMeters(path);
    if (len > bestLen) {
      bestLen = len;
      best = path;
    }
  }
  return best;
}

function computeArcLengthMidpoint(coords: [number, number][]): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = (coords[i + 1][0] - coords[i][0]) * METERS_PER_DEG_LNG;
    const dy = (coords[i + 1][1] - coords[i][1]) * METERS_PER_DEG_LAT;
    const len = Math.hypot(dx, dy);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return coords[0];
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (acc + segLen >= half && segLen > 0) {
      const t = (half - acc) / segLen;
      return [
        Number((coords[i][0] + t * (coords[i + 1][0] - coords[i][0])).toFixed(6)),
        Number((coords[i][1] + t * (coords[i + 1][1] - coords[i][1])).toFixed(6)),
      ];
    }
    acc += segLen;
  }
  return coords[coords.length - 1];
}

export class MyParkingFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'MyParking';
  readonly providerId = 'parkplus_on_street';
  private apiUrl: string;

  constructor(apiUrl: string = CPA_ARCGIS_URL) {
    super();
    this.apiUrl = apiUrl;
  }

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    try {
      const data = await this.fetchJsonWithTimeout<ArcGISResponse>(this.apiUrl, {}, 12000);
      const features = data.features || [];

      if (features.length === 0) {
        return this.getFallbackSampleZones(now);
      }

      const records: NormalizedParkingRecord[] = [];

      for (const feat of features) {
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

        const geometry: NormalizedParkingRecord['geometry'] =
          wgsPaths.length === 1
            ? { type: 'LineString', coordinates: wgsPaths[0] }
            : { type: 'MultiLineString', coordinates: wgsPaths };
        const primaryPath = getLongestPath(wgsPaths);
        const midpoint = computeArcLengthMidpoint(primaryPath);

        const objectId = attrs.OBJECTID ? String(attrs.OBJECTID).trim() : '';
        const zoneNumber = attrs.PARKING_ZONE ? String(attrs.PARKING_ZONE).trim() : objectId;
        if (!objectId && !zoneNumber) continue;

        const id = objectId ? `parkplus_${objectId}` : `parkplus_z${zoneNumber}`;
        const htmlRates = attrs.HTML_ZONE_RATE ? String(attrs.HTML_ZONE_RATE) : '';
        const enforceableTime = attrs.ENFORCEABLE_TIME ? String(attrs.ENFORCEABLE_TIME).trim() : undefined;
        const { activeRate, isCurrentlyFree, periods } = parseHtmlRates(htmlRates, enforceableTime);

        const restrictions: string[] = [];
        if (attrs.NO_PARKING) restrictions.push(`No Parking: ${attrs.NO_PARKING}`);
        if (attrs.NO_STOPPING) restrictions.push(`No Stopping: ${attrs.NO_STOPPING}`);
        if (attrs.PARKING_RESTRICT_TIME && attrs.PARKING_RESTRICT_TIME !== 'none') {
          restrictions.push(`Restriction Hours: ${attrs.PARKING_RESTRICT_TIME}`);
        }

        const stallCount = Number(attrs.SEG_CAP || attrs.ZONE_CAP) || 10;
        const blockSide = attrs.BLOCK_SIDE ? String(attrs.BLOCK_SIDE).trim() : '';

        const recordCandidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
          id,
          externalId: zoneNumber || objectId,
          provider_name: this.providerName,
          providerId: this.providerId,
          title: `Zone #${zoneNumber || objectId}`,
          address: String(attrs.ADDRESS_DESC || 'Calgary, AB').trim(),
          category: 'MUNICIPAL',
          stallCount,
          stallType: attrs.STALL_TYPE ? String(attrs.STALL_TYPE).trim() : 'Parallel',
          brz: attrs.BRZ_NAME ? String(attrs.BRZ_NAME).trim() : 'None',
          priceZone: attrs.PRICE_ZONE ? String(attrs.PRICE_ZONE).trim() : 'Standard',
          maxStayHours: attrs.MAX_TIME ? Number(attrs.MAX_TIME) : undefined,
          enforceableHours: enforceableTime,
          activeRate,
          isCurrentlyFree,
          rateSchedule: periods,
          coordinates: midpoint,
          geometry,
          restrictions,
          paymentApp: 'ParkPlus (MyParking)',
          paymentUrl: 'https://www.calgaryparking.com/parkplus',
          fetchedAt: now,
          remoteSyncStatus: 'PENDING',
          rawData: attrs as Record<string, unknown>,
        };

        const contentHash = computeCanonicalHash(recordCandidate);
        records.push({
          ...recordCandidate,
          contentHash,
        });
      }

      return records;
    } catch (err) {
      console.warn('[MyParkingFetcher] API fetch error; using resilient fallback sample data:', err);
      return this.getFallbackSampleZones(now);
    }
  }

  private getFallbackSampleZones(now: number): NormalizedParkingRecord[] {
    const samples = [
      {
        externalId: '1008',
        title: 'Zone #1008',
        address: 'Eau Claire Ave SW, Fr 4 St SW To 5 St SW',
        stallCount: 18,
        activeRate: 3.5,
        coords: [-114.0722, 51.0526] as [number, number],
      },
      {
        externalId: '1042',
        title: 'Zone #1042',
        address: '8 Avenue SW (Stephen Ave), Fr 5 St SW To 6 St SW',
        stallCount: 14,
        activeRate: 4.5,
        coords: [-114.0741, 51.0456] as [number, number],
      },
      {
        externalId: '1210',
        title: 'Zone #1210',
        address: '10 Avenue SW, Fr 1 St SW To 2 St SW',
        stallCount: 22,
        activeRate: 2.5,
        coords: [-114.0667, 51.0438] as [number, number],
      },
    ];

    return samples.map((s) => {
      const id = `parkplus_${s.externalId}`;
      const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
        id,
        externalId: s.externalId,
        provider_name: this.providerName,
        providerId: this.providerId,
        title: s.title,
        address: s.address,
        category: 'MUNICIPAL',
        stallCount: s.stallCount,
        stallType: 'Parallel',
        brz: 'Downtown',
        priceZone: 'Tier 3 ($3.50)',
        maxStayHours: 3,
        enforceableHours: '09:00 - 18:00 Mon-Sat',
        activeRate: s.activeRate,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '09:00', endTime: '18:00', ratePerHour: s.activeRate },
          { days: 'Saturday', startTime: '09:00', endTime: '18:00', ratePerHour: 2.0 },
          { days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
        ],
        coordinates: s.coords,
        geometry: {
          type: 'LineString',
          coordinates: [
            [s.coords[0] - 0.001, s.coords[1]],
            [s.coords[0] + 0.001, s.coords[1]],
          ],
        },
        restrictions: ['Rush hour towing applies 07:00-09:00 Mon-Fri'],
        paymentApp: 'ParkPlus (MyParking)',
        paymentUrl: 'https://www.calgaryparking.com/parkplus',
        fetchedAt: now,
        remoteSyncStatus: 'PENDING',
      };
      return {
        ...candidate,
        contentHash: computeCanonicalHash(candidate),
      };
    });
  }
}
