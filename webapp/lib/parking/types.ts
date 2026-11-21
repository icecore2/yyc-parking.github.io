export type BasemapId = 'osm' | 'light' | 'hot';

export type ProviderId = 
  | 'parkplus_on_street'
  | 'cpa_off_street'
  | 'calgary_transit'
  | 'impark'
  | 'indigo'
  | 'precise_parklink';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  shortName: string;
  category: 'MUNICIPAL' | 'TRANSIT' | 'COMMERCIAL';
  operator: string;
  color: string;
  border?: string;
  textClass?: string;
  badgeClass: string;
  pillClass?: string;
  paymentApp: string;
  paymentUrl: string;
  description: string;
  logoSvg: string;
}

export interface RatePeriod {
  days: string; // e.g. "Mon-Fri", "Saturday", "Sunday"
  startTime: string; // e.g. "09:00"
  endTime: string; // e.g. "18:00"
  ratePerHour: number; // in dollars, e.g. 3.50
  isFree?: boolean;
}

export interface HourlyRatePoint {
  hour: number; // 0..23
  label: string; // "12 AM", "1 PM", etc.
  rate: number; // $ rate
  isEnforced: boolean;
}

export type ParkingZoneGeometry =
  | {
      type: 'LineString';
      coordinates: [number, number][]; // [[lng, lat], ...]
    }
  | {
      type: 'MultiLineString';
      coordinates: [number, number][][]; // [[[lng, lat], ...], ...]
    };

export interface ParkingZone {
  id: string; // Zone number, e.g. "1008" or "lot_12"
  title: string;
  address: string;
  zoneNumber?: string;
  blockSide?: string;
  stallCount?: number;
  stallType?: string;
  zoneType?: string;
  brz?: string; // Business Revitalization Zone e.g. "Downtown", "Kensington", "Beltline"
  priceZone?: string;
  maxStayHours?: number;
  enforceableHours?: string;
  enforceableTime?: string;
  rateSchedule: RatePeriod[];
  activeRate: number; // Current hourly rate right now
  isCurrentlyFree: boolean;
  coordinates: [number, number]; // [lng, lat]
  geometry?: ParkingZoneGeometry;
  provider: ProviderId;
  provider_name?: string; // Dedicated provider name column e.g. 'MyParking', 'Parkade', 'Impark'
  restrictions?: string[];
  permitZone?: string;
  amenities?: string[];
  heightLimit?: string;
  paymentApp?: string;
  paymentUrl?: string;
  distanceToTarget?: number | null;
  walkingMinutes?: number | null;
  lastUpdated?: string;
}

export interface CustomLocation {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  createdAt: number;
  updatedAt?: number;
  isExample?: boolean;
}

export interface ProximityResult {
  zone: ParkingZone;
  distanceMeters: number;
  walkingMinutes: number;
  totalCostDollars: number;
  hourlyRate: number;
}

export interface UserFavoriteSpot {
  id: string;
  zoneId: string;
  label: string; // e.g. "Work Office", "Gym"
  address: string;
  hourlyRate: number;
  coordinates: [number, number];
  provider: ProviderId;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
  isExample?: boolean;
}

export interface ParkingSession {
  id: string;
  zoneId: string;
  address: string;
  startTime: number; // timestamp ms
  durationHours: number;
  hourlyRate: number;
  totalCostDollars: number;
  expiryTime: number; // timestamp ms
  alertLeadMinutes: number; // e.g. 15 mins before expiry
  active: boolean;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  isExample?: boolean;
}

export interface UserVehicle {
  id: string;
  plate: string;
  description: string;
  isPrimary: boolean;
  createdAt: number;
  updatedAt?: number;
  isExample?: boolean;
}

export interface RateSnapshot {
  id: string;
  period: string;
  rate: number;
  createdAt?: number;
  isExample?: boolean;
}

export type WalkthroughStepId = 'profile' | 'vehicles' | 'locations' | 'favorites' | 'expenses';

export interface UserOnboardingState {
  walkthroughCompleted: boolean;
  walkthroughDismissed: boolean;
  dismissedExampleIds: string[];
  completedSteps: WalkthroughStepId[];
  updatedAt?: number;
}
