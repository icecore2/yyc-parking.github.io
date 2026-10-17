/**
 * Calgary On-Street Parking Map
 * Refined with shadcn/ui framework design patterns, Lucide icons, and Tailwind CSS.
 */

// API Configuration
const DEFAULT_API_URL = 'https://services1.arcgis.com/AVP60cs0Q9PEA8rH/arcgis/rest/services/Calgary_Parking_Authority_On_Street_Parking_Zones_with_Rates/FeatureServer/0/query?where=1%3D1&outFields=*&resultRecordCount=20000&f=json';

// Global Application State
const state = {
  apiUrl: localStorage.getItem('cpa_api_url') || DEFAULT_API_URL,
  rawFeatures: [],
  parsedZones: [],
  filteredZones: [],
  selectedZone: null,
  activePolyline: null,
  activeMarker: null,
  showPins: true,
  showShapes: true,
  useClustering: true,
  currentFilterBRZ: 'ALL',
  searchQuery: '',
  isLoading: false,
  theme: localStorage.getItem('cpa_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  activeTab: 'overview', // 'overview', 'rates', 'history', 'rules'
  scheduleDayType: 'weekday', // 'weekday', 'saturday', 'sunday'
  scheduleChart: null,
  historyChart: null,
  
  // Price Filtration State
  priceFilter: 'ALL', // 'ALL', 'free', '1', '2', '3', '4', '5'
  rateMode: 'live', // 'live' (current rate right now), 'max' (peak daytime rate)

  // Custom Locations & Closest + Cheapest State
  customLocations: [],
  activeLocationId: 'NONE',
  activeLocation: null,
  maxRadius: 500, // 300, 500, 1000, 2000, 'ALL'
  sortMode: 'closest_cheapest', // 'closest_cheapest', 'cheapest', 'closest'
  targetMarker: null,
  radiusCircle: null,
  isPickingLocation: false,
  showBestValuePanel: true,

  // Multi-Provider State
  enabledProviders: new Set(['parkplus_on_street', 'cpa_off_street', 'calgary_transit', 'impark', 'indigo', 'precise_parklink']),
  providerCounts: {},
};

// UI Elements
const elements = {
  map: null,
  tileLayers: {},
  currentBaseLayer: null,
  polylineLayer: null,
  markerClusterGroup: null,
  markerStandardLayer: null,
  statusPulse: document.getElementById('status-pulse'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  zoneCount: document.getElementById('zone-count'),
  refreshBtn: document.getElementById('refresh-btn'),
  refreshIcon: document.getElementById('refresh-icon'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  themeIcon: document.getElementById('theme-icon'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  brzFilter: document.getElementById('brz-filter'),
  togglePins: document.getElementById('toggle-pins'),
  toggleShapes: document.getElementById('toggle-shapes'),
  toggleCluster: document.getElementById('toggle-cluster'),
  detailsSheet: document.getElementById('details-sheet'),
  sheetBackdrop: document.getElementById('sheet-backdrop'),
  sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
  sidebarContent: document.getElementById('sidebar-content'),
  sidebarZoneNum: document.getElementById('sidebar-zone-num'),
  sidebarStallBadge: document.getElementById('sidebar-stall-badge'),
  sidebarStreet: document.getElementById('sidebar-street'),
  sidebarProviderBadge: document.getElementById('sidebar-provider-badge'),
  btnProviderAction: document.getElementById('btn-provider-action'),
  btnProviderActionText: document.getElementById('btn-provider-action-text'),
  tabBtnOverview: document.getElementById('tab-btn-overview'),
  tabBtnRates: document.getElementById('tab-btn-rates'),
  tabBtnHistory: document.getElementById('tab-btn-history'),
  tabBtnRules: document.getElementById('tab-btn-rules'),
  btnZoomZone: document.getElementById('btn-zoom-zone'),
  btnGmapsLink: document.getElementById('btn-gmaps-link'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsResetBtn: document.getElementById('settings-reset-btn'),
  apiUrlInput: document.getElementById('api-url-input'),

  // Multi-Provider Toolbar Elements
  providerToolbarRow: document.getElementById('provider-toolbar-row'),
  providerPillsContainer: document.getElementById('provider-pills-container'),
  btnSelectAllProviders: document.getElementById('btn-select-all-providers'),
  btnSelectNoneProviders: document.getElementById('btn-select-none-providers'),

  // Custom Locations & Price Filtration Elements
  filterToolbarRow: document.getElementById('filter-toolbar-row'),
  locationSelect: document.getElementById('location-select'),
  btnManageLocations: document.getElementById('btn-manage-locations'),
  radiusContainer: document.getElementById('radius-container'),
  radiusSelect: document.getElementById('radius-select'),
  sortContainer: document.getElementById('sort-container'),
  sortSelect: document.getElementById('sort-select'),
  priceFilter: document.getElementById('price-filter'),
  rateModeSelect: document.getElementById('rate-mode-select'),
  btnToggleRecommendations: document.getElementById('btn-toggle-recommendations'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  mapPickerBanner: document.getElementById('map-picker-banner'),
  btnCancelPicker: document.getElementById('btn-cancel-picker'),
  bestValuePanel: document.getElementById('best-value-panel'),
  bestValueTitle: document.getElementById('best-value-title'),
  bestValueCountBadge: document.getElementById('best-value-count-badge'),
  bestValueCloseBtn: document.getElementById('best-value-close-btn'),
  bestValueList: document.getElementById('best-value-list'),
  locationsDialog: document.getElementById('locations-dialog'),
  locationsCloseBtn: document.getElementById('locations-close-btn'),
  locationsCountBadge: document.getElementById('locations-count-badge'),
  locationsTableBody: document.getElementById('locations-table-body'),
  newLocName: document.getElementById('new-loc-name'),
  newLocAddress: document.getElementById('new-loc-address'),
  btnSearchAddress: document.getElementById('btn-search-address'),
  btnPickMap: document.getElementById('btn-pick-map'),
  btnUseGps: document.getElementById('btn-use-gps'),
  btnSaveLocation: document.getElementById('btn-save-location'),
  newLocStatusMsg: document.getElementById('new-loc-status-msg'),
};

/**
 * Coordinate Conversion: Web Mercator (EPSG:3857) to WGS84 Lat/Lng (EPSG:4326)
 */
function webMercatorToLatLng(x, y) {
  const lng = (x / 20037508.342789244) * 180;
  let lat = (y / 20037508.342789244) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lat, lng];
}

/**
 * Normalize coordinate pair to [lat, lng]
 */
function normalizeCoord(pair) {
  const x = pair[0];
  const y = pair[1];
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    return webMercatorToLatLng(x, y);
  }
  return [y, x];
}

/**
 * Midpoint along a polyline for pin placement
 */
function getPolylineMidpoint(latLngs) {
  if (!latLngs || latLngs.length === 0) return [51.0447, -114.0719];
  if (latLngs.length === 1) return latLngs[0];
  
  let totalDist = 0;
  const dists = [0];
  for (let i = 0; i < latLngs.length - 1; i++) {
    const p1 = latLngs[i];
    const p2 = latLngs[i + 1];
    totalDist += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    dists.push(totalDist);
  }
  
  const halfDist = totalDist / 2;
  for (let i = 0; i < dists.length - 1; i++) {
    if (halfDist >= dists[i] && halfDist <= dists[i + 1]) {
      const segLen = dists[i + 1] - dists[i];
      const ratio = segLen === 0 ? 0 : (halfDist - dists[i]) / segLen;
      return [
        latLngs[i][0] + (latLngs[i + 1][0] - latLngs[i][0]) * ratio,
        latLngs[i][1] + (latLngs[i + 1][1] - latLngs[i][1]) * ratio
      ];
    }
  }
  return latLngs[Math.floor(latLngs.length / 2)];
}

/**
 * Rate Engine: Parse Calgary Schedules & Determine Live / Peak Rates
 */
function getCalgaryNow() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: 'America/Edmonton',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const [hourStr, minStr] = timeStr.split(':');
  const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

  const dayStr = now.toLocaleDateString('en-US', {
    timeZone: 'America/Edmonton',
    weekday: 'short'
  });

  return {
    dayStr,
    currentMinutes,
    timeStr,
    isSunday: dayStr === 'Sun',
    isSaturday: dayStr === 'Sat',
    isWeekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(dayStr)
  };
}

function parseTimeRangeToMinutes(timeStr) {
  const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;

  let h1 = parseInt(m[1], 10);
  const min1 = parseInt(m[2], 10);
  const p1 = m[3].toUpperCase();
  if (p1 === 'PM' && h1 !== 12) h1 += 12;
  if (p1 === 'AM' && h1 === 12) h1 = 0;

  let h2 = parseInt(m[4], 10);
  const min2 = parseInt(m[5], 10);
  const p2 = m[6].toUpperCase();
  if (p2 === 'PM' && h2 !== 12) h2 += 12;
  if (p2 === 'AM' && h2 === 12) h2 = 0;

  return {
    start: h1 * 60 + min1,
    end: h2 * 60 + min2
  };
}

function parseZoneRateSchedule(htmlRates, enforceableTime) {
  const defaultRes = {
    currentRate: 0,
    isCurrentlyFree: true,
    isNoParking: false,
    currentSlotLabel: 'Outside Enforceable Hours / Free',
    minRate: 0,
    maxRate: 0,
    intervals: []
  };

  if (!htmlRates || !htmlRates.trim()) {
    return defaultRes;
  }

  const clean = htmlRates
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '')
    .trim();

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const intervals = [];
  const prices = [];
  let hasFreeRule = false;

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i];
    const rateText = lines[i + 1] || '';

    const priceMatch = rateText.match(/\$([0-9]+(?:\.[0-9]{2})?)/);
    const isFree = /free/i.test(rateText) || /free/i.test(header);
    const isNoParking = /no parking/i.test(rateText) || /no parking/i.test(header);

    let price = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      prices.push(price);
    } else if (isFree) {
      price = 0;
      hasFreeRule = true;
    }

    let appliesDays = 'all';
    const hLower = header.toLowerCase();
    if (hLower.includes('mon-fri') || hLower.includes('mon to fri')) {
      appliesDays = 'weekday';
    } else if (hLower.includes('saturday')) {
      appliesDays = 'saturday';
    } else if (hLower.includes('sunday') || hLower.includes('holiday')) {
      appliesDays = 'sunday';
    }

    const timeRange = parseTimeRangeToMinutes(header);

    intervals.push({
      header,
      rateText,
      price,
      isFree,
      isNoParking,
      appliesDays,
      timeRange
    });
  }

  const minRate = prices.length > 0 ? Math.min(...prices) : (hasFreeRule ? 0 : 0);
  const maxRate = prices.length > 0 ? Math.max(...prices) : (hasFreeRule ? 0 : 0);

  const calgary = getCalgaryNow();

  if (calgary.isSunday) {
    return {
      currentRate: 0,
      isCurrentlyFree: true,
      isNoParking: false,
      currentSlotLabel: 'Sunday (Free Parking)',
      minRate,
      maxRate,
      intervals
    };
  }

  let matchedInterval = null;
  for (const inv of intervals) {
    let dayMatch = false;
    if (inv.appliesDays === 'weekday' && calgary.isWeekday) dayMatch = true;
    else if (inv.appliesDays === 'saturday' && calgary.isSaturday) dayMatch = true;
    else if (inv.appliesDays === 'all') dayMatch = true;

    if (dayMatch && inv.timeRange) {
      if (calgary.currentMinutes >= inv.timeRange.start && calgary.currentMinutes < inv.timeRange.end) {
        matchedInterval = inv;
        break;
      }
    }
  }

  if (matchedInterval) {
    return {
      currentRate: matchedInterval.price !== null ? matchedInterval.price : 0,
      isCurrentlyFree: matchedInterval.isFree || matchedInterval.price === 0,
      isNoParking: matchedInterval.isNoParking,
      currentSlotLabel: `${matchedInterval.header}: ${matchedInterval.rateText}`,
      minRate,
      maxRate,
      intervals
    };
  }

  return {
    currentRate: 0,
    isCurrentlyFree: true,
    isNoParking: false,
    currentSlotLabel: 'After Hours (Free Parking)',
    minRate,
    maxRate,
    intervals
  };
}

