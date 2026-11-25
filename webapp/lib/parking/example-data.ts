import {
  CustomLocation,
  ParkingSession,
  RateSnapshot,
  UserPriceReport,
  UserFavoriteSpot,
  UserOnboardingState,
  UserVehicle,
  WalkthroughStepId,
} from './types';

export const PLACEHOLDER_DISPLAY_NAMES = [
  'Calgary Commuter',
  'Calgary Driver',
  'Calgary Driver (Demo Mode)',
] as const;

export const EXAMPLE_VEHICLES: UserVehicle[] = [
  {
    id: 'example_vehicle_1',
    plate: 'BXY-8492',
    description: 'Subaru Outback (Silver)',
    isPrimary: true,
    isExample: true,
    createdAt: 1730000000000,
  },
];

export const EXAMPLE_SESSIONS: ParkingSession[] = [
  {
    id: 'example_exp_1',
    zoneId: '1008',
    address: 'Eau Claire Ave SW, Fr 4 St SW To 5 St SW',
    startTime: 1730700000000,
    durationHours: 2.5,
    hourlyRate: 3.5,
    totalCostDollars: 8.75,
    expiryTime: 1730709000000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Client meeting at Eau Claire',
    createdAt: 1730700000000,
    isExample: true,
  },
  {
    id: 'example_exp_2',
    zoneId: '1042',
    address: '8 Avenue SW (Stephen Ave), Fr 5 St SW To 6 St SW',
    startTime: 1730440800000,
    durationHours: 1.5,
    hourlyRate: 4.5,
    totalCostDollars: 6.75,
    expiryTime: 1730446200000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Lunch at Stephen Ave Walkway',
    createdAt: 1730440800000,
    isExample: true,
  },
  {
    id: 'example_exp_3',
    zoneId: '1210',
    address: '10 Avenue SW, Fr 1 St SW To 2 St SW',
    startTime: 1730181600000,
    durationHours: 3.0,
    hourlyRate: 2.5,
    totalCostDollars: 7.5,
    expiryTime: 1730192400000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Office day Beltline',
    createdAt: 1730181600000,
    isExample: true,
  },
];

export const EXAMPLE_LOCATIONS: CustomLocation[] = [
  {
    id: 'example_loc_core',
    name: 'The CORE Shopping Centre',
    address: '510 8 Ave SW, Calgary',
    coordinates: [-114.0688, 51.0458],
    createdAt: 1700000000000,
    isExample: true,
  },
  {
    id: 'example_loc_tower',
    name: 'Calgary Tower / Stephen Ave',
    address: '101 9 Ave SW, Calgary',
    coordinates: [-114.0631, 51.0443],
    createdAt: 1700000000001,
    isExample: true,
  },
  {
    id: 'example_loc_saddledome',
    name: 'Scotiabank Saddledome',
    address: '555 Saddledome Rise SE, Calgary',
    coordinates: [-114.0519, 51.0374],
    createdAt: 1700000000002,
    isExample: true,
  },
];

export const EXAMPLE_FAVORITES: UserFavoriteSpot[] = [
  {
    id: 'example_fav_1',
    zoneId: '1008',
    label: 'Office — Eau Claire (Example)',
    address: 'Eau Claire Ave SW, Fr 4 St SW To 5 St SW',
    hourlyRate: 3.5,
    coordinates: [-114.0706, 51.0532],
    provider: 'parkplus_on_street',
    notes: 'Example saved spot — edit label/notes or save a real zone from the map',
    createdAt: 1730000000000,
    isExample: true,
  },
];

