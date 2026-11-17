import { ProviderId, ProviderInfo } from './types';

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  parkplus_on_street: {
    id: 'parkplus_on_street',
    name: 'ParkPlus (On-Street)',
    shortName: 'On-Street',
    category: 'MUNICIPAL',
    operator: 'Calgary Parking Authority',
    color: '#059669', // Emerald Green
    border: '#047857',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    pillClass: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    paymentApp: 'ParkPlus (MyParking)',
    paymentUrl: 'https://www.calgaryparking.com/parkplus',
    description: 'Official curbside pay parking zones enforced by the City of Calgary / ParkPlus.',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8v7H5V4zm3 3v3h3.5a1.5 1.5 0 0 0 0-3H8z"/><path d="M18 9v3h-3v2h3v3h2v-3h3v-2h-3V9h-2z"/></svg>`,
  },
  cpa_off_street: {
    id: 'cpa_off_street',
    name: 'City Parkades & Surface Lots',
    shortName: 'City Lots & Parkades',
    category: 'MUNICIPAL',
    operator: 'City of Calgary / Calgary Parking',
    color: '#2563eb', // Royal Blue
    border: '#1d4ed8',
    textClass: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pillClass: 'border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-300',
    paymentApp: 'ParkPlus / Onsite Pay',
    paymentUrl: 'https://www.calgaryparking.com/find-parking/lots.html',
    description: 'Official municipal parkades (Centennial, Platform, City Centre, McDougall) and surface lots.',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M3 21h18v-2H3v2zm1-4h16V3H4v14zm2-12h12v10H6V5zm3 2h3.5a2 2 0 0 1 0 4H10v3H8V7zm2 1.5v1h1.5a.5.5 0 0 0 0-1H10z"/></svg>`,
  },
  calgary_transit: {
    id: 'calgary_transit',
    name: 'Calgary Transit (Park & Ride)',
    shortName: 'Transit Park & Ride',
    category: 'TRANSIT',
    operator: 'Calgary Transit',
    color: '#dc2626', // Transit Red
    border: '#b91c1c',
    textClass: 'text-red-600 dark:text-red-400',
    badgeClass: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    pillClass: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300',
    paymentApp: 'Free after 11am & Weekends',
    paymentUrl: 'https://www.calgarytransit.com/park-and-ride/',
    description: 'Dedicated CTrain LRT station commuter parking lots. 100% FREE after 11:00 AM weekdays and all day on weekends & holidays.',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M4 5h16v4h-6v11h-4V9H4V5z"/><path d="M12 1.5 16 5H8l4-3.5z"/></svg>`,
  },
  impark: {
    id: 'impark',
    name: 'Impark (Imperial Parking)',
    shortName: 'Impark',
    category: 'COMMERCIAL',
    operator: 'Imperial Parking / REEF',
    color: '#be123c', // Crimson Rose
    border: '#9f1239',
    textClass: 'text-rose-600 dark:text-rose-400',
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    pillClass: 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-300',
    paymentApp: 'hangTag',
    paymentUrl: 'https://hangtag.io',
    description: 'Major private commercial parking operator managing downtown Calgary office towers, parkades, and surface lots.',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><circle cx="12" cy="5.5" r="2.5"/><path d="M9.5 10.5h5v9.5h-5z"/><path d="M4.5 12a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  },
  indigo: {
    id: 'indigo',
    name: 'Indigo (Indigo Neo)',
    shortName: 'Indigo Neo',
    category: 'COMMERCIAL',
    operator: 'Indigo Park Canada',
    color: '#0891b2', // Cyan / Teal
    border: '#0e7490',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    badgeClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    pillClass: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    paymentApp: 'Indigo Neo',
    paymentUrl: 'https://indigoneo.ca',
    description: 'Premium downtown parking structures (The CORE, The Bow, Continental Towers, Gulf Canada Square).',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><circle cx="12" cy="5.5" r="2.5"/><path d="M8 11.5c0-1.5 1.5-2.5 4-2.5 3 0 4.5 1.5 4.5 4.5v6.5h-3.5v-6c0-1-.5-1.5-1.5-1.5s-1.5.5-1.5 1.5v6H6.5v-8.5H8z"/></svg>`,
  },
  precise_parklink: {
    id: 'precise_parklink',
    name: 'Precise ParkLink',
    shortName: 'ParkLink',
    category: 'COMMERCIAL',
    operator: 'Precise ParkLink',
    color: '#1e3a8a', // Deep Navy
    border: '#172554',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    badgeClass: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    pillClass: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    paymentApp: 'Parkedin',
    paymentUrl: 'https://parkedin.com',
    description: 'Institutional, campus (SAIT), and commercial office parkades and surface lots with Parkedin mobile pay.',
    logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M7 3h7a5 5 0 0 1 0 10H10v8H7V3zm3 3v4h4a2 2 0 0 0 0-4h-4z"/><circle cx="17.5" cy="17.5" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  },
};

export function getProvider(id: ProviderId): ProviderInfo {
  return PROVIDERS[id] || PROVIDERS.parkplus_on_street;
}
