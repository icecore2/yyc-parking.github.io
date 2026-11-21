import { ParkingZone, ParkingZoneGeometry } from './types';

// Metric conversion constants calibrated to Calgary's latitude (~51.0447° N)
const CALGARY_COS_LAT = Math.cos((51.0447 * Math.PI) / 180);
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG = METERS_PER_DEG_LAT * CALGARY_COS_LAT;

// Along-bar fractions used to stagger overlapping opposite-side pins while keeping them on their bar
const CANDIDATE_FRACTIONS = [0.5, 0.35, 0.65, 0.25, 0.75, 0.42, 0.58] as const;

export function approxDistanceMeters(a: [number, number], b: [number, number]): number {
  const dx = (b[0] - a[0]) * METERS_PER_DEG_LNG;
  const dy = (b[1] - a[1]) * METERS_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

export function polylineLengthMeters(coords: [number, number][]): number {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += approxDistanceMeters(coords[i], coords[i + 1]);
  }
  return total;
}

export function getPrimaryPath(geometry?: ParkingZoneGeometry | null): [number, number][] | null {
  if (!geometry) return null;
  if (geometry.type === 'LineString') {
    return Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0
      ? geometry.coordinates
      : null;
  }
  if (geometry.type === 'MultiLineString') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) return null;
    let bestPath: [number, number][] | null = null;
    let bestLen = -1;
    for (const path of geometry.coordinates) {
      if (!Array.isArray(path) || path.length === 0) continue;
      const len = polylineLengthMeters(path);
      if (!bestPath || len > bestLen) {
        bestPath = path;
        bestLen = len;
      }
    }
    return bestPath;
  }
  return null;
}

export function pointAlongPolyline(coords: [number, number][], fraction = 0.5): [number, number] {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) {
    return [Number(coords[0][0].toFixed(6)), Number(coords[0][1].toFixed(6))];
  }

  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const segLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const len = approxDistanceMeters(coords[i], coords[i + 1]);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return [Number(coords[0][0].toFixed(6)), Number(coords[0][1].toFixed(6))];
  }

  const targetLength = totalLength * clampedFraction;
  let accumulated = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumulated + segLen >= targetLength && segLen > 0) {
      const t = (targetLength - accumulated) / segLen;
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const lng = p1[0] + t * (p2[0] - p1[0]);
      const lat = p1[1] + t * (p2[1] - p1[1]);
      return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
    }
    accumulated += segLen;
  }

  const last = coords[coords.length - 1];
  return [Number(last[0].toFixed(6)), Number(last[1].toFixed(6))];
}

export function distancePointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const ax = a[0] * METERS_PER_DEG_LNG;
  const ay = a[1] * METERS_PER_DEG_LAT;
  const bx = b[0] * METERS_PER_DEG_LNG;
  const by = b[1] * METERS_PER_DEG_LAT;
  const px = p[0] * METERS_PER_DEG_LNG;
  const py = p[1] * METERS_PER_DEG_LAT;

  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / abLenSq));
  const closestX = ax + t * abx;
  const closestY = ay + t * aby;
  return Math.hypot(px - closestX, py - closestY);
}