function getPriceBadgeHtml(rateInfo, rateMode = 'live') {
  if (!rateInfo) {
    return `<span class="badge-rate-free px-2 py-0.5 rounded text-[10px] font-bold">FREE</span>`;
  }

  const rate = rateMode === 'live' ? rateInfo.currentRate : rateInfo.maxRate;
  const isFree = rateMode === 'live' ? rateInfo.isCurrentlyFree : rate === 0;

  if (isFree || rate === 0) {
    return `<span class="badge-rate-free px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><span>FREE</span>${rateMode === 'live' ? '<span class="text-[9px] opacity-75">NOW</span>' : ''}</span>`;
  }

  let colorClass = 'badge-rate-low';
  if (rate >= 4) colorClass = 'badge-rate-high';
  else if (rate >= 2.5) colorClass = 'badge-rate-med';

  return `<span class="${colorClass} px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><span>$${rate.toFixed(2)}/hr</span>${rateMode === 'live' ? '<span class="text-[9px] opacity-75">NOW</span>' : '<span class="text-[9px] opacity-75">PEAK</span>'}</span>`;
}

/**
 * ============================================================================
 * Historical & Time-of-Day Parking Price Engine & Visualizations
 * ============================================================================
 */

function generate24HourProfile(rateInfo, dayType = 'weekday') {
  const profile = [];
  const intervals = (rateInfo && rateInfo.intervals) ? rateInfo.intervals : [];

  for (let hour = 0; hour < 24; hour++) {
    const currentMin = hour * 60 + 30; // Mid-hour checkpoint
    let rate = 0;
    let isRestricted = false;
    let label = 'Free Parking (Off-Peak)';

    if (dayType === 'sunday') {
      rate = 0;
      label = 'Free Parking';
    } else {
      let match = null;
      for (const inv of intervals) {
        let dayMatch = false;
        if (inv.appliesDays === 'weekday' && dayType === 'weekday') dayMatch = true;
        else if (inv.appliesDays === 'saturday' && dayType === 'saturday') dayMatch = true;
        else if (inv.appliesDays === 'all') dayMatch = true;

        if (dayMatch && inv.timeRange) {
          if (currentMin >= inv.timeRange.start && currentMin < inv.timeRange.end) {
            match = inv;
            break;
          }
        }
      }

      if (match) {
        if (match.isNoParking) {
          rate = null;
          isRestricted = true;
          label = 'No Parking (Restriction)';
        } else {
          rate = match.price !== null ? match.price : 0;
          label = rate === 0 ? 'Free Parking' : `$${rate.toFixed(2)}/hr`;
        }
      } else {
        rate = 0;
        label = 'Free Parking (Off-Peak)';
      }
    }

    const hourDisplay = hour % 12 === 0 ? 12 : hour % 12;
    const meridian = hour >= 12 ? 'PM' : 'AM';
    profile.push({
      hour,
      hourLabel: `${hourDisplay} ${meridian}`,
      rate,
      isRestricted,
      label
    });
  }

  return profile;
}

function recordPriceSnapshot(zones) {
  if (!zones || zones.length === 0) return;
  try {
    const raw = localStorage.getItem('cpa_price_snapshots');
    let snapshots = raw ? JSON.parse(raw) : [];

    const now = Date.now();
    // Throttle automatic snapshots to at least 15 minutes apart
    if (snapshots.length > 0 && (now - snapshots[snapshots.length - 1].timestamp) < 15 * 60 * 1000) {
      return;
    }

    const snapshotMap = {};
    zones.forEach(z => {
      const peak = z.rateInfo ? z.rateInfo.maxRate : 0;
      snapshotMap[z.zoneNumber] = {
        peak,
        tier: z.priceZone
      };
    });

    snapshots.push({
      timestamp: now,
      dateStr: new Date(now).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      count: zones.length,
      rates: snapshotMap
    });

    if (snapshots.length > 30) {
      snapshots = snapshots.slice(snapshots.length - 30);
    }

    localStorage.setItem('cpa_price_snapshots', JSON.stringify(snapshots));
  } catch (e) {
    console.warn('Failed to record price snapshot:', e);
  }
}

function getZoneHistoricalData(zone) {
  const priceTier = String(zone.priceZone || '4').toLowerCase().replace(/[^0-9]/g, '') || '4';
  const tierNum = parseInt(priceTier, 10) || 4;
  const currentMax = (zone.rateInfo && zone.rateInfo.maxRate > 0) 
    ? zone.rateInfo.maxRate 
    : (tierNum >= 7 ? 4.50 : tierNum >= 4 ? 3.75 : 2.50);

  // Baseline demand-adjusted rate history (City of Calgary ParkPlus rate framework 2023 - 2026)
  const baseline = [
    { period: '2023 Q1', rate: Math.max(1.0, +(currentMax - 0.75).toFixed(2)), note: 'Pandemic Recovery Pricing' },
    { period: '2023 Q3', rate: Math.max(1.0, +(currentMax - 0.50).toFixed(2)), note: 'Occupancy Review' },
    { period: '2024 Q1', rate: Math.max(1.0, +(currentMax - 0.50).toFixed(2)), note: 'Annual Rate Revision' },
    { period: '2024 Q3', rate: Math.max(1.0, +(currentMax - 0.25).toFixed(2)), note: 'Demand Balancing Tier Adjustment' },
    { period: '2025 Q1', rate: Math.max(1.0, +(currentMax - 0.25).toFixed(2)), note: 'Semi-Annual Policy Update' },
    { period: '2025 Q3', rate: currentMax, note: 'Core District Optimization' },
    { period: '2026 Q1', rate: currentMax, note: 'Current Active Schedule' }
  ];

  let localSnapshots = [];
  try {
    const raw = localStorage.getItem('cpa_price_snapshots');
    if (raw) {
      const all = JSON.parse(raw);
      all.forEach(snap => {
        if (snap.rates && snap.rates[zone.zoneNumber] !== undefined) {
          localSnapshots.push({
            period: snap.dateStr,
            rate: snap.rates[zone.zoneNumber].peak,
            note: 'Local Sync Snapshot',
            timestamp: snap.timestamp
          });
        }
      });
    }
  } catch (e) {
    console.warn('Error reading local snapshots:', e);
  }

  const initialRate = baseline[0].rate;
  const netChange = +(currentMax - initialRate).toFixed(2);
  const percentChange = initialRate > 0 ? ((netChange / initialRate) * 100).toFixed(1) : '0';

  return {
    tier: zone.priceZone,
    currentPeak: currentMax,
    initialPeak: initialRate,
    netChange,
    percentChange,
    baselinePoints: baseline,
    localSnapshots,
    combinedPoints: [...baseline, ...localSnapshots]
  };
}

function getChartThemeColors() {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    isDark,
    text: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.12)',
    tooltipBg: isDark ? '#0f172a' : '#ffffff',
    tooltipText: isDark ? '#f8fafc' : '#0f172a',
    tooltipBorder: isDark ? '#334155' : '#e2e8f0',
    primaryLine: isDark ? '#60a5fa' : '#2563eb',
    primaryFill: isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(37, 99, 235, 0.12)',
    historyLine: isDark ? '#34d399' : '#059669',
    historyFill: isDark ? 'rgba(52, 211, 153, 0.2)' : 'rgba(5, 150, 105, 0.12)'
  };
}

function destroyCharts() {
  if (state.scheduleChart) {
    state.scheduleChart.destroy();
    state.scheduleChart = null;
  }
  if (state.historyChart) {
    state.historyChart.destroy();
    state.historyChart = null;
  }
}

function updateAllChartsTheme() {
  if (state.selectedZone) {
    if (state.activeTab === 'rates' && state.scheduleChart) {
      renderScheduleChart(state.selectedZone, state.scheduleDayType);
    } else if (state.activeTab === 'history' && state.historyChart) {
      renderHistoryChart(state.selectedZone);
    }
  }
}

function renderScheduleChart(zone, dayType = 'weekday') {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('schedule-chart');
  if (!canvas) return;

  state.scheduleDayType = dayType;

  // Sync active day pill classes
  ['weekday', 'saturday', 'sunday'].forEach(dt => {
    const pill = document.getElementById(`pill-day-${dt}`);
    if (pill) {
      pill.classList.toggle('active', dt === dayType);
    }
  });

  if (state.scheduleChart) {
    state.scheduleChart.destroy();
    state.scheduleChart = null;
  }

  const profile = generate24HourProfile(zone.rateInfo, dayType);
  const theme = getChartThemeColors();
  const labels = profile.map(p => p.hourLabel);
  const data = profile.map(p => p.rate);

  const maxDayRate = Math.max(...data.filter(r => r !== null), 0);
  const statMax = document.getElementById('chart-stat-peak');
  if (statMax) statMax.textContent = maxDayRate > 0 ? `$${maxDayRate.toFixed(2)}/hr` : 'Free';

  state.scheduleChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hourly Rate ($/hr)',
        data,
        stepped: 'before',
        borderColor: theme.primaryLine,
        backgroundColor: theme.primaryFill,
        borderWidth: 2,
        fill: true,
        pointRadius: 2.5,
        pointHoverRadius: 6,
        pointBackgroundColor: (ctx) => {
          const val = data[ctx.dataIndex];
          return val === null ? '#ef4444' : theme.primaryLine;
        },
        pointBorderColor: theme.isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 1.5,
        spanGaps: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 8,
          boxPadding: 4,
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const nextHour = (idx + 1) % 12 === 0 ? 12 : (idx + 1) % 12;
              const nextMeridian = (idx + 1 >= 12 && idx + 1 < 24) ? 'PM' : 'AM';
              return `${labels[idx]} – ${nextHour} ${nextMeridian}`;
            },
            label: (ctx) => {
              const val = ctx.raw;
              if (val === null) return '⛔ Restriction: No Parking';
              if (val === 0) return '🆓 Free Parking ($0.00/hr)';
              return `💲 Rate: $${val.toFixed(2)} per hour`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { size: 10, family: 'Inter, sans-serif' },
            maxRotation: 0,
            callback: function(val, index) {
              return index % 3 === 0 ? labels[index] : '';
            }
          }
        },
        y: {
          min: 0,
          suggestedMax: Math.max(5, maxDayRate + 0.5),
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { size: 10, family: 'Inter, sans-serif' },
            callback: (v) => `$${v.toFixed(2)}`
          }
        }
      }
    }
  });
}

function renderHistoryChart(zone) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('history-chart');
  if (!canvas) return;

  if (state.historyChart) {
    state.historyChart.destroy();
    state.historyChart = null;
  }

  const history = getZoneHistoricalData(zone);
  const theme = getChartThemeColors();
  const labels = history.combinedPoints.map(p => p.period);
  const data = history.combinedPoints.map(p => p.rate);

  state.historyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Peak Daytime Rate ($/hr)',
        data,
        borderColor: theme.historyLine,
        backgroundColor: theme.historyFill,
        borderWidth: 2.5,
        fill: true,
        tension: 0.25,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: theme.historyLine,
        pointBorderColor: theme.isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.tooltipText,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 8,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => {
              const pt = history.combinedPoints[ctx.dataIndex];
              return [
                `💲 Peak Rate: $${ctx.raw.toFixed(2)}/hr`,
                pt && pt.note ? `ℹ️ ${pt.note}` : ''
              ].filter(Boolean);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { size: 10, family: 'Inter, sans-serif' }
          }
        },
        y: {
          min: 0,
          suggestedMax: Math.max(...data, 4) + 0.75,
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { size: 10, family: 'Inter, sans-serif' },
            callback: (v) => `$${v.toFixed(2)}`
          }
        }
      }
    }
  });
}

function changeScheduleDay(dayType) {
  state.scheduleDayType = dayType;
  if (state.selectedZone) {
    renderScheduleChart(state.selectedZone, dayType);
  }
}

function takeSnapshotNow() {
  if (!state.selectedZone) return;
  const now = Date.now();
  const dateStr = new Date(now).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  try {
    const raw = localStorage.getItem('cpa_price_snapshots');
    let snapshots = raw ? JSON.parse(raw) : [];
    const peak = state.selectedZone.rateInfo ? state.selectedZone.rateInfo.maxRate : 0;
    
    snapshots.push({
      timestamp: now,
      dateStr,
      count: state.parsedZones.length,
      rates: {
        [state.selectedZone.zoneNumber]: {
          peak,
          tier: state.selectedZone.priceZone
        }
      }
    });

    if (snapshots.length > 30) snapshots = snapshots.slice(snapshots.length - 30);
    localStorage.setItem('cpa_price_snapshots', JSON.stringify(snapshots));

    renderDetailsSheet(state.selectedZone);
    switchTab('history');
  } catch (e) {
    console.warn('Failed to save snapshot:', e);
  }
}

function clearLocalHistory() {
  try {
    localStorage.removeItem('cpa_price_snapshots');
    if (state.selectedZone) {
      renderDetailsSheet(state.selectedZone);
      switchTab('history');
    }
  } catch (e) {
    console.warn('Failed to clear snapshots:', e);
  }
}

/**
 * Custom Locations Management
 */
