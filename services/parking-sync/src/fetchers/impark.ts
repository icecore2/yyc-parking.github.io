import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BaseProviderFetcher } from './base.ts';
import type { NormalizedParkingRecord, ProviderName } from '../types.ts';
import { computeCanonicalHash } from '../utils/hasher.ts';

interface CommercialJsonRecord {
  id: string;
  providerId: string;
  facilityType: string;
  name: string;
  lotNumber: string;
  paymentCode?: string;
  address: string;
  coordinates: [number, number];
  capacity: number;
  stallType: string;
  heightLimit?: string;
  ratesSummary: string;
  paymentApp: string;
  paymentUrl: string;
  operator: string;
  amenities?: string[];
}

export class ImparkFetcher extends BaseProviderFetcher {
  readonly providerName: ProviderName = 'Impark';
  readonly providerId = 'impark';
  private customDataFilePath?: string;

  constructor(customDataFilePath?: string) {
    super();
    this.customDataFilePath = customDataFilePath;
  }

  async fetchRecords(): Promise<NormalizedParkingRecord[]> {
    const now = Date.now();
    const records: NormalizedParkingRecord[] = [];

    // Load commercial json if available
    let rawList: CommercialJsonRecord[] = [];
    const targetFile =
      this.customDataFilePath ||
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../data/commercial_parking.json'
      );

    if (fs.existsSync(targetFile)) {
      try {
        const content = fs.readFileSync(targetFile, 'utf8');
        const parsed = JSON.parse(content) as CommercialJsonRecord[];
        rawList = parsed.filter((x) => x.providerId === 'impark');
      } catch (err) {
        console.warn('[ImparkFetcher] Error reading commercial_parking.json:', err);
      }
    }

    if (rawList.length === 0) {
      rawList = this.getHardcodedFallbackLots();
    }

    for (const item of rawList) {
      const id = `impark_${item.id.replace(/^impark-?/, '')}`;

      // Extract hourly rate from ratesSummary if available
      let rate = 5.0;
      const rateMatch = item.ratesSummary.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
      if (rateMatch) {
        rate = parseFloat(rateMatch[1]);
      }

      const candidate: Omit<NormalizedParkingRecord, 'contentHash'> = {
        id,
        externalId: item.lotNumber || item.id,
        provider_name: this.providerName,
        providerId: this.providerId,
        title: `${item.name} (${item.lotNumber})`,
        address: item.address,
        category: 'COMMERCIAL',
        stallCount: item.capacity || 200,
        stallType: item.stallType || 'Parkade Structure',
        brz: 'Downtown Core',
        priceZone: `Commercial ($${rate.toFixed(2)}/hr)`,
        enforceableHours: '24/7 Pay Station',
        activeRate: rate,
        isCurrentlyFree: false,
        rateSchedule: [
          { days: 'Mon-Fri', startTime: '06:00', endTime: '18:00', ratePerHour: rate },
          { days: 'Evening & Weekend', startTime: '18:00', endTime: '06:00', ratePerHour: Math.max(2.0, rate * 0.4) },
        ],
        coordinates: item.coordinates,
        restrictions: item.amenities || ['Pay on exit or mobile app (hangTag)'],
        paymentApp: item.paymentApp || 'hangTag',
        paymentUrl: item.paymentUrl || 'https://hangtag.io',
        fetchedAt: now,
        remoteSyncStatus: 'PENDING',
        rawData: item as unknown as Record<string, unknown>,
      };

      records.push({
        ...candidate,
        contentHash: computeCanonicalHash(candidate),
      });
    }

    return records;
  }

  private getHardcodedFallbackLots(): CommercialJsonRecord[] {
    return [
      {
        id: 'impark-316',
        providerId: 'impark',
        facilityType: 'PARKADE',
        name: 'Harry Hays Building Parkade',
        lotNumber: 'Lot 316',
        address: '220 4 Avenue SE, Calgary, AB T2G 4X3',
        coordinates: [-114.0583, 51.0504],
        capacity: 420,
        stallType: 'Underground',
        ratesSummary: 'Hourly: $4.50 | Day Max: $22.00',
        paymentApp: 'hangTag',
        paymentUrl: 'https://pay.hangtag.io/en/park/3316',
        operator: 'Impark',
      },
      {
        id: 'impark-6',
        providerId: 'impark',
        facilityType: 'PARKADE',
        name: 'Calgary Tower Parkade',
        lotNumber: 'Lot 6',
        address: '120 10 Avenue SW, Calgary, AB T2R 0A6',
        coordinates: [-114.0645, 51.0435],
        capacity: 350,
        stallType: 'Multi-Storey Parkade',
        ratesSummary: 'Hourly: $5.00 | Day Max: $25.00',
        paymentApp: 'hangTag',
        paymentUrl: 'https://pay.hangtag.io/en/park/3006',
        operator: 'Impark',
      },
      {
        id: 'impark-478',
        providerId: 'impark',
        facilityType: 'SURFACE LOT',
        name: 'Stampede Station Lot',
        lotNumber: 'Lot 478',
        address: '232 15 Avenue SE, Calgary, AB T2G 1G3',
        coordinates: [-114.0601, 51.0388],
        capacity: 180,
        stallType: 'Surface Lot',
        ratesSummary: 'Hourly: $3.50 | Day Max: $15.00',
        paymentApp: 'hangTag',
        paymentUrl: 'https://pay.hangtag.io/en/park/3478',
        operator: 'Impark',
      },
    ];
  }
}