export function distancePointToPolylineMeters(
  point: [number, number],
  coords: [number, number][]
): number {
  if (!coords || coords.length === 0) return Infinity;
  if (coords.length === 1) return approxDistanceMeters(point, coords[0]);

  let minDist = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = distancePointToSegmentMeters(point, coords[i], coords[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

interface AnchorEntry {
  zoneId: string;
  primaryPath: [number, number][] | null;
  barLengthMeters: number;
  anchor: [number, number];
  fraction: number;
  cellKey: string;
}

function getGridCell(coord: [number, number], cellSizeMeters: number): [number, number] {
  const cx = Math.floor((coord[0] * METERS_PER_DEG_LNG) / cellSizeMeters);
  const cy = Math.floor((coord[1] * METERS_PER_DEG_LAT) / cellSizeMeters);
  return [cx, cy];
}

function formatCellKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function resolvePinAnchorCoordinates(
  zones: ParkingZone[],
  minSeparationMeters = 22
): Map<string, [number, number]> {
  const cellSizeMeters = Math.max(25, minSeparationMeters + 3);
  const entriesById = new Map<string, AnchorEntry>();
  const grid = new Map<string, AnchorEntry[]>();

  const addToGrid = (entry: AnchorEntry) => {
    const [cx, cy] = getGridCell(entry.anchor, cellSizeMeters);
    entry.cellKey = formatCellKey(cx, cy);
    const bucket = grid.get(entry.cellKey);
    if (bucket) bucket.push(entry);
    else grid.set(entry.cellKey, [entry]);
  };

  const removeFromGrid = (entry: AnchorEntry) => {
    const bucket = grid.get(entry.cellKey);
    if (!bucket) return;
    const idx = bucket.indexOf(entry);
    if (idx !== -1) bucket.splice(idx, 1);
  };

  const getNearbyEntries = (coord: [number, number], excludeId: string): AnchorEntry[] => {
    const [cx, cy] = getGridCell(coord, cellSizeMeters);
    const neighbors: AnchorEntry[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(formatCellKey(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const item of bucket) {
          if (item.zoneId !== excludeId) neighbors.push(item);
        }
      }
    }
    return neighbors;
  };

  for (const zone of zones) {
    const primaryPath = getPrimaryPath(zone.geometry);
    const barLengthMeters = primaryPath && primaryPath.length >= 2 ? polylineLengthMeters(primaryPath) : 0;
    const anchor =
      primaryPath && primaryPath.length >= 2
        ? pointAlongPolyline(primaryPath, 0.5)
        : zone.coordinates;

    const entry: AnchorEntry = {
      zoneId: zone.id,
      primaryPath: primaryPath && primaryPath.length >= 2 ? primaryPath : null,
      barLengthMeters,
      anchor,
      fraction: 0.5,
      cellKey: '',
    };
    entriesById.set(zone.id, entry);
    addToGrid(entry);
  }

  // Deterministic ordering so overlapping opposite-side bars stagger predictably
  const sortedEntries = Array.from(entriesById.values()).sort((a, b) =>
    a.zoneId.localeCompare(b.zoneId)
  );

  // Two passes allow symmetric pairs (e.g. North vs South side of same block) to separate cleanly
  for (let pass = 0; pass < 2; pass++) {
    for (const entry of sortedEntries) {
      if (!entry.primaryPath || entry.barLengthMeters < 10) continue;

      const nearby = getNearbyEntries(entry.anchor, entry.zoneId);
      if (nearby.length === 0) continue;

      let currentMinDist = Infinity;
      for (const other of nearby) {
        const d = approxDistanceMeters(entry.anchor, other.anchor);
        if (d < currentMinDist) currentMinDist = d;
      }

      if (currentMinDist >= minSeparationMeters) continue;

      let bestFraction = entry.fraction;
      let bestPoint = entry.anchor;
      let bestMinDist = currentMinDist;

      for (const f of CANDIDATE_FRACTIONS) {
        const pt = pointAlongPolyline(entry.primaryPath, f);
        const ptNeighbors = getNearbyEntries(pt, entry.zoneId);
        let minDist = Infinity;
        for (const other of ptNeighbors) {
          const d = approxDistanceMeters(pt, other.anchor);
          if (d < minDist) minDist = d;
        }

        const clampedScore = Math.min(minDist, minSeparationMeters + 2);
        const bestClampedScore = Math.min(bestMinDist, minSeparationMeters + 2);
        const isBetter =
          clampedScore > bestClampedScore + 0.5 ||
          (Math.abs(clampedScore - bestClampedScore) <= 0.5 &&
            Math.abs(f - 0.5) < Math.abs(bestFraction - 0.5));

        if (isBetter) {
          bestFraction = f;
          bestPoint = pt;
          bestMinDist = minDist;
        }
      }

      if (bestPoint[0] !== entry.anchor[0] || bestPoint[1] !== entry.anchor[1]) {
        removeFromGrid(entry);
        entry.fraction = bestFraction;
        entry.anchor = bestPoint;
        addToGrid(entry);
      }
    }
  }

  const result = new Map<string, [number, number]>();
  for (const zone of zones) {
    const entry = entriesById.get(zone.id);
    if (entry) result.set(zone.id, entry.anchor);
  }
  return result;
}
