import { ParkingZone, ProximityResult } from './types';

/**
 * Calculates Haversine distance in meters between two [lng, lat] points
 */
export function calculateDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371e3; // Earth radius in meters
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

/**
 * Finds the cheapest parking zones near a target destination within a given radius
 * @param destination [lng, lat]
 * @param zones Array of ParkingZone
 * @param durationHours How long user intends to park (e.g. 2)
 * @param maxRadiusMeters Maximum walking radius (default: 800m / ~10 min walk)
 */
export function findCheapestParkingSpots(
  destination: [number, number],
  zones: ParkingZone[],
  durationHours = 2,
  maxRadiusMeters = 800
): ProximityResult[] {
  const results: ProximityResult[] = [];

  for (const zone of zones) {
    const dist = calculateDistanceMeters(destination, zone.coordinates);

    if (dist <= maxRadiusMeters) {
      // Average walking speed: 80 meters per minute (~4.8 km/h)
      const walkingMinutes = Math.max(1, Math.round(dist / 80));
      const hourlyRate = zone.isCurrentlyFree ? 0 : zone.activeRate;
      const totalCostDollars = Number((hourlyRate * durationHours).toFixed(2));

      results.push({
        zone,
        distanceMeters: Math.round(dist),
        walkingMinutes,
        totalCostDollars,
        hourlyRate,
      });
    }
  }

  // Sort primarily by lowest total cost, then by closest walking distance
  results.sort((a, b) => {
    if (a.totalCostDollars !== b.totalCostDollars) {
      return a.totalCostDollars - b.totalCostDollars;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  return results;
}
