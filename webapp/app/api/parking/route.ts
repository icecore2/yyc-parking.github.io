import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/client';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { ParkingZone, ParkingZoneGeometry, ProviderId } from '@/lib/parking/types';
import { getPrimaryPath, pointAlongPolyline } from '@/lib/parking/geometry';
import { getDatabaseSyncClass, getLocalParkingDbPath } from '@/lib/parking/sqlite';
import fs from 'node:fs';

function mapProviderNameToId(name: string): ProviderId {
  const lower = (name || '').toLowerCase();
  if (lower.includes('myparking') || lower.includes('parkplus')) return 'parkplus_on_street';
  if (lower.includes('parkade') || lower.includes('city')) return 'cpa_off_street';
  if (lower.includes('transit')) return 'calgary_transit';
  if (lower.includes('impark')) return 'impark';
  if (lower.includes('indigo')) return 'indigo';
  if (lower.includes('precise') || lower.includes('parklink')) return 'precise_parklink';
  return 'parkplus_on_street';
}

function tryReadFromLocalSqlite(): ParkingZone[] | null {
  try {
    const DatabaseSync = getDatabaseSyncClass();
    if (!DatabaseSync) return null;

    const dbPath = getLocalParkingDbPath();
    if (fs.existsSync(dbPath)) {
      const sqlite = new DatabaseSync(dbPath);
      const rows = sqlite.prepare('SELECT * FROM local_parking_zones ORDER BY id ASC').all() as Record<string, unknown>[];
      sqlite.close();

      if (rows && rows.length > 0) {
        return rows.map((row) => {
          const geometry = row.geometry_json
            ? (JSON.parse(String(row.geometry_json)) as ParkingZoneGeometry)
            : undefined;
          const primaryPath = getPrimaryPath(geometry);
          const storedCoords: [number, number] = [
            Number(row.coordinates_lng),
            Number(row.coordinates_lat),
          ];
          const coordinates =
            primaryPath && primaryPath.length >= 2
              ? pointAlongPolyline(primaryPath, 0.5)
              : storedCoords;

          return {
            id: String(row.id || row.external_id),
            title: String(row.title),
            address: String(row.address),
            zoneNumber: String(row.external_id || ''),
            stallCount: Number(row.stall_count),
            stallType: String(row.stall_type),
            brz: String(row.brz || 'None'),
            priceZone: String(row.price_zone || 'Standard'),
            maxStayHours: row.max_stay_hours !== null ? Number(row.max_stay_hours) : undefined,
            enforceableHours: row.enforceable_hours ? String(row.enforceable_hours) : undefined,
            activeRate: Number(row.active_rate),
            isCurrentlyFree: Boolean(row.is_currently_free),
            rateSchedule: row.rate_schedule_json ? JSON.parse(String(row.rate_schedule_json)) : [],
            coordinates,
            geometry,
            provider: (row.provider_id as ProviderId) || mapProviderNameToId(String(row.provider_name)),
            provider_name: String(row.provider_name),
            restrictions: row.restrictions_json ? JSON.parse(String(row.restrictions_json)) : [],
            paymentApp: row.payment_app ? String(row.payment_app) : undefined,
            paymentUrl: row.payment_url ? String(row.payment_url) : undefined,
          };
        });
      }
    }
  } catch (err) {
    console.warn('[API /api/parking] Local SQLite fallback read error:', err);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filterProviderName = searchParams.get('provider_name');

  try {
    // 1. Attempt to query remote database table 'parking_data'
    if (db && db.type) {
      const colRef = collection(db, 'parking_data');
      const q = filterProviderName
        ? query(colRef, where('provider_name', '==', filterProviderName))
        : colRef;

      const snap = await getDocs(q);

      if (!snap.empty) {
        const zones: ParkingZone[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const providerName = data.provider_name || 'MyParking';
          const geometry = data.geometry as ParkingZoneGeometry | undefined;
          const primaryPath = getPrimaryPath(geometry);
          const storedCoords: [number, number] = data.coordinates || [0, 0];
          const coordinates =
            primaryPath && primaryPath.length >= 2
              ? pointAlongPolyline(primaryPath, 0.5)
              : storedCoords;

          zones.push({
            id: docSnap.id,
            title: String(data.title || `Zone #${data.externalId || docSnap.id}`),
            address: String(data.address || 'Calgary, AB'),
            zoneNumber: String(data.externalId || ''),
            stallCount: Number(data.stallCount || 0),
            stallType: String(data.stallType || 'Parallel'),
            brz: data.brz || 'None',
            priceZone: data.priceZone || 'Standard',
            maxStayHours: data.maxStayHours,
            enforceableHours: data.enforceableHours,
            activeRate: Number(data.activeRate || 0),
            isCurrentlyFree: Boolean(data.isCurrentlyFree),
            rateSchedule: data.rateSchedule || [],
            coordinates,
            geometry,
            provider: (data.providerId as ProviderId) || mapProviderNameToId(providerName),
            provider_name: providerName,
            restrictions: data.restrictions || [],
            paymentApp: data.paymentApp,
            paymentUrl: data.paymentUrl,
          });
        });

        return NextResponse.json(
          { source: 'remote_database', count: zones.length, zones },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
          }
        );
      }
    }
  } catch (err) {
    console.warn('[API /api/parking] Error querying remote Firestore collection:', err);
  }

  // 2. Fallback to local SQLite stage if remote collection is empty or offline
  const localZones = tryReadFromLocalSqlite();
  if (localZones && localZones.length > 0) {
    const filtered = filterProviderName
      ? localZones.filter((z) => z.provider_name === filterProviderName)
      : localZones;

    return NextResponse.json(
      { source: 'local_database_staging', count: filtered.length, zones: filtered },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  }

  return NextResponse.json({ source: 'empty', count: 0, zones: [] });
}