const DEFAULT_LOCATIONS = [
  {
    id: 'loc-office-downtown',
    name: 'Downtown Office',
    address: '8th Ave SW & 4th St SW, Calgary',
    lat: 51.0458,
    lng: -114.0715
  },
  {
    id: 'loc-stephen-ave',
    name: 'Stephen Avenue Walk',
    address: 'Stephen Ave & Centre St, Calgary',
    lat: 51.0449,
    lng: -114.0628
  }
];

function initCustomLocations() {
  try {
    const stored = localStorage.getItem('cpa_custom_locations');
    if (stored) {
      state.customLocations = JSON.parse(stored);
    } else {
      state.customLocations = [...DEFAULT_LOCATIONS];
      saveCustomLocations();
    }
  } catch (e) {
    console.warn('Failed to read custom locations from localStorage:', e);
    state.customLocations = [...DEFAULT_LOCATIONS];
  }

  renderLocationsDropdown();
  renderLocationsTable();
}

function saveCustomLocations() {
  try {
    localStorage.setItem('cpa_custom_locations', JSON.stringify(state.customLocations));
  } catch (e) {
    console.warn('Failed to save custom locations:', e);
  }
  renderLocationsDropdown();
  renderLocationsTable();
}

function renderLocationsDropdown() {
  if (!elements.locationSelect) return;
  const currentVal = state.activeLocationId || 'NONE';
  elements.locationSelect.innerHTML = '<option value="NONE">All Calgary (No Target)</option>';
  
  state.customLocations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = `📍 ${loc.name}`;
    elements.locationSelect.appendChild(opt);
  });

  elements.locationSelect.value = state.customLocations.some(l => l.id === currentVal) ? currentVal : 'NONE';
}

function renderLocationsTable() {
  if (!elements.locationsTableBody) return;
  elements.locationsTableBody.innerHTML = '';
  
  if (elements.locationsCountBadge) {
    elements.locationsCountBadge.textContent = `${state.customLocations.length} saved`;
  }

  if (state.customLocations.length === 0) {
    elements.locationsTableBody.innerHTML = `
      <tr>
        <td colspan="3" class="py-6 text-center text-muted-foreground italic">
          No custom locations saved yet. Use the form below to add your office, home, or frequent spots!
        </td>
      </tr>
    `;
    return;
  }

  state.customLocations.forEach(loc => {
    const isActive = state.activeLocationId === loc.id;
    const tr = document.createElement('tr');
    tr.className = `hover:bg-muted/40 transition-colors ${isActive ? 'bg-primary/5 font-medium' : ''}`;
    
    tr.innerHTML = `
      <td class="py-2.5 px-3">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40'}"></span>
          <span class="font-semibold text-foreground">${loc.name}</span>
          ${isActive ? '<span class="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Active</span>' : ''}
        </div>
      </td>
      <td class="py-2.5 px-3">
        <div class="flex flex-col">
          <span class="text-foreground truncate max-w-[200px]" title="${loc.address}">${loc.address}</span>
          <span class="text-[10px] text-muted-foreground font-mono">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</span>
        </div>
      </td>
      <td class="py-2.5 px-3 text-right">
        <div class="flex items-center justify-end gap-1.5">
          ${!isActive ? `
            <button 
              onclick="window.cpaApp.setActiveLocation('${loc.id}')"
              class="h-7 px-2 rounded border border-input bg-background hover:bg-accent text-foreground text-[11px] font-medium shadow-sm"
              title="Set as target for closest + cheapest search"
            >
              Set Target
            </button>
          ` : `
            <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-1">Selected</span>
          `}
          <button 
            onclick="window.cpaApp.zoomToCustomLocation('${loc.id}')"
            class="h-7 w-7 rounded border border-input bg-background hover:bg-accent text-foreground flex items-center justify-center text-xs shadow-sm"
            title="View on Map"
          >
            <i data-lucide="crosshair" class="h-3.5 w-3.5"></i>
          </button>
          <button 
            onclick="window.cpaApp.deleteCustomLocation('${loc.id}')"
            class="h-7 w-7 rounded border border-input bg-background hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center text-xs shadow-sm transition-colors"
            title="Delete this location"
          >
            <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
          </button>
        </div>
      </td>
    `;
    elements.locationsTableBody.appendChild(tr);
  });

  refreshIcons();
}

function setActiveLocation(locId) {
  state.activeLocationId = locId;
  const loc = state.customLocations.find(l => l.id === locId) || null;
  state.activeLocation = loc;

  if (elements.locationSelect) {
    elements.locationSelect.value = locId;
  }

  if (loc) {
    elements.radiusContainer.classList.remove('hidden');
    elements.radiusContainer.classList.add('flex');
    elements.sortContainer.classList.remove('hidden');
    elements.sortContainer.classList.add('flex');
    elements.btnToggleRecommendations.classList.remove('hidden');
    state.showBestValuePanel = true;
    
    renderTargetLocationOnMap(loc);
    if (elements.map) {
      elements.map.setView([loc.lat, loc.lng], 15);
    }
  } else {
    elements.radiusContainer.classList.add('hidden');
    elements.radiusContainer.classList.remove('flex');
    elements.sortContainer.classList.add('hidden');
    elements.sortContainer.classList.remove('flex');
    elements.btnToggleRecommendations.classList.add('hidden');
    elements.bestValuePanel.classList.add('hidden');
    
    if (state.targetMarker) {
      elements.map.removeLayer(state.targetMarker);
      state.targetMarker = null;
    }
    if (state.radiusCircle) {
      elements.map.removeLayer(state.radiusCircle);
      state.radiusCircle = null;
    }
  }

  renderLocationsTable();
  applyFilterAndRender();
}

