import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseProviderFetcher } from './base.ts';
import type { NormalizedParkingRecord, ProviderName } from '../types.ts';
import { computeCanonicalHash } from '../utils/hasher.ts';

export class TransitFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'Calgary Transit';
  readonly providerId = 'calgary_transit';

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    const stations = [
      { name: 'Chinook Station', stalls: 382, coords: [-114.0703, 50.9984] as [number, number] },
      { name: 'Brentwood Station', stalls: 947, coords: [-114.1311, 51.0874] as [number, number] },
      { name: 'Anderson Station', stalls: 1726, coords: [-114.0689, 50.9572] as [number, number] },
      { name: 'Crowfoot Station', stalls: 1345, coords: [-114.2085, 51.1272] as [number, number] },
      { name: 'Somerset-Bridlewood Station', stalls: 980, coords: [-114.0683, 50.8994] as [number, number] },
      { name: 'Whitehorn Station', stalls: 846, coords: [-113.9844, 51.0858] as [number, number] },
      { name: 'Marlborough Station', stalls: 485, coords: [-113.9822, 51.0583] as [number, number] },
      { name: 'Heritage Station', stalls: 550, coords: [-114.0718, 50.9785] as [number, number] },
      { name: 'Lions Park Station', stalls: 215, coords: [-114.1039, 51.0655] as [number, number] },
      { name: 'Dalhousie Station', stalls: 740, coords: [-114.1604, 51.1034] as [number, number] },
      { name: '69 Street SW Station', stalls: 820, coords: [-114.1889, 51.0381] as [number, number] },
      { name: 'McKnight-Westwinds Station', stalls: 950, coords: [-113.9789, 51.0994] as [number, number] },
    ];

    return stations.map((stn) => {
      const slug = stn.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
        id: `transit_${slug}`,
        externalId: slug,
        provider_name: this.providerName,
        providerId: this.providerId,
        title: `${stn.name} (Park & Ride)`,
        address: `${stn.name}, Calgary Transit CTrain Network`,
        category: 'TRANSIT',
        stallCount: stn.stalls,
        stallType: 'Surface Commuter Lot',
        brz: 'Transit Hub',
        priceZone: 'Free after 11am ($0.00)',
        enforceableHours: 'Reserved 02:00-11:00 AM Mon-Fri | Free 11:00 AM+ & Weekends',
        activeRate: 0,
        isCurrentlyFree: true,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '02:00', endTime: '11:00', ratePerHour: 3.0 },
          { days: 'Mon-Fri', startTime: '11:00', endTime: '23:59', ratePerHour: 0, isFree: true },
          { days: 'Weekend', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true },
        ],
        coordinates: stn.coords,
        restrictions: [
          '100% Free after 11:00 AM weekdays and all day on weekends & statutory holidays',
        ],
        paymentApp: 'Calgary Transit / My Fare',
        paymentUrl: 'https://www.calgarytransit.com/park-and-ride/',
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

export class IndigoFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'Indigo Neo';
  readonly providerId = 'indigo';

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    const lots = [
      {
        id: 'indigo_core',
        externalId: 'the-core',
        title: 'The CORE Shopping Centre Parkade',
        address: '751 3 Street SW, Calgary, AB T2P 4K8',
        stallCount: 850,
        rate: 6.0,
        coords: [-114.0688, 51.0458] as [number, number],
      },
      {
        id: 'indigo_the_bow',
        externalId: 'the-bow',
        title: 'The Bow Tower Parkade',
        address: '500 Centre Street SE, Calgary, AB T2G 1A6',
        stallCount: 1300,
        rate: 6.5,
        coords: [-114.0617, 51.0478] as [number, number],
      },
      {
        id: 'indigo_gulf_canada',
        externalId: 'gulf-canada-sq',
        title: 'Gulf Canada Square Parkade',
        address: '401 9 Avenue SW, Calgary, AB T2P 3C5',
        stallCount: 600,
        rate: 5.5,
        coords: [-114.0711, 51.0449] as [number, number],
      },
    ];

    return lots.map((lot) => {
      const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
        id: lot.id,
        externalId: lot.externalId,
        provider_name: this.providerName,
        providerId: this.providerId,
        title: lot.title,
        address: lot.address,
        category: 'COMMERCIAL',
        stallCount: lot.stallCount,
        stallType: 'Underground Heated Parkade',
        brz: 'Downtown Core',
        priceZone: `Commercial ($${lot.rate.toFixed(2)}/hr)`,
        enforceableHours: '24/7 Pay Station',
        activeRate: lot.rate,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: lot.rate },
          { days: 'Evening & Weekend', startTime: '18:00', endTime: '06:00', ratePerHour: 3.0 },
        ],
        coordinates: lot.coords,
        restrictions: ['Heated, Plus 15 Skywalk Connected, EV Charging'],
        paymentApp: 'Indigo Neo',
        paymentUrl: 'https://indigoneo.ca',
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

export class PreciseParkLinkFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'Precise ParkLink';
  readonly providerId = 'precise_parklink';

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    const lots = [
      {
        id: 'precise_sait_core',
        externalId: 'sait-lot-p1',
        title: 'SAIT Campus Centre Parkade (Lot P1)',
        address: '1301 16 Avenue NW, Calgary, AB T2M 0L4',
        stallCount: 620,
        rate: 4.0,
        coords: [-114.0888, 51.0645] as [number, number],
      },
      {
        id: 'precise_foothills',
        externalId: 'foothills-lot-8',
        title: 'Foothills Health Centre Parkade (Lot 8)',
        address: '3330 Hospital Drive NW, Calgary, AB T2N 4N1',
        stallCount: 750,
        rate: 4.25,
        coords: [-114.1352, 51.0658] as [number, number],
      },
    ];

    return lots.map((lot) => {
      const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
        id: lot.id,
        externalId: lot.externalId,
        provider_name: this.providerName,
        providerId: this.providerId,
        title: lot.title,
        address: lot.address,
        category: 'COMMERCIAL',
        stallCount: lot.stallCount,
        stallType: 'Campus / Institutional Parkade',
        brz: 'Institutional Hub',
        priceZone: `Commercial ($${lot.rate.toFixed(2)}/hr)`,
        enforceableHours: '24/7 Pay Station',
        activeRate: lot.rate,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Daily', startTime: '06:00', endTime: '22:00', ratePerHour: lot.rate },
          { days: 'Night', startTime: '22:00', endTime: '06:00', ratePerHour: 2.0 },
        ],
        coordinates: lot.coords,
        restrictions: ['Parkedin App / Contactless Pay'],
        paymentApp: 'Parkedin',
        paymentUrl: 'https://parkedin.com',
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
