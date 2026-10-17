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
  activeTab: 'overview', // 'overview', 'rates', 'rules'
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
  tabBtnOverview: document.getElementById('tab-btn-overview'),
  tabBtnRates: document.getElementById('tab-btn-rates'),
  tabBtnRules: document.getElementById('tab-btn-rules'),
  btnZoomZone: document.getElementById('btn-zoom-zone'),
  btnGmapsLink: document.getElementById('btn-gmaps-link'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsDialog: document.getElementById('settings-dialog'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsResetBtn: document.getElementById('settings-reset-btn'),
  apiUrlInput: document.getElementById('api-url-input'),
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

  // Background map click clears active selection
  elements.map.on('click', (e) => {
    if (!e.originalEvent._handledByLayer) {
      clearSelection();
    }
  });
}

/**
 * Fetch latest data from ArcGIS FeatureServer
 */
async function fetchParkingData() {
  if (state.isLoading) return;
  
  state.isLoading = true;
  updateStatus('loading', 'Fetching latest parking data...');
  if (elements.refreshIcon) elements.refreshIcon.classList.add('spin');
  if (elements.refreshBtn) elements.refreshBtn.disabled = true;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const response = await fetch(state.apiUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(`ArcGIS Error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    const rawList = json.features && Array.isArray(json.features) ? json.features : [];
    state.rawFeatures = rawList;
    processFeatures(rawList);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateStatus('success', `Synced at ${timeStr}`);
  } catch (err) {
    console.error('Failed to fetch parking data:', err);
    updateStatus('error', `Error: ${err.message}`);
  } finally {
    state.isLoading = false;
    if (elements.refreshIcon) elements.refreshIcon.classList.remove('spin');
    if (elements.refreshBtn) elements.refreshBtn.disabled = false;
  }
}

/**
 * Process features into zone records
 */
function processFeatures(features) {
  const zones = [];
  const brzSet = new Set();

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
    if (brz) brzSet.add(brz);

    const zoneObj = {
      id: attrs.OBJECTID || index,
      zoneNumber: attrs.PARKING_ZONE !== undefined && attrs.PARKING_ZONE !== null ? String(attrs.PARKING_ZONE) : 'N/A',
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
      restrictTime: (attrs.PARKING_RESTRICT_TIME || 'none').trim(),
      restrictType: (attrs.PARKING_RESTRICT_TYPE || 'none').trim(),
      noParking: attrs.NO_PARKING || null,
      noStopping: attrs.NO_STOPPING || null,
      permitZone: attrs.PERMIT_ZONE || null,
      comments: attrs.COMMENTS || null,
      globalId: attrs.GLOBALID || '',
      lineSegments,
      midpoint,
      polylineLayer: null,
      markerLayer: null,
    };

    zones.push(zoneObj);
  });

  state.parsedZones = zones;
  populateBrzFilter(Array.from(brzSet).sort());
  applyFilterAndRender();
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

  state.filteredZones = state.parsedZones.filter(z => {
    if (brzFilter !== 'ALL' && z.brzName !== brzFilter) return false;
    if (query) {
      return z.zoneNumber.toLowerCase().includes(query) ||
             z.address.toLowerCase().includes(query) ||
             z.brzName.toLowerCase().includes(query);
    }
    return true;
  });

  renderMapFeatures();
  updateCountDisplay();
}

function getZoneColor(priceZone) {
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
    // 1. Polyline Shapes
    const polylineColor = getZoneColor(zone.priceZone);
    const polylines = [];

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

      poly.bindTooltip(`<strong>Zone ${zone.zoneNumber}</strong><br>${zone.address}`, {
        sticky: true,
        className: 'zone-tooltip'
      });

      polylines.push(poly);
      if (state.showShapes) elements.polylineLayer.addLayer(poly);
    });
    zone.polylineLayer = polylines;

    // 2. Midpoint Pin Marker
    const customPinIcon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-bubble" title="Zone ${zone.zoneNumber}">
          <span>P</span>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      popupAnchor: [0, -26]
    });

    const marker = L.marker(zone.midpoint, { icon: customPinIcon });
    marker.bindPopup(createPopupHtml(zone), { maxWidth: 280 });

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
 * Popup HTML (shadcn Popover card style)
 */
function createPopupHtml(zone) {
  return `
    <div class="p-3.5 flex flex-col gap-2 min-w-[220px]">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          Zone #${zone.zoneNumber}
        </span>
        <span class="text-[11px] font-medium text-muted-foreground">${zone.stallType}</span>
      </div>
      <div class="font-semibold text-xs text-foreground leading-snug">${zone.address}</div>
      <div class="text-[11px] text-muted-foreground flex flex-col gap-0.5 border-t border-border pt-1.5 mt-0.5">
        <div><strong>Capacity:</strong> ${zone.zoneCapacity} stalls (${zone.segLength}m)</div>
        <div><strong>Area:</strong> ${zone.brzName}</div>
      </div>
      <button 
        onclick="window.cpaApp.openZoneDetails('${zone.id}')"
        class="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        <span>More Details</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
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
  elements.sidebarZoneNum.textContent = `Zone #${zone.zoneNumber}`;
  elements.sidebarStallBadge.textContent = zone.stallType || 'Parallel';
  elements.sidebarStreet.textContent = zone.address;

  // Max Stay calculation
  let maxStayStr = 'Not Specified';
  if (zone.maxTime) {
    const hrs = Math.floor(zone.maxTime / 60);
    const mins = zone.maxTime % 60;
    maxStayStr = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''}${mins > 0 ? ` ${mins}m` : ''}` : `${mins} mins`;
  }

  const sideMap = { 'N': 'North', 'S': 'South', 'E': 'East', 'W': 'West' };
  const blockSideName = sideMap[zone.blockSide] || zone.blockSide || 'Both';

  // Navigation link
  elements.btnGmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${zone.midpoint[0]},${zone.midpoint[1]}`;

  // 1. Overview Tab Content
  const overviewHtml = `
    <div class="flex flex-col gap-3">
      
      <!-- Primary Card: Address & Block -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location &amp; Block</span>
        <div class="text-sm font-semibold text-foreground leading-snug">${zone.address}</div>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <div class="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <span class="text-muted-foreground block text-[10px] uppercase">Side of Street</span>
            <span class="font-semibold text-foreground">${blockSideName} (${zone.blockSide || 'N/A'})</span>
          </div>
          <div class="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <span class="text-muted-foreground block text-[10px] uppercase">Area (BRZ)</span>
            <span class="font-semibold text-foreground truncate block">${zone.brzName}</span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-2 gap-2.5">
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stall Capacity</span>
          <span class="text-base font-bold text-foreground">${zone.zoneCapacity} <span class="text-xs font-normal text-muted-foreground">stalls</span></span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Max Stay</span>
          <span class="text-base font-bold text-foreground">${maxStayStr}</span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Zone Length</span>
          <span class="text-base font-bold text-foreground">${zone.zoneLength} <span class="text-xs font-normal text-muted-foreground">meters</span></span>
        </div>
        <div class="rounded-xl border border-border bg-card p-3 shadow-sm flex flex-col gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price Tier</span>
          <span class="text-base font-bold text-foreground">Tier ${zone.priceZone}</span>
        </div>
      </div>

      <!-- Enforceable Hours Card -->
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enforceable Parking Hours</span>
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

  // 2. Rates & Hours Tab Content
  const ratesHtml = `
    <div class="flex flex-col gap-3">
      <div class="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Rates Timetable</span>
          <span class="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Zone #${zone.zoneNumber}</span>
        </div>
        ${formatHtmlRates(zone.htmlRates)}
      </div>

      <div class="rounded-lg border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
        <i data-lucide="info" class="h-4 w-4 shrink-0"></i>
        <span>Free parking applies on Sundays and statutory holidays unless specific restriction signage is posted.</span>
      </div>
    </div>
  `;

  // 3. Rules & Restrictions Tab Content
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
    rules: elements.tabBtnRules
  };

  Object.keys(tabButtons).forEach(name => {
    const btn = tabButtons[name];
    if (name === tabName) {
      btn.className = 'tab-trigger inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all bg-background text-foreground shadow-sm';
    } else {
      btn.className = 'tab-trigger inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all text-muted-foreground hover:text-foreground';
    }
  });

  if (state.selectedZone && state.selectedZone._tabHtml) {
    elements.sidebarContent.innerHTML = state.selectedZone._tabHtml[tabName] || state.selectedZone._tabHtml.overview;
    refreshIcons();
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
  elements.detailsSheet.classList.remove('open');
  elements.sheetBackdrop.classList.remove('open');
}

function clearSelection() {
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
      if (elements.settingsDialog.classList.contains('open')) {
        elements.settingsDialog.classList.remove('open');
      } else if (elements.detailsSheet.classList.contains('open')) {
        closeSheet();
      }
    }
  });
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
};

// Bootstrap App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMap();
  setupEventListeners();
  fetchParkingData();
  refreshIcons();
});