function renderTargetLocationOnMap(loc) {
  if (!elements.map || !loc) return;

  const latLng = [loc.lat, loc.lng];

  if (state.targetMarker) {
    state.targetMarker.setLatLng(latLng);
  } else {
    const targetIcon = L.divIcon({
      className: 'custom-target-marker',
      html: `
        <div class="target-marker-wrapper" title="${loc.name}">
          <div class="target-marker-pulse"></div>
          <div class="target-marker-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });

    state.targetMarker = L.marker(latLng, { icon: targetIcon, zIndexOffset: 1000 }).addTo(elements.map);
    state.targetMarker.bindPopup(`
      <div class="p-3 flex flex-col gap-1 min-w-[180px]">
        <div class="flex items-center gap-1.5 text-xs font-bold text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>Target Destination</span>
        </div>
        <div class="text-sm font-semibold text-foreground">${loc.name}</div>
        <div class="text-xs text-muted-foreground">${loc.address}</div>
      </div>
    `);
  }

  const radius = state.maxRadius === 'ALL' ? 0 : Number(state.maxRadius);
  if (state.radiusCircle) {
    if (radius > 0) {
      state.radiusCircle.setLatLng(latLng);
      state.radiusCircle.setRadius(radius);
      if (!elements.map.hasLayer(state.radiusCircle)) {
        elements.map.addLayer(state.radiusCircle);
      }
    } else {
      elements.map.removeLayer(state.radiusCircle);
    }
  } else if (radius > 0) {
    state.radiusCircle = L.circle(latLng, {
      radius: radius,
      color: '#3b82f6',
      weight: 2,
      opacity: 0.6,
      dashArray: '6, 6',
      fillColor: '#3b82f6',
      fillOpacity: 0.08
    }).addTo(elements.map);
  }
}

async function geocodeAddress(query) {
  if (!query || query.trim().length < 2) return null;
  const statusEl = elements.newLocStatusMsg;
  if (statusEl) {
    statusEl.className = 'text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1';
    statusEl.innerHTML = '<span class="animate-spin inline-block h-3 w-3 border-2 border-current border-t-transparent rounded-full"></span> Searching address in Calgary...';
    statusEl.classList.remove('hidden');
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Calgary, Alberta')}&limit=1&viewbox=-114.35,51.25,-113.85,50.85&bounded=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const match = data[0];
      const lat = parseFloat(match.lat);
      const lng = parseFloat(match.lon);
      const shortAddr = match.display_name.split(',').slice(0, 3).join(',');
      if (statusEl) {
        statusEl.className = 'text-[11px] text-emerald-600 dark:text-emerald-400';
        statusEl.textContent = `✓ Found: ${shortAddr}`;
      }
      return { lat, lng, display: shortAddr };
    } else {
      if (statusEl) {
        statusEl.className = 'text-[11px] text-rose-500';
        statusEl.textContent = 'No matching Calgary location found. Try adding street name or pick on map.';
      }
      return null;
    }
  } catch (err) {
    console.error('Geocoding error:', err);
    if (statusEl) {
      statusEl.className = 'text-[11px] text-rose-500';
      statusEl.textContent = 'Could not search address. You can click "Pick Point on Map" instead.';
    }
    return null;
  }
}

function startMapLocationPicker() {
  state.isPickingLocation = true;
  elements.locationsDialog.classList.remove('open');
  elements.mapPickerBanner.classList.remove('hidden');
  if (elements.map) {
    elements.map.getContainer().style.cursor = 'crosshair';
  }
}

function cancelMapLocationPicker() {
  state.isPickingLocation = false;
  elements.mapPickerBanner.classList.add('hidden');
  if (elements.map) {
    elements.map.getContainer().style.cursor = '';
  }
  elements.locationsDialog.classList.add('open');
}

function onMapClickPickLocation(latlng) {
  if (!state.isPickingLocation) return;
  state.isPickingLocation = false;
  elements.mapPickerBanner.classList.add('hidden');
  if (elements.map) {
    elements.map.getContainer().style.cursor = '';
  }

  const coordStr = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  if (elements.newLocAddress) {
    elements.newLocAddress.value = coordStr;
  }
  if (!elements.newLocName.value.trim()) {
    elements.newLocName.value = 'My Office';
  }

  if (elements.newLocStatusMsg) {
    elements.newLocStatusMsg.className = 'text-[11px] text-emerald-600 dark:text-emerald-400';
    elements.newLocStatusMsg.textContent = `✓ Coordinates set from map: ${coordStr}`;
    elements.newLocStatusMsg.classList.remove('hidden');
  }

  elements.locationsDialog.classList.add('open');
}

function handleAddNewLocation() {
  const name = elements.newLocName.value.trim();
  const addressQuery = elements.newLocAddress.value.trim();
  const statusEl = elements.newLocStatusMsg;

  if (!name) {
    if (statusEl) {
      statusEl.className = 'text-[11px] text-rose-500';
      statusEl.textContent = 'Please enter a location name (e.g. My Office).';
      statusEl.classList.remove('hidden');
    }
    elements.newLocName.focus();
    return;
  }

  if (!addressQuery) {
    if (statusEl) {
      statusEl.className = 'text-[11px] text-rose-500';
      statusEl.textContent = 'Please enter an address or click "Pick Point on Map".';
      statusEl.classList.remove('hidden');
    }
    elements.newLocAddress.focus();
    return;
  }

  const coordMatch = addressQuery.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[3]);
    createAndSaveLocation(name, addressQuery, lat, lng);
    return;
  }

  geocodeAddress(addressQuery).then(res => {
    if (res) {
      createAndSaveLocation(name, res.display, res.lat, res.lng);
    }
  });
}

function createAndSaveLocation(name, address, lat, lng) {
  const newLoc = {
    id: 'loc-' + Date.now(),
    name,
    address,
    lat,
    lng
  };

  state.customLocations.push(newLoc);
  saveCustomLocations();

  elements.newLocName.value = '';
  elements.newLocAddress.value = '';
  if (elements.newLocStatusMsg) {
    elements.newLocStatusMsg.className = 'text-[11px] text-emerald-600 dark:text-emerald-400';
    elements.newLocStatusMsg.textContent = `✓ Successfully added "${name}" as a custom location row!`;
    elements.newLocStatusMsg.classList.remove('hidden');
  }

  setActiveLocation(newLoc.id);
}

function deleteCustomLocation(id) {
  state.customLocations = state.customLocations.filter(l => l.id !== id);
  if (state.activeLocationId === id) {
    setActiveLocation('NONE');
  } else {
    saveCustomLocations();
  }
}

function zoomToCustomLocation(id) {
  const loc = state.customLocations.find(l => l.id === id);
  if (loc && elements.map) {
    setActiveLocation(loc.id);
    elements.locationsDialog.classList.remove('open');
    elements.map.setView([loc.lat, loc.lng], 16);
    if (state.targetMarker) state.targetMarker.openPopup();
  }
}

/**
 * Initialize Theme (Dark/Light)
 */
function initTheme() {
  applyTheme(state.theme);
  
  elements.themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('cpa_theme', state.theme);
    applyTheme(state.theme);
  });
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);

  if (elements.themeIcon) {
    elements.themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
  }

  // Sync map tile layer with theme if map is loaded
  if (elements.map && elements.tileLayers.positron && elements.tileLayers.dark) {
    if (isDark && elements.map.hasLayer(elements.tileLayers.positron)) {
      elements.map.removeLayer(elements.tileLayers.positron);
      elements.map.addLayer(elements.tileLayers.dark);
    } else if (!isDark && elements.map.hasLayer(elements.tileLayers.dark)) {
      elements.map.removeLayer(elements.tileLayers.dark);
      elements.map.addLayer(elements.tileLayers.positron);
    }
  }

  updateAllChartsTheme();
  refreshIcons();
}

/**
 * Initialize Leaflet Map
 */
function initMap() {
  elements.map = L.map('map', {
    center: [51.0465, -114.068],
    zoom: 14,
    zoomControl: false,
  });

  L.control.zoom({ position: 'topleft' }).addTo(elements.map);

  // Tile layers
  elements.tileLayers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });

  elements.tileLayers.positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  });

  elements.tileLayers.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  });

  // Default layer: OpenStreetMap Standard
  elements.tileLayers.osm.addTo(elements.map);

  L.control.layers({
    'OpenStreetMap Standard': elements.tileLayers.osm,
    'Clean Street Map (Positron)': elements.tileLayers.positron,
    'Night Map (Dark)': elements.tileLayers.dark,
  }, null, { position: 'topright' }).addTo(elements.map);

  elements.polylineLayer = L.featureGroup().addTo(elements.map);
  elements.markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 17,
    chunkedLoading: true
  }).addTo(elements.map);
  elements.markerStandardLayer = L.featureGroup();

  // Background map click clears active selection or captures picked coordinates
  elements.map.on('click', (e) => {
    if (state.isPickingLocation) {
      onMapClickPickLocation(e.latlng);
      return;
    }
    if (!e.originalEvent._handledByLayer) {
      clearSelection();
    }
  });
}

/**
/**
 * Multi-Provider Data Fetching & Normalization Engine
 */

function getPolygonCentroid(latLngs) {
  if (!latLngs || latLngs.length === 0) return [51.0447, -114.0719];
  let sumLat = 0;
  let sumLng = 0;
  latLngs.forEach(pt => {
    sumLat += pt[0];
    sumLng += pt[1];
  });
  return [sumLat / latLngs.length, sumLng / latLngs.length];
}

function renderProviderPills() {
  if (!elements.providerPillsContainer || !window.CpaProviders) return;
  elements.providerPillsContainer.innerHTML = '';

  const providers = window.CpaProviders.PROVIDERS;

  Object.values(providers).forEach(p => {
    const isEnabled = state.enabledProviders.has(p.id);
    const count = state.providerCounts[p.id] || 0;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `provider-pill ${isEnabled ? 'active' : ''}`;
    btn.style.setProperty('--provider-color', p.color);
    btn.title = `Toggle ${p.name} (${count} locations)`;

    btn.innerHTML = `
      <span class="pill-dot" style="background-color: ${p.color}"></span>
      <span class="truncate">${p.shortName}</span>
      <span class="pill-count">${count}</span>
    `;

    btn.addEventListener('click', () => {
      if (state.enabledProviders.has(p.id)) {
        state.enabledProviders.delete(p.id);
      } else {
        state.enabledProviders.add(p.id);
      }
      renderProviderPills();
      applyFilterAndRender();
    });

    elements.providerPillsContainer.appendChild(btn);
  });
}

async function fetchOnStreetZones() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(state.apiUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const json = await response.json();
    if (json.error) throw new Error(json.error.message || 'ArcGIS error');
    const rawList = json.features && Array.isArray(json.features) ? json.features : [];
    return parseOnStreetFeatures(rawList);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('On-street fetch error:', err);
    return [];
  }
}

async function fetchOffStreetParkades() {
  const url = 'https://data.calgary.ca/resource/ggxk-g2u3.json?$limit=500';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const list = await response.json();
    return parseOffStreetFeatures(list);
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Off-street parkades fetch warning:', err);
    return [];
  }
}

function fetchTransitParkAndRide() {
  const stations = (window.CpaProviders && window.CpaProviders.TRANSIT_PARK_AND_RIDE_STATIONS) || [];
  return stations.map((stn, idx) => ({
    id: `transit-${stn.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    providerId: 'calgary_transit',
    facilityType: 'PARK_AND_RIDE',
    zoneNumber: stn.name,
    name: `${stn.name} Station Park & Ride`,
    address: `${stn.name} CTrain Station, Calgary, AB`,
    blockSide: 'Transit Lot',
    zoneType: 'Transit Commuter Parking',
    stallType: 'Surface & Multi-Storey Commuter Stalls',
    zoneCapacity: stn.stalls,
    segCapacity: stn.stalls,
    zoneLength: 0,
    segLength: 0,
    status: 'Active',
    brzName: `Calgary Transit (${stn.leg} Leg)`,
    priceZone: 'Free Commuter',
    maxTime: null,
    enforceableTime: '0200-1100 (Mon-Fri Reserved Stalls)',
    htmlRates: 'FREE after 11am Mon-Fri, Weekends & Statutory Holidays',
    rateInfo: {
      currentRate: 0,
      isCurrentlyFree: true,
      isNoParking: false,
      currentSlotLabel: 'FREE after 11am & All Day Weekends/Holidays',
      minRate: 0,
      maxRate: 0,
      intervals: [
        { day: 'Mon-Fri after 11:00 AM', time: '11:00 AM to 2:00 AM', rate: '100% FREE' },
        { day: 'Weekends & Statutory Holidays', time: 'All Day', rate: '100% FREE' },
        { day: 'Mon-Fri 2:00 AM - 11:00 AM', time: 'Early Morning', rate: `Unmarked Free / Reserved (${stn.reservedFee})` }
      ]
    },
    distanceToTarget: null,
    walkingMinutes: null,
    restrictTime: 'none',
    restrictType: 'none',
    noParking: null,
    noStopping: null,
    permitZone: 'Transit Permit Required 2am-11am for Reserved Stalls',
    comments: `Dedicated Calgary Transit commuter facility with ~${stn.stalls} stalls. Free for all transit riders outside reserved morning hours.`,
    paymentApp: 'Free Commuter Parking',
    paymentUrl: 'https://www.calgarytransit.com/park-and-ride/',
    operator: 'Calgary Transit',
    lineSegments: [],
    polygonCoords: null,
    midpoint: [stn.lat, stn.lng],
    polylineLayer: null,
    markerLayer: null
  }));
}

async function fetchCommercialLots() {
  try {
    const res = await fetch('data/commercial_parking.json');
    if (!res.ok) return [];
    const list = await res.json();
    return list.map(item => ({
      id: item.id,
      providerId: item.providerId,
      facilityType: item.facilityType,
      zoneNumber: item.paymentCode || item.lotNumber,
      name: item.name,
      address: item.address,
      blockSide: 'Off-Street',
      zoneType: item.facilityType === 'PARKADE' ? 'Commercial Parkade' : 'Commercial Surface Lot',
      stallType: item.stallType || 'Standard',
      zoneCapacity: item.capacity || 100,
      segCapacity: item.capacity || 100,
      zoneLength: 0,
      segLength: 0,
      status: 'Active',
      brzName: item.address.includes('SW') ? 'Downtown SW / Beltline' : 'Downtown Core',
      priceZone: 'Commercial',
      maxTime: null,
      enforceableTime: '24/7 Pay Parking',
      htmlRates: item.ratesSummary,
      heightLimit: item.heightLimit,
      amenities: item.amenities || [],
      operator: item.operator,
      paymentApp: item.paymentApp,
      paymentUrl: item.paymentUrl,
      ratesSummary: item.ratesSummary,
      rateInfo: {
        currentRate: 4.5,
        isCurrentlyFree: false,
        isNoParking: false,
        currentSlotLabel: item.ratesSummary,
        minRate: 3.5,
        maxRate: 6.0,
        intervals: [
          { day: 'Commercial Daily/Hourly Schedule', time: 'Mon–Sun', rate: item.ratesSummary }
        ]
      },
      distanceToTarget: null,
      walkingMinutes: null,
      restrictTime: 'none',
      restrictType: 'none',
      noParking: null,
      noStopping: null,
      permitZone: null,
      comments: `Managed by ${item.operator}. Digital pay via ${item.paymentApp}.`,
      lineSegments: [],
      polygonCoords: null,
      midpoint: [item.coordinates[1], item.coordinates[0]],
      polylineLayer: null,
      markerLayer: null
    }));
  } catch (err) {
    console.warn('Commercial lots fetch warning:', err);
    return [];
  }
}

function parseOffStreetFeatures(list) {
  if (!Array.isArray(list)) return [];
  return list.map((item, idx) => {
    let polygonCoords = null;
    let midpoint = [51.0447, -114.0719];

    if (item.multipolygon && item.multipolygon.coordinates) {
      const geomType = item.multipolygon.type;
      let ring = null;
      if (geomType === 'MultiPolygon' && item.multipolygon.coordinates[0]) {
        ring = item.multipolygon.coordinates[0][0];
      } else if (geomType === 'Polygon' && item.multipolygon.coordinates[0]) {
        ring = item.multipolygon.coordinates[0];
      }
      if (Array.isArray(ring) && ring.length > 0) {
        polygonCoords = ring.map(pt => [pt[1], pt[0]]);
        midpoint = getPolygonCentroid(polygonCoords);
      }
    }

    const isParkade = (item.parking_type || '').toUpperCase() === 'PARKADE';
    const lotNum = item.lot_num || String(idx + 8000);
    const lotName = item.lot_name || `City Lot ${lotNum}`;
    const address = item.address_desc || `${lotName}, Calgary, AB`;

    return {
      id: `cpa-off-${item.globalid || lotNum || idx}`,
      providerId: 'cpa_off_street',
      facilityType: isParkade ? 'PARKADE' : 'SURFACE LOT',
      zoneNumber: lotNum,
      name: lotName,
      address: address,
      blockSide: 'Off-Street',
      zoneType: isParkade ? 'Municipal Parkade' : 'Municipal Surface Lot',
      stallType: item.stall_type || (isParkade ? 'Parkade Stalls' : 'Surface Stalls'),
      zoneCapacity: isParkade ? 350 : 120,
      segCapacity: isParkade ? 350 : 120,
      zoneLength: 0,
      segLength: 0,
      status: 'Active',
      brzName: 'City of Calgary',
      priceZone: isParkade ? 'Parkade Tier' : 'Surface Tier',
      maxTime: null,
      enforceableTime: '24/7 Pay Parking',
      htmlRates: isParkade ? 'Daytime: $3.50-$4.50/hr ($23 Max) | Evenings & Weekends: $1/half hr ($4 Max)' : 'Daytime: $2.50-$3.50/hr | Evenings/Weekends: $1.00/half hr',
      rateInfo: {
        currentRate: isParkade ? 3.5 : 2.5,
        isCurrentlyFree: false,
        isNoParking: false,
        currentSlotLabel: isParkade ? 'Daytime: $4/half hr ($23 Max) | Evenings/Weekends: $1/half hr ($4 Max)' : 'Standard Hourly & Daily Rates',
        minRate: 1.0,
        maxRate: isParkade ? 4.5 : 3.5,
        intervals: [
          { day: 'Daytime - Weekdays (6 AM - 6 PM)', time: 'Daytime', rate: isParkade ? '$4 per 1/2 hr ($23 Max)' : '$3 per 1/2 hr' },
          { day: 'Evenings (6 PM - 6 AM)', time: 'Evening', rate: '$1 per 1/2 hr ($4 Max)' },
          { day: 'Weekends & Holidays', time: 'All Day', rate: '$1 per 1/2 hr ($4 Max)' }
        ]
      },
      distanceToTarget: null,
      walkingMinutes: null,
      restrictTime: 'none',
      restrictType: 'none',
      noParking: null,
      noStopping: null,
      permitZone: null,
      comments: 'City of Calgary municipal facility. ParkPlus Pay machines and barrier access.',
      paymentApp: 'ParkPlus / Onsite',
      paymentUrl: item.home_page?.url || 'https://www.calgaryparking.com/find-parking/lots.html',
      operator: 'City of Calgary / Calgary Parking',
      lineSegments: [],
      polygonCoords: polygonCoords,
      midpoint: midpoint,
      polylineLayer: null,
      markerLayer: null
    };
  });
}

function parseOnStreetFeatures(features) {
  const zones = [];

  features.forEach((feat, index) => {
    const attrs = feat.attributes || {};
    const geom = feat.geometry || {};
    
    let paths = geom.paths;
    if (!paths && geom.coordinates) {
      paths = Array.isArray(geom.coordinates[0][0]) ? geom.coordinates : [geom.coordinates];
    }
    if (!paths || paths.length === 0) return;

    const lineSegments = [];
    paths.forEach(subPath => {
      const latLngs = subPath.map(normalizeCoord);
      if (latLngs.length > 0) lineSegments.push(latLngs);
    });
    if (lineSegments.length === 0) return;

    const mainLatLngs = lineSegments[0];
    const midpoint = getPolylineMidpoint(mainLatLngs);

    const brz = (attrs.BRZ_NAME || '').trim();
    const rateInfo = parseZoneRateSchedule(attrs.HTML_ZONE_RATE || '', attrs.ENFORCEABLE_TIME || '');

    const zoneObj = {
      id: attrs.OBJECTID || index,
      providerId: 'parkplus_on_street',
      facilityType: 'ON_STREET',
      zoneNumber: attrs.PARKING_ZONE !== undefined && attrs.PARKING_ZONE !== null ? String(attrs.PARKING_ZONE) : 'N/A',
      name: `Zone #${attrs.PARKING_ZONE || 'N/A'}`,
      address: (attrs.ADDRESS_DESC || 'Unknown Location').trim(),
      blockSide: (attrs.BLOCK_SIDE || '').trim(),
      zoneType: (attrs.ZONE_TYPE || 'Parking Zone').trim(),
      stallType: (attrs.STALL_TYPE || 'Parallel').trim(),
      zoneCapacity: attrs.ZONE_CAP || 0,
      segCapacity: attrs.SEG_CAP || 0,
      zoneLength: attrs.ZONE_LENGTH ? Math.round(attrs.ZONE_LENGTH) : 0,
      segLength: attrs.SEG_LENGTH ? Math.round(attrs.SEG_LENGTH) : 0,
      status: (attrs.STATUS || 'Active').trim(),
      brzName: brz || 'None',
      priceZone: (attrs.PRICE_ZONE || 'Standard').trim(),
      maxTime: attrs.MAX_TIME ? Number(attrs.MAX_TIME) : null,
      enforceableTime: (attrs.ENFORCEABLE_TIME || '').trim(),
      htmlRates: attrs.HTML_ZONE_RATE || '',
      rateInfo,
      distanceToTarget: null,
      walkingMinutes: null,
      restrictTime: (attrs.PARKING_RESTRICT_TIME || 'none').trim(),
      restrictType: (attrs.PARKING_RESTRICT_TYPE || 'none').trim(),
      noParking: attrs.NO_PARKING || null,
      noStopping: attrs.NO_STOPPING || null,
      permitZone: attrs.PERMIT_ZONE || null,
      comments: attrs.COMMENTS || null,
      globalId: attrs.GLOBALID || '',
      lineSegments,
      polygonCoords: null,
      midpoint,
      polylineLayer: null,
      markerLayer: null,
      paymentApp: 'ParkPlus (MyParking)',
      paymentUrl: 'https://www.calgaryparking.com/parkplus',
      operator: 'Calgary Parking Authority'
    };

    zones.push(zoneObj);
  });

  return zones;
}

/**
 * Fetch latest data from all parking providers in parallel
 */
async function fetchParkingData() {
  if (state.isLoading) return;
  
  state.isLoading = true;
  updateStatus('loading', 'Fetching multi-provider parking data...');
  if (elements.refreshIcon) elements.refreshIcon.classList.add('spin');
  if (elements.refreshBtn) elements.refreshBtn.disabled = true;

  try {
    const results = await Promise.allSettled([
      fetchOnStreetZones(),
      fetchOffStreetParkades(),
      Promise.resolve(fetchTransitParkAndRide()),
      fetchCommercialLots()
    ]);

    const onStreetZones = results[0].status === 'fulfilled' ? results[0].value : [];
    const offStreetZones = results[1].status === 'fulfilled' ? results[1].value : [];
    const transitZones = results[2].status === 'fulfilled' ? results[2].value : [];
    const commercialZones = results[3].status === 'fulfilled' ? results[3].value : [];

    const allZones = [
      ...onStreetZones,
      ...offStreetZones,
      ...transitZones,
      ...commercialZones
    ];

    state.rawFeatures = onStreetZones;
    state.parsedZones = allZones;

    // Calculate provider counts
    const counts = {};
    allZones.forEach(z => {
      counts[z.providerId] = (counts[z.providerId] || 0) + 1;
    });
    state.providerCounts = counts;

    // Extract BRZ / Area list
    const brzSet = new Set();
    allZones.forEach(z => {
      if (z.brzName && z.brzName !== 'None') brzSet.add(z.brzName);
    });

    populateBrzFilter(Array.from(brzSet).sort());
    renderProviderPills();
    applyFilterAndRender();
    if (onStreetZones.length > 0) recordPriceSnapshot(onStreetZones);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateStatus('success', `Synced ${allZones.length.toLocaleString()} locations across Calgary at ${timeStr}`);
  } catch (err) {
    console.error('Failed to fetch parking data:', err);
    updateStatus('error', `Error: ${err.message}`);
  } finally {
    state.isLoading = false;
    if (elements.refreshIcon) elements.refreshIcon.classList.remove('spin');
    if (elements.refreshBtn) elements.refreshBtn.disabled = false;
  }
}

function populateBrzFilter(brzList) {
  const currentVal = elements.brzFilter.value;
  elements.brzFilter.innerHTML = '<option value="ALL">All Areas (BRZs)</option>';
  brzList.forEach(brz => {
    const opt = document.createElement('option');
    opt.value = brz;
    opt.textContent = brz;
    elements.brzFilter.appendChild(opt);
  });
  if (brzList.includes(currentVal)) {
    elements.brzFilter.value = currentVal;
  }
}

function applyFilterAndRender() {
  const query = state.searchQuery.toLowerCase().trim();
  const brzFilter = state.currentFilterBRZ;
  const priceFilter = state.priceFilter;
  const rateMode = state.rateMode;
  const activeLoc = state.activeLocation;
  const maxRadius = state.maxRadius === 'ALL' ? Infinity : Number(state.maxRadius);

  const targetLatLng = activeLoc ? L.latLng(activeLoc.lat, activeLoc.lng) : null;

  // 1. Calculate distance and walking duration to active target destination
  state.parsedZones.forEach(zone => {
    if (targetLatLng && elements.map) {
      zone.distanceToTarget = elements.map.distance(targetLatLng, zone.midpoint);
      zone.walkingMinutes = Math.max(1, Math.round(zone.distanceToTarget / 80));
    } else {
      zone.distanceToTarget = null;
      zone.walkingMinutes = null;
    }
  });

  // 2. Filter zones by area, search, radius, price threshold, and provider
  state.filteredZones = state.parsedZones.filter(z => {
    // Multi-Provider Filter
    if (z.providerId && !state.enabledProviders.has(z.providerId)) {
      return false;
    }

    // Area (BRZ) Filter
    if (brzFilter !== 'ALL' && z.brzName !== brzFilter) return false;

    // Search Query Filter
    if (query) {
      const provider = window.CpaProviders ? window.CpaProviders.getProvider(z.providerId) : null;
      const match = z.zoneNumber.toLowerCase().includes(query) ||
                    z.address.toLowerCase().includes(query) ||
                    (z.name && z.name.toLowerCase().includes(query)) ||
                    (z.operator && z.operator.toLowerCase().includes(query)) ||
                    (provider && (provider.name.toLowerCase().includes(query) || provider.shortName.toLowerCase().includes(query))) ||
                    z.brzName.toLowerCase().includes(query);
      if (!match) return false;
    }

    // Walking Radius Filter (if target destination active)
    if (activeLoc && z.distanceToTarget !== null) {
      if (z.distanceToTarget > maxRadius) return false;
    }

    // Price Filtration
    const rateInfo = z.rateInfo;
    const effectiveRate = rateMode === 'live' ? rateInfo.currentRate : rateInfo.maxRate;
    const isFree = rateMode === 'live' ? rateInfo.isCurrentlyFree : effectiveRate === 0;

    if (priceFilter === 'free') {
      if (!isFree && effectiveRate > 0) return false;
    } else if (priceFilter !== 'ALL') {
      const maxAllowed = parseFloat(priceFilter);
      if (effectiveRate > maxAllowed) return false;
    }

    return true;
  });

  // 3. Sort zones by user selection
  if (activeLoc) {
    state.filteredZones.sort((a, b) => {
      const rateA = rateMode === 'live' ? a.rateInfo.currentRate : a.rateInfo.maxRate;
      const rateB = rateMode === 'live' ? b.rateInfo.currentRate : b.rateInfo.maxRate;
      const distA = a.distanceToTarget !== null ? a.distanceToTarget : Infinity;
      const distB = b.distanceToTarget !== null ? b.distanceToTarget : Infinity;

      if (state.sortMode === 'closest') {
        return distA - distB;
      }
      if (state.sortMode === 'cheapest') {
        if (rateA !== rateB) return rateA - rateB;
        return distA - distB;
      }
      // 'closest_cheapest' (Best Value composite ranking)
      if (state.maxRadius !== 'ALL') {
        if (rateA !== rateB) return rateA - rateB;
        return distA - distB;
      } else {
        const scoreA = (distA / 500) * 0.4 + (rateA / 4) * 0.6;
        const scoreB = (distB / 500) * 0.4 + (rateB / 4) * 0.6;
        return scoreA - scoreB;
      }
    });
  }

  renderMapFeatures();
  renderBestValuePanel();
  updateCountDisplay();
}

function renderBestValuePanel() {
  if (!elements.bestValuePanel || !elements.bestValueList) return;

  if (!state.activeLocation || !state.showBestValuePanel || state.filteredZones.length === 0) {
    elements.bestValuePanel.classList.add('hidden');
    return;
  }

  elements.bestValuePanel.classList.remove('hidden');
  elements.bestValueTitle.textContent = `Best Value Near ${state.activeLocation.name}`;
  elements.bestValueCountBadge.textContent = `${state.filteredZones.length} match${state.filteredZones.length === 1 ? '' : 'es'}`;

  const topItems = state.filteredZones.slice(0, 5);
  elements.bestValueList.innerHTML = '';

  topItems.forEach((zone, idx) => {
    const rateBadge = getPriceBadgeHtml(zone.rateInfo, state.rateMode);
    const distMeters = Math.round(zone.distanceToTarget || 0);
    const walkMins = zone.walkingMinutes || 1;

    const div = document.createElement('div');
    div.className = 'best-value-item rounded-lg border border-border bg-card p-2.5 shadow-sm cursor-pointer flex flex-col gap-1.5 hover:border-primary transition-all';
    div.innerHTML = `
      <div class="flex items-center justify-between gap-1">
        <div class="flex items-center gap-1.5">
          <span class="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px]">#${idx + 1}</span>
          <span class="font-bold text-foreground text-xs">${zone.name || 'Zone ' + zone.zoneNumber}</span>
        </div>
        ${rateBadge}
      </div>
      <div class="text-[11px] text-foreground font-medium truncate" title="${zone.address}">${zone.address}</div>
      <div class="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/50">
        <span class="flex items-center gap-1 font-semibold text-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3-2 4-2 6.5v4"/><path d="M14 20v-2.38c0-2.12-1.03-3.12-1-5.62.03-2.72 1.49-6 4.5-6 1.87 0 2.5 1.8 2.5 3.5 0 3-2 4-2 6.5v4"/></svg>
          ${distMeters}m • ~${walkMins} min walk
        </span>
        <span>${zone.zoneCapacity} stalls</span>
      </div>
    `;

    div.addEventListener('click', () => {
      selectZone(zone, false);
      if (zone.markerLayer) {
        zone.markerLayer.openPopup();
      }
      zoomToZone(zone);
    });

    elements.bestValueList.appendChild(div);
  });

  refreshIcons();
}

function zoomToZone(zone) {
  if (!elements.map || !zone) return;
  if (zone.polylineLayer && zone.polylineLayer.length > 0) {
    const group = L.featureGroup(zone.polylineLayer);
    elements.map.fitBounds(group.getBounds(), { padding: [70, 70], maxZoom: 18 });
  } else {
    elements.map.setView(zone.midpoint, 18);
  }
}

function getZoneColor(priceZone, providerId) {
  if (providerId && window.CpaProviders) {
    const p = window.CpaProviders.getProvider(providerId);
    if (p && p.id !== 'parkplus_on_street') return p.color;
  }
  const pz = String(priceZone).toLowerCase();
  if (pz === '1' || pz === '2') return '#3b82f6';
  if (pz === '3' || pz === '4' || pz.startsWith('4')) return '#06b6d4';
  if (pz === '5' || pz === '6') return '#10b981';
  if (pz === '7' || pz === '8' || pz === '9') return '#f59e0b';
  if (pz === '10' || pz === '11' || pz === '12') return '#8b5cf6';
  return '#3b82f6';
}

function renderMapFeatures() {
  elements.polylineLayer.clearLayers();
  elements.markerClusterGroup.clearLayers();
  elements.markerStandardLayer.clearLayers();

  const bounds = [];

  state.filteredZones.forEach(zone => {
    const provider = window.CpaProviders ? window.CpaProviders.getProvider(zone.providerId) : null;
    const shapeLayers = [];

    // 1A. On-Street Polylines
    if (zone.lineSegments && zone.lineSegments.length > 0) {
      const polylineColor = getZoneColor(zone.priceZone, zone.providerId);
      zone.lineSegments.forEach(segment => {
        const poly = L.polyline(segment, {
          color: polylineColor,
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        });

        poly.on('mouseover', () => poly.setStyle({ weight: 8, opacity: 1 }));
        poly.on('mouseout', () => {
          if (state.selectedZone !== zone) poly.setStyle({ weight: 5, opacity: 0.85 });
        });

        poly.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          selectZone(zone, false);
          if (zone.markerLayer) {
            zone.markerLayer.openPopup();
          }
        });

        poly.bindTooltip(`<strong>${zone.name || 'Zone ' + zone.zoneNumber}</strong><br>${zone.address}`, {
          sticky: true,
          className: 'zone-tooltip'
        });

        shapeLayers.push(poly);
        if (state.showShapes) elements.polylineLayer.addLayer(poly);
      });
    }

    // 1B. Off-Street Polygon Boundaries (City Parkades & Lots)
    if (zone.polygonCoords && zone.polygonCoords.length > 0) {
      const polygonColor = provider ? provider.color : '#2563eb';
      const poly = L.polygon(zone.polygonCoords, {
        color: polygonColor,
        weight: 2.5,
        fillColor: polygonColor,
        fillOpacity: 0.25,
        lineCap: 'round',
        lineJoin: 'round'
      });

      poly.on('mouseover', () => poly.setStyle({ weight: 4.5, fillOpacity: 0.5 }));
      poly.on('mouseout', () => {
        if (state.selectedZone !== zone) poly.setStyle({ weight: 2.5, fillOpacity: 0.25 });
      });

      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectZone(zone, false);
        if (zone.markerLayer) {
          zone.markerLayer.openPopup();
        }
      });

      poly.bindTooltip(`<strong>${zone.name || 'Zone ' + zone.zoneNumber}</strong><br>${zone.address}<br><span class="text-xs font-semibold">${provider ? provider.name : ''}</span>`, {
        sticky: true,
        className: 'zone-tooltip'
      });

      shapeLayers.push(poly);
      if (state.showShapes) elements.polylineLayer.addLayer(poly);
    }

    zone.polylineLayer = shapeLayers;

    // 2. Midpoint Pin Marker with Provider Logo
    const isSelected = state.selectedZone === zone;
    const tooltipTitle = `${zone.name || 'Zone ' + zone.zoneNumber} - ${zone.address}`;
    const customPinIcon = window.CpaProviders && window.CpaProviders.createProviderPinIcon
      ? window.CpaProviders.createProviderPinIcon(zone.providerId, tooltipTitle, isSelected)
      : L.divIcon({
          className: 'custom-pin-marker',
          html: `<div class="pin-bubble" title="${tooltipTitle}"><span>P</span></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -28]
        });

    const marker = L.marker(zone.midpoint, { icon: customPinIcon });
    marker.bindPopup(createPopupHtml(zone), { maxWidth: 300 });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      selectZone(zone, false);
    });

    zone.markerLayer = marker;

    if (state.showPins) {
      if (state.useClustering) {
        elements.markerClusterGroup.addLayer(marker);
      } else {
        elements.markerStandardLayer.addLayer(marker);
      }
    }

    bounds.push(zone.midpoint);
  });

  if ((state.searchQuery || state.currentFilterBRZ !== 'ALL') && bounds.length > 0) {
    try {
      elements.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 16 });
    } catch (e) {}
  }
}

/**
 * Popup HTML with Provider Badge, Rates, Distance & Direct Action Link
 */
function createPopupHtml(zone) {
  const provider = window.CpaProviders ? window.CpaProviders.getProvider(zone.providerId) : null;
  const providerBadge = window.CpaProviders ? window.CpaProviders.renderProviderBadge(zone.providerId, { compact: true }) : '';
  const rateBadge = getPriceBadgeHtml(zone.rateInfo, state.rateMode);
  const distanceHtml = zone.distanceToTarget !== null ? `
    <div class="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/5 rounded-md px-2 py-1 border border-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3-2 4-2 6.5v4"/><path d="M14 20v-2.38c0-2.12-1.03-3.12-1-5.62.03-2.72 1.49-6 4.5-6 1.87 0 2.5 1.8 2.5 3.5 0 3-2 4-2 6.5v4"/></svg>
      <span>${Math.round(zone.distanceToTarget)}m • ~${zone.walkingMinutes} min walk from ${state.activeLocation ? state.activeLocation.name : 'Target'}</span>
    </div>
  ` : '';

  const zoneTitle = zone.name || `Zone #${zone.zoneNumber}`;

  return `
    <div class="p-3.5 flex flex-col gap-2 min-w-[250px]">
      <div class="flex items-center justify-between gap-2">
        ${providerBadge}
        ${rateBadge}
      </div>
      <div class="font-bold text-xs text-foreground leading-snug">${zoneTitle}</div>
      <div class="text-[11px] text-muted-foreground">${zone.address}</div>
      ${distanceHtml}
      <div class="text-[11px] text-muted-foreground flex flex-col gap-0.5 border-t border-border pt-1.5 mt-0.5">
        <div><strong>Status / Rates:</strong> ${zone.rateInfo?.currentSlotLabel || 'Check signage'}</div>
        <div><strong>Capacity:</strong> ${zone.zoneCapacity} stalls • ${zone.stallType || 'Standard'}</div>
        <div><strong>Operator:</strong> ${provider ? provider.operator : 'Calgary Parking'}</div>
      </div>
      <div class="flex flex-col gap-1.5 mt-1">
        <button 
          onclick="window.cpaApp.openZoneDetails('${zone.id}')"
          class="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          <span>Full Details &amp; Rates</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        ${zone.paymentUrl ? `
          <a 
            href="${zone.paymentUrl}" 
            target="_blank" 
            rel="noopener"
            class="inline-flex w-full items-center justify-center gap-1 rounded-md border border-input bg-background hover:bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors"
          >
            <span>${zone.paymentApp ? 'Open ' + zone.paymentApp : 'Provider Website'}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Select Zone & Optionally Open Details Sheet
 */
function selectZone(zone, shouldOpenSheet = false) {
  state.selectedZone = zone;

  // Reset previously active polyline
  if (state.activePolyline) {
    state.activePolyline.forEach(p => p.setStyle({
      color: getZoneColor(p._zoneRef?.priceZone || ''),
      weight: 5,
      opacity: 0.85
    }));
  }

  // Highlight selected shape in bright amber
  if (zone.polylineLayer) {
    zone.polylineLayer.forEach(p => {
      p._zoneRef = zone;
      p.setStyle({ color: '#f59e0b', weight: 9, opacity: 1 });
      p.bringToFront();
    });
    state.activePolyline = zone.polylineLayer;
  }

  // Pin active styling
  document.querySelectorAll('.pin-active').forEach(el => el.classList.remove('pin-active'));
  if (zone.markerLayer && zone.markerLayer.getElement()) {
    zone.markerLayer.getElement().classList.add('pin-active');
  }

  renderDetailsSheet(zone);

  // Only open the vertical details sheet if explicitly requested or already open
  if (shouldOpenSheet || elements.detailsSheet.classList.contains('open')) {
    openSheet();
  }
}

/**
 * Format Enforceable Hours into clean readable badges
 */
function formatEnforceableTime(raw) {
  if (!raw) return 'Check posted street signs';
  const m = raw.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})\s*(.*)$/);
  if (m) {
    return `${m[1]}:${m[2]} - ${m[3]}:${m[4]} (${m[5]})`;
  }
  return raw;
}

