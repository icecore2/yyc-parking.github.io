/**
 * Calgary Parking Map - Multi-Provider Registry & Branded Pin System
 * 
 * Supports both Browser environment (window.CpaProviders) and Node.js (module.exports)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CpaProviders = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PROVIDERS = {
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
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8v7H5V4zm3 3v3h3.5a1.5 1.5 0 0 0 0-3H8z"/><path d="M18 9v3h-3v2h3v3h2v-3h3v-2h-3V9h-2z"/></svg>`
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
      description: 'Official municipal parkades (Centennial, Platform, City Centre, etc.) and surface lots with automated barrier & pay machines.',
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M3 21h18v-2H3v2zm1-4h16V3H4v14zm2-12h12v10H6V5zm3 2h3.5a2 2 0 0 1 0 4H10v3H8V7zm2 1.5v1h1.5a.5.5 0 0 0 0-1H10z"/></svg>`
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
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M4 5h16v4h-6v11h-4V9H4V5z"/><path d="M12 1.5 16 5H8l4-3.5z"/></svg>`
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
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><circle cx="12" cy="5.5" r="2.5"/><path d="M9.5 10.5h5v9.5h-5z"/><path d="M4.5 12a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`
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
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><circle cx="12" cy="5.5" r="2.5"/><path d="M8 11.5c0-1.5 1.5-2.5 4-2.5 3 0 4.5 1.5 4.5 4.5v6.5h-3.5v-6c0-1-.5-1.5-1.5-1.5s-1.5.5-1.5 1.5v6H6.5v-8.5H8z"/></svg>`
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
      logoSvg: `<svg viewBox="0 0 24 24" fill="currentColor" class="provider-logo-svg"><path d="M7 3h7a5 5 0 0 1 0 10H10v8H7V3zm3 3v4h4a2 2 0 0 0 0-4h-4z"/><circle cx="17.5" cy="17.5" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
    }
  };

  /**
   * Safely retrieve provider configuration
   */
  function getProvider(providerId) {
    if (!providerId) return PROVIDERS.parkplus_on_street;
    return PROVIDERS[providerId] || PROVIDERS.parkplus_on_street;
  }

  /**
   * Generate Leaflet DivIcon with provider-specific logo embedded inside
   */
  function createProviderPinIcon(providerId, tooltipTitle, isSelected = false) {
    if (typeof L === 'undefined') return null;
    const p = getProvider(providerId);

    const activeClass = isSelected ? 'pin-active' : '';

    return L.divIcon({
      className: `custom-pin-marker pin-${p.id} ${activeClass}`,
      html: `
        <div class="pin-bubble" style="--provider-color: ${p.color}; --provider-border: ${p.border};" title="${tooltipTitle || p.name}">
          <div class="pin-logo">
            ${p.logoSvg}
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });
  }

  /**
   * Helper to format provider badge HTML for sidebars & cards
   */
  function renderProviderBadge(providerId, options = {}) {
    const p = getProvider(providerId);
    const showLogo = options.showLogo !== false;
    const compact = options.compact === true;

    return `
      <span class="inline-flex items-center gap-1.5 rounded-md border ${p.badgeClass} px-2 py-0.5 text-xs font-semibold">
        ${showLogo ? `<span class="inline-flex h-3.5 w-3.5 items-center justify-center shrink-0">${p.logoSvg}</span>` : ''}
        <span>${compact ? p.shortName : p.name}</span>
      </span>
    `;
  }

  /**
   * Curated Calgary Transit CTrain stations with Park and Ride parking inventories
   */
  const TRANSIT_PARK_AND_RIDE_STATIONS = [
    // Red Line South
    { name: 'Somerset-Bridlewood', stalls: 900, lat: 50.8992, lng: -114.0702, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Shawnessy', stalls: 250, lat: 50.9125, lng: -114.0700, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Fish Creek-Lacombe', stalls: 1100, lat: 50.9238, lng: -114.0708, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Canyon Meadows', stalls: 900, lat: 50.9382, lng: -114.0688, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Anderson', stalls: 1700, lat: 50.9575, lng: -114.0673, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Southland', stalls: 650, lat: 50.9664, lng: -114.0702, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Heritage', stalls: 550, lat: 50.9785, lng: -114.0745, leg: 'South', reservedFee: '$85/mo' },
    { name: 'Chinook', stalls: 350, lat: 50.9968, lng: -114.0728, leg: 'South', reservedFee: '$85/mo' },
    
    // Red Line North / Northwest
    { name: 'Tuscany', stalls: 550, lat: 51.1197, lng: -114.2378, leg: 'NW', reservedFee: '$85/mo' },
    { name: 'Crowfoot', stalls: 1350, lat: 51.1092, lng: -114.2082, leg: 'NW', reservedFee: '$85/mo' },
    { name: 'Dalhousie', stalls: 850, lat: 51.0965, lng: -114.1605, leg: 'NW', reservedFee: '$85/mo' },
    { name: 'Brentwood', stalls: 950, lat: 51.0872, lng: -114.1332, leg: 'NW', reservedFee: '$85/mo' },
    
    // Blue Line West
    { name: '69 Street', stalls: 800, lat: 51.0375, lng: -114.1882, leg: 'West', reservedFee: '$85/mo' },
    { name: 'Sirocco', stalls: 300, lat: 51.0422, lng: -114.1645, leg: 'West', reservedFee: '$85/mo' },
    { name: 'Westbrook', stalls: 200, lat: 51.0428, lng: -114.1205, leg: 'West', reservedFee: '$85/mo' },
    
    // Blue Line East / Northeast
    { name: 'Saddletowne', stalls: 150, lat: 51.1258, lng: -113.9482, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'Martindale', stalls: 150, lat: 51.1158, lng: -113.9582, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'McKnight-Westwinds', stalls: 950, lat: 51.0998, lng: -113.9772, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'Whitehorn', stalls: 850, lat: 51.0862, lng: -113.9825, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'Rundle', stalls: 550, lat: 51.0745, lng: -113.9858, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'Marlborough', stalls: 450, lat: 51.0602, lng: -113.9822, leg: 'NE', reservedFee: '$85/mo' },
    { name: 'Franklin', stalls: 600, lat: 51.0482, lng: -114.0085, leg: 'East', reservedFee: '$85/mo' },
    { name: 'Barlow / Max Bell', stalls: 50, lat: 51.0458, lng: -114.0202, leg: 'East', reservedFee: 'Free' }
  ];

  return {
    PROVIDERS,
    getProvider,
    createProviderPinIcon,
    renderProviderBadge,
    TRANSIT_PARK_AND_RIDE_STATIONS
  };
}));