export function createExampleRateSnapshots(activeRate: number): RateSnapshot[] {
  return [
    {
      id: 'example_snap_base',
      period: '2024 Base Rate',
      rate: Math.max(1.5, Number((activeRate - 0.5).toFixed(2))),
      isExample: true,
    },
    {
      id: 'example_snap_live',
      period: 'Current Live Rate',
      rate: activeRate,
      isExample: true,
    },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Example posted prices, derived from the example snapshots, shown until dismissed. */
export function createExamplePriceReports(
  zoneId: string,
  activeRate: number,
  now: number = Date.now()
): UserPriceReport[] {
  const [base, live] = createExampleRateSnapshots(activeRate);
  return [
    {
      id: base.id,
      zoneId,
      rate: base.rate,
      note: base.period,
      observedAt: now - 60 * DAY_MS,
      createdAt: now - 60 * DAY_MS,
      isExample: true,
    },
    {
      id: live.id,
      zoneId,
      rate: live.rate,
      note: live.period,
      observedAt: now - DAY_MS,
      createdAt: now - DAY_MS,
      isExample: true,
    },
  ];
}

export const EXAMPLE_IDS_BY_SECTION = {
  vehicles: EXAMPLE_VEHICLES.map((v) => v.id),
  sessions: EXAMPLE_SESSIONS.map((s) => s.id),
  locations: EXAMPLE_LOCATIONS.map((l) => l.id),
  favorites: EXAMPLE_FAVORITES.map((f) => f.id),
} as const;

export const ALL_EXAMPLE_IDS: string[] = [
  ...EXAMPLE_IDS_BY_SECTION.vehicles,
  ...EXAMPLE_IDS_BY_SECTION.sessions,
  ...EXAMPLE_IDS_BY_SECTION.locations,
  ...EXAMPLE_IDS_BY_SECTION.favorites,
];

export const LEGACY_DEFAULT_LOCATION_IDS = new Set([
  'loc_core',
  'loc_tower',
  'loc_saddledome',
]);

export const DEFAULT_ONBOARDING_STATE: UserOnboardingState = {
  walkthroughCompleted: false,
  walkthroughDismissed: false,
  dismissedExampleIds: [],
  completedSteps: [],
};

/** Returns true when a display name is empty or matches one of the placeholder defaults. */
export function isPlaceholderDisplayName(name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  const normalized = name.trim().toLowerCase();
  return PLACEHOLDER_DISPLAY_NAMES.some((p) => p.toLowerCase() === normalized);
}

/** Strips the virtual `isExample` marker before writing a record to Firestore/localStorage. */
export function stripExampleFlag<T extends { isExample?: boolean }>(item: T): Omit<T, 'isExample'> {
  const rest = { ...item };
  delete rest.isExample;
  return rest;
}

/** Combines real user-persisted records (first) with non-dismissed virtual example records. */
export function mergeWithExamples<T extends { id: string; isExample?: boolean }>(
  realItems: T[],
  exampleItems: T[],
  dismissedExampleIds: string[]
): T[] {
  const dismissed = new Set(dismissedExampleIds);
  const realIds = new Set(realItems.map((item) => item.id));
  const cleanedReal = realItems.map((item) => ({ ...item, isExample: false }));
  const remainingExamples = exampleItems
    .filter((ex) => !dismissed.has(ex.id) && !realIds.has(ex.id))
    .map((ex) => ({ ...ex, isExample: true }));
  return [...cleanedReal, ...remainingExamples];
}

export function hasExampleItems<T extends { isExample?: boolean }>(items: T[]): boolean {
  return items.some((item) => Boolean(item.isExample));
}

export function getRealItems<T extends { isExample?: boolean }>(items: T[]): T[] {
  return items.filter((item) => !item.isExample);
}

export function dismissExampleIds(
  state: UserOnboardingState,
  ids: string[]
): UserOnboardingState {
  const nextSet = new Set([...state.dismissedExampleIds, ...ids]);
  return {
    ...state,
    dismissedExampleIds: Array.from(nextSet),
    updatedAt: Date.now(),
  };
}

export function restoreExampleIds(
  state: UserOnboardingState,
  ids: string[]
): UserOnboardingState {
  const toRestore = new Set(ids);
  return {
    ...state,
    dismissedExampleIds: state.dismissedExampleIds.filter((id) => !toRestore.has(id)),
    updatedAt: Date.now(),
  };
}

export interface WalkthroughStepStatus {
  completed: boolean;
  hasRealData: boolean;
  examplesCleared: boolean;
}

export interface WalkthroughProgressSummary {
  steps: Record<WalkthroughStepId, WalkthroughStepStatus>;
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  remainingExampleCount: number;
}

export function computeWalkthroughProgress(params: {
  displayName?: string | null;
  vehicles: UserVehicle[];
  locations: CustomLocation[];
  favorites: UserFavoriteSpot[];
  sessions: ParkingSession[];
  onboardingState: UserOnboardingState;
}): WalkthroughProgressSummary {
  const dismissed = new Set(params.onboardingState.dismissedExampleIds);
  const manualSteps = new Set(params.onboardingState.completedSteps);

  const realVehicles = getRealItems(params.vehicles);
  const realLocations = getRealItems(params.locations);
  const realFavorites = getRealItems(params.favorites);
  const realSessions = getRealItems(params.sessions);

  const vehiclesExamplesCleared = EXAMPLE_IDS_BY_SECTION.vehicles.every((id) => dismissed.has(id));
  const locationsExamplesCleared = EXAMPLE_IDS_BY_SECTION.locations.every((id) => dismissed.has(id));
  const favoritesExamplesCleared = EXAMPLE_IDS_BY_SECTION.favorites.every((id) => dismissed.has(id));
  const sessionsExamplesCleared = EXAMPLE_IDS_BY_SECTION.sessions.every((id) => dismissed.has(id));

  const profileDone = !isPlaceholderDisplayName(params.displayName) || manualSteps.has('profile');
  const vehiclesDone = realVehicles.length > 0 || vehiclesExamplesCleared || manualSteps.has('vehicles');
  const locationsDone = realLocations.length > 0 || locationsExamplesCleared || manualSteps.has('locations');
  const favoritesDone = realFavorites.length > 0 || favoritesExamplesCleared || manualSteps.has('favorites');
  const expensesDone = realSessions.length > 0 || sessionsExamplesCleared || manualSteps.has('expenses');

  const steps: Record<WalkthroughStepId, WalkthroughStepStatus> = {
    profile: {
      completed: profileDone,
      hasRealData: !isPlaceholderDisplayName(params.displayName),
      examplesCleared: true,
    },
    vehicles: {
      completed: vehiclesDone,
      hasRealData: realVehicles.length > 0,
      examplesCleared: vehiclesExamplesCleared,
    },
    locations: {
      completed: locationsDone,
      hasRealData: realLocations.length > 0,
      examplesCleared: locationsExamplesCleared,
    },
    favorites: {
      completed: favoritesDone,
      hasRealData: realFavorites.length > 0,
      examplesCleared: favoritesExamplesCleared,
    },
    expenses: {
      completed: expensesDone,
      hasRealData: realSessions.length > 0,
      examplesCleared: sessionsExamplesCleared,
    },
  };

  const completedCount = Object.values(steps).filter((s) => s.completed).length;
  const remainingExampleCount = ALL_EXAMPLE_IDS.filter((id) => !dismissed.has(id)).length;

  return {
    steps,
    completedCount,
    totalCount: 5,
    allDone: completedCount === 5,
    remainingExampleCount,
  };
}

export function buildExpenseCsvContent(
  sessions: ParkingSession[],
  options: { includeExamples?: boolean } = {}
): { csv: string; exportedCount: number; skippedExampleCount: number } {
  const includeExamples = Boolean(options.includeExamples);
  const exampleCount = sessions.filter((s) => Boolean(s.isExample)).length;
  const rowsToExport = includeExamples ? sessions : sessions.filter((s) => !s.isExample);
  const skippedExampleCount = includeExamples ? 0 : exampleCount;

  const headers = [
    'Date',
    'Zone ID',
    'Address',
    'Duration (Hours)',
    'Hourly Rate ($)',
    'Total Paid ($)',
    'Notes',
  ];

  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = rowsToExport.map((s) => [
    new Date(s.startTime).toLocaleDateString(),
    escapeCell(s.zoneId),
    escapeCell(s.address || ''),
    s.durationHours,
    s.hourlyRate.toFixed(2),
    s.totalCostDollars.toFixed(2),
    escapeCell(s.notes || ''),
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return {
    csv,
    exportedCount: rowsToExport.length,
    skippedExampleCount,
  };
}