/**
 * Parse HTML rates into structured cards & badges
 */
function formatHtmlRates(rawHtml) {
  if (!rawHtml || rawHtml.trim() === '') {
    return `<div class="p-4 text-xs text-muted-foreground italic">No detailed rate schedule registered for this zone. Check on-street signage.</div>`;
  }

  // Parse lines or segments
  const clean = rawHtml
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?b>/gi, '')
    .trim();

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  let html = `<div class="flex flex-col gap-2">`;

  for (let i = 0; i < lines.length; i += 2) {
    const timeSlot = lines[i];
    const rate = lines[i + 1] || '';

    const isFree = rate.toLowerCase().includes('free') || timeSlot.toLowerCase().includes('free');
    const isNoParking = rate.toLowerCase().includes('no parking') || timeSlot.toLowerCase().includes('no parking');

    let badgeClass = 'border-primary/20 bg-primary/10 text-primary';
    if (isFree) badgeClass = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    if (isNoParking) badgeClass = 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400';

    html += `
      <div class="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-xs shadow-sm">
        <span class="font-medium text-foreground">${timeSlot}</span>
        ${rate ? `<span class="inline-flex items-center rounded-md border ${badgeClass} px-2 py-0.5 font-bold">${rate}</span>` : ''}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Render Zone Details into Sheet
 */
function renderDetailsSheet(zone) {
  const provider = window.CpaProviders ? window.CpaProviders.getProvider(zone.providerId) : null;
  if (elements.sidebarProviderBadge && window.CpaProviders) {
    elements.sidebarProviderBadge.innerHTML = window.CpaProviders.renderProviderBadge(zone.providerId);
  }
  elements.sidebarZoneNum.textContent = zone.name && zone.name !== `Zone #${zone.zoneNumber}` 
    ? zone.name 
    : `Zone #${zone.zoneNumber}`;
  elements.sidebarStallBadge.textContent = zone.stallType || 'Standard';
  elements.sidebarStreet.textContent = zone.address;

  // Max Stay calculation
  let maxStayStr = 'Not Specified';
  if (zone.maxTime) {
    const hrs = Math.floor(zone.maxTime / 60);
    const mins = zone.maxTime % 60;
    maxStayStr = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins}m` : ''}` : `${mins} mins`;
  }

  const sideMap = { 'N': 'North', 'S': 'South', 'E': 'East', 'W': 'West' };
  const blockSideName = sideMap[zone.blockSide] || zone.blockSide || 'Off-Street Facility';

  // Navigation link
  elements.btnGmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${zone.midpoint[0]},${zone.midpoint[1]}`;

  // Provider Action Button
  if (elements.btnProviderAction && elements.btnProviderActionText) {
    if (zone.paymentUrl) {
      elements.btnProviderAction.classList.remove('hidden');
      elements.btnProviderAction.classList.add('inline-flex');
      elements.btnProviderAction.href = zone.paymentUrl;
      if (zone.providerId === 'impark') {
        elements.btnProviderActionText.textContent = `Pay via hangTag (${zone.zoneNumber})`;
      } else if (zone.providerId === 'indigo') {
        elements.btnProviderActionText.textContent = `Reserve / Pay on Indigo Neo`;
      } else if (zone.providerId === 'precise_parklink') {
        elements.btnProviderActionText.textContent = `Pay via Parkedin (${zone.zoneNumber})`;
      } else if (zone.providerId === 'calgary_transit') {
        elements.btnProviderActionText.textContent = `Calgary Transit Park & Ride Info`;
      } else if (zone.providerId === 'cpa_off_street') {
        elements.btnProviderActionText.textContent = `Official Rates on CalgaryParking.com`;
      } else {
        elements.btnProviderActionText.textContent = `Pay on ParkPlus / MyParking`;
      }
    } else {
      elements.btnProviderAction.classList.add('hidden');
      elements.btnProviderAction.classList.remove('inline-flex');
    }
  }

  // 1. Overview Tab Content
  const overviewHtml = `
    <div class="flex flex-col gap-3">
      
      <!-- Primary Card: Address & Facility Info -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location &amp; Facility</span>
        <div class="text-sm font-semibold text-foreground leading-snug">${zone.address}</div>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <div class="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <span class="text-muted-foreground block text-[10px] uppercase">Facility Type</span>
            <span class="font-semibold text-foreground truncate block">${zone.zoneType || 'Parking Facility'}</span>
          </div>
          <div class="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <span class="text-muted-foreground block text-[10px] uppercase">Operator</span>
            <span class="font-semibold text-foreground truncate block">${provider ? provider.operator : 'Calgary Parking'}</span>
          </div>
        </div>
      </div>

      <!-- Live Parking Rate & Target Proximity Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current Live Rate</span>
          ${getPriceBadgeHtml(zone.rateInfo, 'live')}
        </div>
        <div class="text-xs font-semibold text-foreground">${zone.rateInfo?.currentSlotLabel || 'Free parking / check posted signs'}</div>
        <div class="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
          <span>Peak Daytime Rate:</span>
          <span class="font-bold text-foreground">$${(zone.rateInfo?.maxRate || 0).toFixed(2)} / hr</span>
        </div>
        ${zone.distanceToTarget !== null ? `
          <div class="mt-1 flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs font-semibold text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3-2 4-2 6.5v4"/><path d="M14 20v-2.38c0-2.12-1.03-3.12-1-5.62.03-2.72 1.49-6 4.5-6 1.87 0 2.5 1.8 2.5 3.5 0 3-2 4-2 6.5v4"/></svg>
            <span>${Math.round(zone.distanceToTarget)}m (~${zone.walkingMinutes} min walk) from ${state.activeLocation ? state.activeLocation.name : 'Target'}</span>
          </div>
        ` : ''}
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stall Capacity</span>
          <span class="text-base font-bold text-foreground">${zone.zoneCapacity} <span class="text-xs font-normal text-muted-foreground">stalls</span></span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stall Type</span>
          <span class="text-xs font-bold text-foreground truncate">${zone.stallType || 'Standard'}</span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Area / BRZ</span>
          <span class="text-xs font-bold text-foreground truncate">${zone.brzName || 'Calgary'}</span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Category</span>
          <span class="text-xs font-bold text-foreground truncate">${provider ? provider.shortName : 'Municipal'}</span>
        </div>
      </div>

      ${zone.amenities && zone.amenities.length > 0 ? `
      <!-- Amenities & Features Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Amenities &amp; Features</span>
        <div class="flex flex-wrap gap-1.5">
          ${zone.amenities.map(a => `<span class="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">${a}</span>`).join('')}
        </div>
        ${zone.heightLimit ? `<div class="text-[11px] text-muted-foreground mt-1">Vehicle Clearance Limit: <strong class="text-foreground">${zone.heightLimit}</strong></div>` : ''}
      </div>` : ''}

      ${zone.providerId === 'calgary_transit' ? `
      <!-- Calgary Transit Commuter Policy Card -->
      <div class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 shadow-sm flex flex-col gap-1.5 text-xs">
        <span class="font-bold text-red-600 dark:text-red-400 uppercase text-[10px] tracking-wider">Calgary Transit Commuter Policy</span>
        <p class="text-foreground leading-relaxed">
          Park and Ride lots are <strong>100% FREE</strong> for all transit riders after 11:00 AM on weekdays, and completely free all day on Saturdays, Sundays, and statutory holidays!
        </p>
        <p class="text-muted-foreground text-[11px]">
          Reserved permit stalls apply between 2:00 AM and 11:00 AM Monday through Friday ($85/mo).
        </p>
      </div>` : ''}

      <!-- Enforceable Hours Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operating / Enforceable Hours</span>
        <div class="flex items-center gap-2 text-xs font-medium text-foreground">
          <i data-lucide="clock" class="h-4 w-4 text-muted-foreground shrink-0"></i>
          <span>${formatEnforceableTime(zone.enforceableTime)}</span>
        </div>
      </div>

      ${zone.permitZone ? `
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center justify-between text-xs">
        <span class="text-muted-foreground">Residential Permit Zone</span>
        <span class="font-bold text-foreground">${zone.permitZone}</span>
      </div>` : ''}

    </div>
  `;

  // 2. Rates Tab Content with 24-Hour Time-of-Day Curve
  const ratesHtml = `
    <div class="flex flex-col gap-3">
      <!-- 24-Hour Time-of-Day Hourly Rate Curve Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex flex-col">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Time-of-Day Rate Curve</span>
            <span class="text-xs font-semibold text-foreground">24-Hour Price Progression</span>
          </div>
          <!-- Day Selector Pills -->
          <div class="inline-flex items-center gap-1 bg-muted/60 p-0.5 rounded-full border border-border">
            <button id="pill-day-weekday" onclick="window.cpaApp.changeScheduleDay('weekday')" class="day-pill-btn active">Mon–Fri</button>
            <button id="pill-day-saturday" onclick="window.cpaApp.changeScheduleDay('saturday')" class="day-pill-btn">Saturday</button>
            <button id="pill-day-sunday" onclick="window.cpaApp.changeScheduleDay('sunday')" class="day-pill-btn">Sun/Holiday</button>
          </div>
        </div>

        <!-- Chart Canvas Container -->
        <div class="chart-container-box">
          <canvas id="schedule-chart"></canvas>
        </div>

        <!-- Quick Rate Badges -->
        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-border text-center">
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col items-center justify-center">
            <span class="text-[9px] uppercase text-muted-foreground mb-0.5">Current Rate</span>
            ${getPriceBadgeHtml(zone.rateInfo, 'live')}
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col items-center justify-center">
            <span class="text-[9px] uppercase text-muted-foreground mb-0.5">Peak Daytime</span>
            <span id="chart-stat-peak" class="text-xs font-bold text-foreground">${zone.rateInfo && zone.rateInfo.maxRate > 0 ? `$${zone.rateInfo.maxRate.toFixed(2)}/hr` : 'Free'}</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col items-center justify-center">
            <span class="text-[9px] uppercase text-muted-foreground mb-0.5">Off-Peak</span>
            <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">FREE</span>
          </div>
        </div>
      </div>

      <!-- Live Rates Timetable Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Rates Timetable</span>
          <span class="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Zone #${zone.zoneNumber}</span>
        </div>
        ${formatHtmlRates(zone.htmlRates)}
      </div>

      <div class="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
        <i data-lucide="info" class="h-4 w-4 shrink-0"></i>
        <span>Parking is free outside enforceable hours, on Sundays, and statutory holidays. Check posted signs for construction or emergency notices.</span>
      </div>
    </div>
  `;

  // 3. Historical Trends & Snapshots Tab Content
  const histData = getZoneHistoricalData(zone);
  const historyHtml = `
    <div class="flex flex-col gap-3">
      <!-- Multi-Year Rate History Chart Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Historical Rates (2023 – Present)</span>
            <span class="text-xs font-semibold text-foreground">Peak Daytime Rate Progression</span>
          </div>
          <span class="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">
            Tier ${zone.priceZone}
          </span>
        </div>

        <!-- Chart Canvas Container -->
        <div class="chart-container-box">
          <canvas id="history-chart"></canvas>
        </div>

        <!-- Metrics Summary Grid -->
        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-border text-center">
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col">
            <span class="text-[9px] uppercase text-muted-foreground">2023 Baseline</span>
            <span class="text-xs font-bold text-foreground">$${histData.initialPeak.toFixed(2)}/hr</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col">
            <span class="text-[9px] uppercase text-muted-foreground">Current Rate</span>
            <span class="text-xs font-bold text-primary">$${histData.currentPeak.toFixed(2)}/hr</span>
          </div>
          <div class="rounded-md border border-border bg-muted/30 p-1.5 flex flex-col">
            <span class="text-[9px] uppercase text-muted-foreground">Net Adjustment</span>
            <span class="text-xs font-bold ${histData.netChange >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">
              ${histData.netChange >= 0 ? '+' : ''}$${histData.netChange.toFixed(2)} (${histData.percentChange}%)
            </span>
          </div>
        </div>
      </div>

      <!-- Demand-Based Pricing Context Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Demand-Based Pricing Policy</span>
        <p class="text-xs text-muted-foreground leading-relaxed">
          Calgary Parking Authority adjusts on-street parking rates according to occupancy performance benchmarks. Prices in this zone are indexed to target a 65%–85% stall occupancy.
        </p>
        <div class="mt-1 flex items-center justify-between text-xs pt-2 border-t border-border">
          <span class="text-muted-foreground">Recorded Local Snapshots</span>
          <span class="font-bold text-foreground">${histData.localSnapshots.length} logged</span>
        </div>
      </div>

      <!-- Local Snapshot History Action Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Snapshot Tracking</span>
          <div class="flex items-center gap-1.5">
            <button onclick="window.cpaApp.takeSnapshotNow()" class="h-6 px-2 text-[10px] font-medium rounded border border-input bg-background hover:bg-accent text-foreground transition-colors inline-flex items-center gap-1">
              <i data-lucide="camera" class="h-3 w-3"></i>
              <span>Save Now</span>
            </button>
            ${histData.localSnapshots.length > 0 ? `
            <button onclick="window.cpaApp.clearLocalHistory()" class="h-6 px-2 text-[10px] font-medium rounded border border-destructive/20 text-destructive hover:bg-destructive/10 transition-colors inline-flex items-center gap-1">
              <i data-lucide="trash-2" class="h-3 w-3"></i>
              <span>Clear</span>
            </button>` : ''}
          </div>
        </div>

        ${histData.localSnapshots.length > 0 ? `
        <div class="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
          ${histData.localSnapshots.slice().reverse().map(snap => `
            <div class="history-snapshot-item flex items-center justify-between p-2 rounded-md border border-border bg-muted/20 text-xs">
              <div class="flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span class="font-medium text-foreground">${snap.period}</span>
              </div>
              <span class="font-bold text-foreground">$${snap.rate.toFixed(2)}/hr</span>
            </div>
          `).join('')}
        </div>
        ` : `
        <div class="text-[11px] text-muted-foreground italic py-1">
          Snapshots are captured automatically when you sync live parking data, or click "Save Now" to log an instant price checkpoint.
        </div>
        `}
      </div>
    </div>
  `;

  // 4. Rules & Restrictions Tab Content
  let restrictionContent = '';
  if (zone.restrictType && zone.restrictType.toLowerCase() !== 'none') {
    restrictionContent += `
      <div class="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1">
        <span class="font-bold uppercase tracking-wider text-[10px]">Active Parking Restriction (${zone.restrictType})</span>
        <p>${zone.restrictTime}</p>
      </div>
    `;
  }

  if (zone.noStopping || zone.noParking) {
    restrictionContent += `
      <div class="rounded-lg border-l-4 border-rose-500 bg-rose-500/10 p-3 text-xs text-rose-900 dark:text-rose-200 flex flex-col gap-1">
        <span class="font-bold uppercase tracking-wider text-[10px]">Prohibition Notices</span>
        ${zone.noStopping ? `<p><strong>No Stopping:</strong> ${zone.noStopping}</p>` : ''}
        ${zone.noParking ? `<p><strong>No Parking:</strong> ${zone.noParking}</p>` : ''}
      </div>
    `;
  }

  if (!restrictionContent) {
    restrictionContent = `
      <div class="rounded-xl border border-border bg-card p-8 shadow-sm flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
        <i data-lucide="check-circle" class="h-8 w-8 text-emerald-500"></i>
        <div class="text-sm font-semibold text-foreground">Standard Parking Regulations</div>
        <p class="text-xs">No special AM/PM tow-away rush-hour restrictions are registered for this zone.</p>
      </div>
    `;
  }

  const rulesHtml = `
    <div class="flex flex-col gap-3">
      ${restrictionContent}

      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2 text-xs">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Technical Identifiers</span>
        <div class="flex justify-between py-1 border-b border-border">
          <span class="text-muted-foreground">Database Status</span>
          <span class="font-semibold text-emerald-600 dark:text-emerald-400">${zone.status}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-border">
          <span class="text-muted-foreground">Segment Length</span>
          <span class="font-semibold text-foreground">${zone.segLength} meters (${zone.segCapacity} stalls)</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-muted-foreground">Coordinates</span>
          <span class="font-mono text-foreground">${zone.midpoint[0].toFixed(5)}, ${zone.midpoint[1].toFixed(5)}</span>
        </div>
      </div>
    </div>
  `;

  // Store in cache for tab switching
  zone._tabHtml = {
    overview: overviewHtml,
    rates: ratesHtml,
    history: historyHtml,
    rules: rulesHtml
  };

  switchTab(state.activeTab);
}

/**
 * Switch Active Tab in Sheet
 */
function switchTab(tabName) {
  state.activeTab = tabName;

  const tabButtons = {
    overview: elements.tabBtnOverview,
    rates: elements.tabBtnRates,
    history: elements.tabBtnHistory,
    rules: elements.tabBtnRules
  };

  Object.keys(tabButtons).forEach(name => {
    const btn = tabButtons[name];
    if (!btn) return;
    if (name === tabName) {
      btn.className = 'tab-trigger inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-offset-background transition-all bg-background text-foreground shadow-sm';
    } else {
      btn.className = 'tab-trigger inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-offset-background transition-all text-muted-foreground hover:text-foreground';
    }
  });

  if (state.selectedZone && state.selectedZone._tabHtml) {
    elements.sidebarContent.innerHTML = state.selectedZone._tabHtml[tabName] || state.selectedZone._tabHtml.overview;
    refreshIcons();

    if (tabName === 'rates') {
      setTimeout(() => {
        renderScheduleChart(state.selectedZone, state.scheduleDayType || 'weekday');
      }, 50);
    } else if (tabName === 'history') {
      setTimeout(() => {
        renderHistoryChart(state.selectedZone);
      }, 50);
    }
  }
}

function zoomToCurrentZone() {
  if (!state.selectedZone) return;
  const zone = state.selectedZone;
  if (zone.polylineLayer && zone.polylineLayer.length > 0) {
    const group = L.featureGroup(zone.polylineLayer);
    elements.map.fitBounds(group.getBounds(), { padding: [80, 80], maxZoom: 18 });
  } else {
    elements.map.setView(zone.midpoint, 18);
  }
  if (zone.markerLayer) zone.markerLayer.openPopup();
}

function openSheet() {
  elements.detailsSheet.classList.add('open');
  elements.sheetBackdrop.classList.add('open');
  refreshIcons();
}

function closeSheet() {
  destroyCharts();
  elements.detailsSheet.classList.remove('open');
  elements.sheetBackdrop.classList.remove('open');
}

function clearSelection() {
  destroyCharts();
  state.selectedZone = null;
  if (state.activePolyline) {
    state.activePolyline.forEach(p => p.setStyle({
      color: getZoneColor(p._zoneRef?.priceZone || ''),
      weight: 5,
      opacity: 0.85
    }));
    state.activePolyline = null;
  }
  document.querySelectorAll('.pin-active').forEach(el => el.classList.remove('pin-active'));
  closeSheet();
}

/**
 * Status UI Update
 */
function updateStatus(type, message) {
  elements.statusText.textContent = message;

  if (type === 'loading') {
    elements.statusPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
    elements.statusDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500';
  } else if (type === 'success') {
    elements.statusPulse.className = 'hidden';
    elements.statusDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
  } else if (type === 'error') {
    elements.statusPulse.className = 'hidden';
    elements.statusDot.className = 'relative inline-flex rounded-full h-2 w-2 bg-rose-500';
  }
}

function updateCountDisplay() {
  const visible = state.filteredZones.length;
  const total = state.parsedZones.length;
  elements.zoneCount.textContent = visible === total 
    ? `${total.toLocaleString()} parking zones`
    : `${visible.toLocaleString()} of ${total.toLocaleString()} zones`;
}

/**
 * Re-render Lucide icons safely
 */
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

/**
 * Setup Event Handlers
 */
function setupEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', () => fetchParkingData());

  // Search input with debounce
  let debounceTimer = null;
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.searchClearBtn.classList.toggle('hidden', !state.searchQuery);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilterAndRender(), 200);
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn.classList.add('hidden');
    elements.searchInput.focus();
    applyFilterAndRender();
  });

  // Area (BRZ) dropdown
  elements.brzFilter.addEventListener('change', (e) => {
    state.currentFilterBRZ = e.target.value;
    applyFilterAndRender();
  });

  // Target Location Dropdown
  if (elements.locationSelect) {
    elements.locationSelect.addEventListener('change', (e) => {
      setActiveLocation(e.target.value);
    });
  }

  // Manage Locations Modal Button
  if (elements.btnManageLocations) {
    elements.btnManageLocations.addEventListener('click', () => {
      renderLocationsTable();
      elements.locationsDialog.classList.add('open');
    });
  }

  // Locations Modal Close & Backdrop
  if (elements.locationsCloseBtn) {
    elements.locationsCloseBtn.addEventListener('click', () => {
      elements.locationsDialog.classList.remove('open');
    });
  }

  if (elements.locationsDialog) {
    elements.locationsDialog.addEventListener('click', (e) => {
      if (e.target === elements.locationsDialog) {
        elements.locationsDialog.classList.remove('open');
      }
    });
  }

  // Radius Select
  if (elements.radiusSelect) {
    elements.radiusSelect.addEventListener('change', (e) => {
      state.maxRadius = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
      if (state.activeLocation) renderTargetLocationOnMap(state.activeLocation);
      applyFilterAndRender();
    });
  }

  // Sort Criterion Select
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener('change', (e) => {
      state.sortMode = e.target.value;
      applyFilterAndRender();
    });
  }

  // Price Filter Dropdown
  if (elements.priceFilter) {
    elements.priceFilter.addEventListener('change', (e) => {
      state.priceFilter = e.target.value;
      applyFilterAndRender();
    });
  }

  // Rate Mode Select (Live Now vs Peak)
  if (elements.rateModeSelect) {
    elements.rateModeSelect.addEventListener('change', (e) => {
      state.rateMode = e.target.value;
      applyFilterAndRender();
    });
  }

  // Multi-Provider Select All & Clear
  if (elements.btnSelectAllProviders) {
    elements.btnSelectAllProviders.addEventListener('click', () => {
      if (window.CpaProviders) {
        Object.keys(window.CpaProviders.PROVIDERS).forEach(id => state.enabledProviders.add(id));
        renderProviderPills();
        applyFilterAndRender();
      }
    });
  }

  if (elements.btnSelectNoneProviders) {
    elements.btnSelectNoneProviders.addEventListener('click', () => {
      state.enabledProviders.clear();
      renderProviderPills();
      applyFilterAndRender();
    });
  }

  // Reset Filters Button
  if (elements.btnResetFilters) {
    elements.btnResetFilters.addEventListener('click', () => resetAllFilters());
  }


  // Toggle Recommendations Panel Button
  if (elements.btnToggleRecommendations) {
    elements.btnToggleRecommendations.addEventListener('click', () => {
      state.showBestValuePanel = !state.showBestValuePanel;
      elements.bestValuePanel.classList.toggle('hidden', !state.showBestValuePanel);
    });
  }

  // Best Value Panel Close Button
  if (elements.bestValueCloseBtn) {
    elements.bestValueCloseBtn.addEventListener('click', () => {
      state.showBestValuePanel = false;
      elements.bestValuePanel.classList.add('hidden');
    });
  }

  // Location Modal Actions: Pick Point on Map
  if (elements.btnPickMap) {
    elements.btnPickMap.addEventListener('click', () => startMapLocationPicker());
  }

  if (elements.btnCancelPicker) {
    elements.btnCancelPicker.addEventListener('click', () => cancelMapLocationPicker());
  }

  // Location Modal Actions: Find Address
  if (elements.btnSearchAddress) {
    elements.btnSearchAddress.addEventListener('click', () => {
      geocodeAddress(elements.newLocAddress.value.trim());
    });
  }

  // Location Modal Actions: Use GPS
  if (elements.btnUseGps) {
    elements.btnUseGps.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (elements.newLocStatusMsg) {
          elements.newLocStatusMsg.className = 'text-[11px] text-rose-500';
          elements.newLocStatusMsg.textContent = 'Geolocation is not supported by your browser.';
          elements.newLocStatusMsg.classList.remove('hidden');
        }
        return;
      }
      if (elements.newLocStatusMsg) {
        elements.newLocStatusMsg.className = 'text-[11px] text-amber-600 dark:text-amber-400';
        elements.newLocStatusMsg.textContent = 'Locating device GPS...';
        elements.newLocStatusMsg.classList.remove('hidden');
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          elements.newLocAddress.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          if (!elements.newLocName.value.trim()) {
            elements.newLocName.value = 'My Current Location';
          }
          if (elements.newLocStatusMsg) {
            elements.newLocStatusMsg.className = 'text-[11px] text-emerald-600 dark:text-emerald-400';
            elements.newLocStatusMsg.textContent = `✓ Current GPS coordinates found: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          }
        },
        (err) => {
          if (elements.newLocStatusMsg) {
            elements.newLocStatusMsg.className = 'text-[11px] text-rose-500';
            elements.newLocStatusMsg.textContent = `GPS error: ${err.message}. You can pick on map instead.`;
          }
        }
      );
    });
  }

  // Location Modal Actions: Add to Locations Button
  if (elements.btnSaveLocation) {
    elements.btnSaveLocation.addEventListener('click', () => handleAddNewLocation());
  }

  // Layer Toggles
  elements.togglePins.addEventListener('change', (e) => {
    state.showPins = e.target.checked;
    if (state.showPins) {
      elements.map.addLayer(state.useClustering ? elements.markerClusterGroup : elements.markerStandardLayer);
    } else {
      elements.map.removeLayer(elements.markerClusterGroup);
      elements.map.removeLayer(elements.markerStandardLayer);
    }
  });

  elements.toggleShapes.addEventListener('change', (e) => {
    state.showShapes = e.target.checked;
    if (state.showShapes) {
      elements.map.addLayer(elements.polylineLayer);
    } else {
      elements.map.removeLayer(elements.polylineLayer);
    }
  });

  elements.toggleCluster.addEventListener('change', (e) => {
    state.useClustering = e.target.checked;
    renderMapFeatures();
  });

  // Sheet Controls
  elements.sidebarCloseBtn.addEventListener('click', () => closeSheet());
  elements.sheetBackdrop.addEventListener('click', () => closeSheet());
  elements.btnZoomZone.addEventListener('click', () => zoomToCurrentZone());

  // Tabs
  elements.tabBtnOverview.addEventListener('click', () => switchTab('overview'));
  elements.tabBtnRates.addEventListener('click', () => switchTab('rates'));
  if (elements.tabBtnHistory) {
    elements.tabBtnHistory.addEventListener('click', () => switchTab('history'));
  }
  elements.tabBtnRules.addEventListener('click', () => switchTab('rules'));

  // Settings Dialog
  elements.settingsBtn.addEventListener('click', () => {
    elements.apiUrlInput.value = state.apiUrl;
    elements.settingsDialog.classList.add('open');
  });

  elements.settingsCloseBtn.addEventListener('click', () => {
    elements.settingsDialog.classList.remove('open');
  });

  elements.settingsResetBtn.addEventListener('click', () => {
    elements.apiUrlInput.value = DEFAULT_API_URL;
  });

  elements.settingsSaveBtn.addEventListener('click', () => {
    const val = elements.apiUrlInput.value.trim();
    if (val) {
      state.apiUrl = val;
      localStorage.setItem('cpa_api_url', val);
      elements.settingsDialog.classList.remove('open');
      fetchParkingData();
    }
  });

  elements.settingsDialog.addEventListener('click', (e) => {
    if (e.target === elements.settingsDialog) {
      elements.settingsDialog.classList.remove('open');
    }
  });

  // Global Keyboard Shortcuts (⌘K / Ctrl+K and Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    }
    if (e.key === 'Escape') {
      if (state.isPickingLocation) {
        cancelMapLocationPicker();
      } else if (elements.settingsDialog.classList.contains('open')) {
        elements.settingsDialog.classList.remove('open');
      } else if (elements.locationsDialog.classList.contains('open')) {
        elements.locationsDialog.classList.remove('open');
      } else if (elements.detailsSheet.classList.contains('open')) {
        closeSheet();
      }
    }
  });
}

