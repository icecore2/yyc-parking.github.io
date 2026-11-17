import { BaseProviderFetcher } from './base.ts';
import type { NormalizedParkingRecord, ProviderName } from '../types.ts';
import { computeCanonicalHash } from '../utils/hasher.ts';

interface SocrataParkadeItem {
  facility_id?: string;
  facility_name?: string;
  address?: string;
  stall_count?: string | number;
  facility_type?: string;
  point?: {
    coordinates?: [number, number];
  };
  rate_details?: string;
}

export class ParkadeFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'Parkade';
  readonly providerId = 'cpa_off_street';
  private socrataUrl: string;

  constructor(socrataUrl = 'https://data.calgary.ca/resource/ggxk-g2u3.json?$limit=500') {
    super();
    this.socrataUrl = socrataUrl;
  }

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    const curatedParkades = this.getCuratedParkades(now);

    try {
      const items = await this.fetchJsonWithTimeout<SocrataParkadeItem[]>(
        this.socrataUrl,
        {},
        10000
      );

      const dynamicParkades: NormalizedParkingRecord[] = [];

      for (const item of items) {
        if (!item.facility_name) continue;
        const rawId = item.facility_id || item.facility_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const id = `parkade_${rawId}`;

        // Don't overwrite curated high-detail parkades if IDs overlap
        if (curatedParkades.some((c) => c.id === id || c.externalId === rawId)) {
          continue;
        }

        const coords: [number, number] =
          item.point && Array.isArray(item.point.coordinates) && item.point.coordinates.length >= 2
            ? [Number(item.point.coordinates[0]), Number(item.point.coordinates[1])]
            : [-114.0719, 51.0447];

        const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
          id,
          externalId: rawId,
          provider_name: this.providerName,
          providerId: this.providerId,
          title: item.facility_name,
          address: item.address || 'Calgary, AB',
          category: 'MUNICIPAL',
          stallCount: Number(item.stall_count) || 150,
          stallType: item.facility_type || 'Parkade Structure',
          brz: 'Downtown Core',
          priceZone: 'City Parkade ($3.75/hr)',
          enforceableHours: '24/7 Pay Parking',
          activeRate: 3.75,
          isCurrentlyFree: false,
          rateSchedule: [
            { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 3.75 },
            { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.5 },
            { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.5 },
          ],
          coordinates: coords,
          restrictions: ['Automated Pay Station & ParkPlus accepted'],
          paymentApp: 'ParkPlus / Onsite Pay',
          paymentUrl: 'https://www.calgaryparking.com/find-parking/lots.html',
          fetchedAt: now,
          remoteSyncStatus: 'PENDING',
          rawData: item as unknown as Record<string, unknown>,
        };

        dynamicParkades.push({
          ...candidate,
          contentHash: computeCanonicalHash(candidate),
        });
      }

      return [...curatedParkades, ...dynamicParkades];
    } catch (err) {
      console.warn('[ParkadeFetcher] Socrata open data fetch error; using curated municipal parkades:', err);
      return curatedParkades;
    }
  }

  private getCuratedParkades(now: number): NormalizedParkingRecord[] {
    const list: Array<Omit<NormalizedParkingRecord, 'contentHash'>> = [
      {
        id: 'parkade_lot_54',
        externalId: '54',
        provider_name: this.providerName,
        providerId: this.providerId,
        title: 'Centennial Parkade (Lot 54)',
        address: '608 9 Avenue SW, Calgary, AB',
        category: 'MUNICIPAL',
        stallCount: 960,
        stallType: 'Multi-Level Covered Parkade',
        brz: 'Downtown Core',
        priceZone: 'City Parkade ($4.00/hr)',
        enforceableHours: '24/7 Pay Parking',
        activeRate: 4.0,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 4.0 },
          { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.5 },
          { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.5 },
        ],
        coordinates: [-114.0757, 51.0453],
        restrictions: ['Heated underground, Plus 15 Connected'],
        paymentApp: 'ParkPlus / Onsite Pay',
        paymentUrl: 'https://www.calgaryparking.com/find-parking/lots.html',
        fetchedAt: now,
        remoteSyncStatus: 'PENDING',
      },
      {
        id: 'parkade_platform',
        externalId: 'platform',
        provider_name: this.providerName,
        providerId: this.providerId,
        title: 'Platform Parkade (East Village)',
        address: '407 9 Avenue SE, Calgary, AB',
        category: 'MUNICIPAL',
        stallCount: 500,
        stallType: 'Multi-Level Innovation Parkade',
        brz: 'East Village',
        priceZone: 'City Parkade ($3.25/hr)',
        enforceableHours: '24/7 Pay Parking',
        activeRate: 3.25,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 3.25 },
          { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.0 },
          { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.0 },
        ],
        coordinates: [-114.0535, 51.0448],
        restrictions: ['EV Charging on Level 2 & Rooftop Event Space'],
        paymentApp: 'ParkPlus / Onsite Pay',
        paymentUrl: 'https://www.calgaryparking.com/find-parking/lots.html',
        fetchedAt: now,
        remoteSyncStatus: 'PENDING',
      },
      {
        id: 'parkade_mcdougall',
        externalId: '28',
        provider_name: this.providerName,
        providerId: this.providerId,
        title: 'McDougall Parkade (Lot 28)',
        address: '722 5 Avenue SW, Calgary, AB',
        category: 'MUNICIPAL',
        stallCount: 650,
        stallType: 'Multi-Level Parkade',
        brz: 'Downtown West',
        priceZone: 'City Parkade ($3.50/hr)',
        enforceableHours: '24/7 Pay Parking',
        activeRate: 3.5,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: 3.5 },
          { days: 'Evening', startTime: '18:00', endTime: '06:00', ratePerHour: 1.25 },
          { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 1.25 },
        ],
        coordinates: [-114.0782, 51.0494],
        restrictions: ['Direct Plus 15 pedestrian network link'],
        paymentApp: 'ParkPlus / Onsite Pay',
        paymentUrl: 'https://www.calgaryparking.com/find-parking/lots.html',
        fetchedAt: now,
        remoteSyncStatus: 'PENDING',
      },
    ];

    return list.map((item) => ({
      ...item,
      contentHash: computeCanonicalHash(item),
    }));
  }
}
