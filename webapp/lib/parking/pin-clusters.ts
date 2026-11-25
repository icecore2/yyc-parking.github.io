import type { ParkingZone, ProviderId } from './types';
import { PROVIDERS } from './providers';

/**
 * Pin clustering contract for the /app map.
 *
 * Zone pins are fed into a clustered MapLibre GeoJSON source (supercluster runs
 * in the map's web worker). At zoom <= PIN_CLUSTER_MAX_ZOOM nearby pins merge into
 * a single count bubble; above it every zone renders as its own teardrop pin.
 * Only the clusters/pins inside the loaded viewport tiles get DOM markers, so the
 * number of HTML elements stays small no matter how many zones are loaded.
 *
 * PIN_CLUSTER_MAX_ZOOM must stay below the zoom the map flies to when a zone is
 * previewed/selected (15.5 / 16) so the active pin is always broken out.
 */
export const PIN_CLUSTER_MAX_ZOOM = 14;
export const PIN_CLUSTER_RADIUS = 60;

export const PIN_CLUSTER_PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function providerCountKey(id: ProviderId): string {
  return `n_${id}`;
}

export interface PinFeatureProperties {
  id: string;
  provider: ProviderId;
  free: number;
  rate: number;
}

export interface PinFeature {
  type: 'Feature';
  properties: PinFeatureProperties;
  geometry: { type: 'Point'; coordinates: [number, number] };
}

/** One point feature per zone, placed at the zone's sharp-tip pin anchor. */
export function buildPinFeatures(
  zones: ParkingZone[],
  anchorMap: Map<string, [number, number]>
): PinFeature[] {
  const features: PinFeature[] = [];
  for (const zone of zones) {
    const coord = anchorMap.get(zone.id) || zone.coordinates;
    if (!coord || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) continue;
    features.push({
      type: 'Feature',
      properties: {
        id: zone.id,
        provider: zone.provider,
        free: zone.isCurrentlyFree ? 1 : 0,
        rate: Number.isFinite(zone.activeRate) ? zone.activeRate : 0,
      },
      geometry: { type: 'Point', coordinates: coord },
    });
  }
  return features;
}

/**
 * Aggregations computed per cluster by supercluster:
 * - n_<provider>: zone count per provider (drives the provider-mix ring)
 * - free: number of currently free zones
 * - minRate: cheapest paid rate (999 sentinel when every zone is free)
 */
export function buildClusterProperties(): Record<string, [unknown, unknown]> {
  const props: Record<string, [unknown, unknown]> = {};
  for (const id of PIN_CLUSTER_PROVIDER_IDS) {
    props[providerCountKey(id)] = ['+', ['case', ['==', ['get', 'provider'], id], 1, 0]];
  }
  props.free = ['+', ['get', 'free']];
  props.minRate = ['min', ['case', ['==', ['get', 'free'], 1], 999, ['get', 'rate']]];
  return props;
}

export interface ProviderSlice {
  provider: ProviderId;
  count: number;
  color: string;
}

export function getClusterProviderMix(props: Record<string, unknown>): ProviderSlice[] {
  return PIN_CLUSTER_PROVIDER_IDS.map((provider) => ({
    provider,
    count: Number(props[providerCountKey(provider)]) || 0,
    color: PROVIDERS[provider].color,
  }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** CSS conic-gradient for the provider-mix ring around a cluster bubble. */
export function buildProviderRingGradient(slices: ProviderSlice[]): string {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return '#64748b';
  if (slices.length === 1) return slices[0].color;
  let acc = 0;
  const stops = slices.map((s) => {
    const start = (acc / total) * 360;
    acc += s.count;
    const end = (acc / total) * 360;
    return `${s.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

/** Bubble diameter in px, growing logarithmically with the cluster size. */
export function getClusterDiameter(count: number): number {
  const n = Math.max(2, count);
  return Math.round(Math.min(60, 32 + Math.log10(n) * 12));
}

export function formatClusterCount(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

/** Secondary line shown under the count in live-rate mode. */
export function formatClusterRateHint(props: Record<string, unknown>): string {
  const count = Number(props.point_count) || 0;
  const free = Number(props.free) || 0;
  const minRate = Number(props.minRate);
  if (count > 0 && free >= count) return 'FREE';
  if (free > 0) return `${free} free`;
  if (Number.isFinite(minRate) && minRate < 999) return `from $${minRate.toFixed(2)}`;
  return '';
}