function resetAllFilters() {
  state.priceFilter = 'ALL';
  state.rateMode = 'live';
  state.maxRadius = 500;
  state.sortMode = 'closest_cheapest';
  state.currentFilterBRZ = 'ALL';
  state.searchQuery = '';

  if (elements.priceFilter) elements.priceFilter.value = 'ALL';
  if (elements.rateModeSelect) elements.rateModeSelect.value = 'live';
  if (elements.radiusSelect) elements.radiusSelect.value = '500';
  if (elements.sortSelect) elements.sortSelect.value = 'closest_cheapest';
  if (elements.brzFilter) elements.brzFilter.value = 'ALL';
  if (elements.searchInput) elements.searchInput.value = '';
  if (elements.searchClearBtn) elements.searchClearBtn.classList.add('hidden');

  setActiveLocation('NONE');

  if (window.CpaProviders) {
    Object.keys(window.CpaProviders.PROVIDERS).forEach(id => state.enabledProviders.add(id));
    renderProviderPills();
  }
}

// Global API for inline onclicks
window.cpaApp = {
  selectZoneById: (id) => {
    const zone = state.parsedZones.find(z => String(z.id) === String(id));
    if (zone) selectZone(zone, false);
  },
  openZoneDetails: (id) => {
    const zone = state.parsedZones.find(z => String(z.id) === String(id));
    if (zone) {
      selectZone(zone, true);
    }
  },
  zoomToCurrentZone,
  setActiveLocation,
  deleteCustomLocation,
  zoomToCustomLocation,
  resetAllFilters,
  changeScheduleDay,
  takeSnapshotNow,
  clearLocalHistory,
};

// Bootstrap App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
  initCustomLocations();
  setupEventListeners();
  fetchParkingData();
  refreshIcons();
});
