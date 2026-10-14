/**
 * Calgary On-Street Parking Map
 * Static OpenStreetMap application displaying Calgary Parking Authority Zones
 */

// Configuration
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
};

// UI Elements
const elements = {
  map: null,
  polylineLayer: null,
  markerClusterGroup: null,
  markerStandardLayer: null,
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  zoneCount: document.getElementById('zone-count'),
  refreshBtn: document.getElementById('refresh-btn'),
  refreshIcon: document.getElementById('refresh-icon'),
  searchInput: document.getElementById('search-input'),
  searchClearBtn: document.getElementById('search-clear-btn'),
  brzFilter: document.getElementById('brz-filter'),
  togglePins: document.getElementById('toggle-pins'),
  toggleShapes: document.getElementById('toggle-shapes'),
  toggleCluster: document.getElementById('toggle-cluster'),
  detailsSidebar: document.getElementById('details-sidebar'),
  sidebarCloseBtn: document.getElementById('sidebar-close-btn'),
  sidebarContent: document.getElementById('sidebar-content'),
  sidebarZoneNum: document.getElementById('sidebar-zone-num'),
  sidebarStreet: document.getElementById('sidebar-street'),
  settingsBtn: document.getElementById('settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingsResetBtn: document.getElementById('settings-reset-btn'),
  apiUrlInput: document.getElementById('api-url-input'),
};

/**
 * Coordinate Conversion: Web Mercator (EPSG:3857 / 102100) to WGS84 Lat/Lng (EPSG:4326)
 */
function webMercatorToLatLng(x, y) {
  const lng = (x / 20037508.342789244) * 180;
  let lat = (y / 20037508.342789244) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lat, lng];
}

/**
 * Normalize any coordinate pair to [lat, lng]
 */
function normalizeCoord(pair) {
  const x = pair[0];
  const y = pair[1];
  // If coordinates are in meters (Web Mercator), convert
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    return webMercatorToLatLng(x, y);
  }
  // Otherwise it's already [lng, lat]
  return [y, x];
}

/**
 * Calculate the midpoint along a polyline to place the pin
 */
function getPolylineMidpoint(latLngs) {
  if (!latLngs || latLngs.length === 0) return [51.0447, -114.0719];
  if (latLngs.length === 1) return latLngs[0];
  
  // Find total length and middle point
  let totalDist = 0;
  const dists = [0];
  for (let i = 0; i < latLngs.length - 1; i++) {
    const p1 = latLngs[i];
    const p2 = latLngs[i + 1];
    const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    totalDist += d;
    dists.push(totalDist);
  }
  
  const halfDist = totalDist / 2;
  for (let i = 0; i < dists.length - 1; i++) {
    if (halfDist >= dists[i] && halfDist <= dists[i + 1]) {
      const segLen = dists[i + 1] - dists[i];
      const ratio = segLen === 0 ? 0 : (halfDist - dists[i]) / segLen;
      const p1 = latLngs[i];
      const p2 = latLngs[i + 1];
      return [
        p1[0] + (p2[0] - p1[0]) * ratio,
        p1[1] + (p2[1] - p1[1]) * ratio
      ];
    }
  }
  
  return latLngs[Math.floor(latLngs.length / 2)];
}

/**
 * Initialize Leaflet Map
 */
function initMap() {
  // Downtown Calgary coordinates
  elements.map = L.map('map', {
    center: [51.0465, -114.068],
    zoom: 14,
    zoomControl: false,
  });

  // Zoom control on top left
  L.control.zoom({ position: 'topleft' }).addTo(elements.map);

  // OpenStreetMap Tile Layer
  const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | Data: City of Calgary',
  }).addTo(elements.map);

  const cartoPositron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  });

  const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  });

  // Base map layer control
  L.control.layers({
    'OpenStreetMap Standard': osmStandard,
    'Clean Street Map (Positron)': cartoPositron,
    'Night Map (Dark)': cartoDark
  }, null, { position: 'topright' }).addTo(elements.map);

  // Initialize Layer Groups
  elements.polylineLayer = L.featureGroup().addTo(elements.map);
  elements.markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 17,
    chunkedLoading: true
  }).addTo(elements.map);
  elements.markerStandardLayer = L.featureGroup();

  // Close sidebar when clicking map background
  elements.map.on('click', (e) => {
    // If click was not on a layer
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
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(state.apiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (json.error) {
      throw new Error(`ArcGIS Error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    let rawList = [];
    if (json.features && Array.isArray(json.features)) {
      rawList = json.features;
    } else {
      throw new Error('Unexpected API response structure (no features array found)');
    }

    state.rawFeatures = rawList;
    processFeatures(rawList);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateStatus('success', `Live data synced at ${now}`);
  } catch (err) {
    console.error('Failed to fetch parking data:', err);
    updateStatus('error', `Fetch error: ${err.message}`);
  } finally {
    state.isLoading = false;
    if (elements.refreshIcon) elements.refreshIcon.classList.remove('spin');
    if (elements.refreshBtn) elements.refreshBtn.disabled = false;
  }
}

/**
 * Parse ArcGIS Features into structured Zone objects
 */
function processFeatures(features) {
  const zones = [];
  const brzSet = new Set();

  features.forEach((feat, index) => {
    const attrs = feat.attributes || {};
    const geom = feat.geometry || {};
    
    // Geometry can be paths (Esri Polyline) or GeoJSON coordinates
    let paths = geom.paths;
    if (!paths && geom.coordinates) {
      paths = Array.isArray(geom.coordinates[0][0]) ? geom.coordinates : [geom.coordinates];
    }
    
    if (!paths || paths.length === 0) return;

    // Convert paths to array of [lat, lng]
    const lineSegments = [];
    paths.forEach(subPath => {
      const latLngs = subPath.map(normalizeCoord);
      if (latLngs.length > 0) {
        lineSegments.push(latLngs);
      }
    });

    if (lineSegments.length === 0) return;

    // Representative latLngs for the main shape
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

/**
 * Populate BRZ dropdown
 */
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

/**
 * Filter zones based on search query and BRZ selection
 */
function applyFilterAndRender() {
  const query = state.searchQuery.toLowerCase().trim();
  const brzFilter = state.currentFilterBRZ;

  state.filteredZones = state.parsedZones.filter(z => {
    // Area filter
    if (brzFilter !== 'ALL' && z.brzName !== brzFilter) {
      return false;
    }
    // Search text filter
    if (query) {
      const matchZone = z.zoneNumber.toLowerCase().includes(query);
      const matchAddr = z.address.toLowerCase().includes(query);
      const matchBrz = z.brzName.toLowerCase().includes(query);
      return matchZone || matchAddr || matchBrz;
    }
    return true;
  });

  renderMapFeatures();
  updateCountDisplay();
}

/**
 * Determine polyline color based on price zone or BRZ
 */
function getZoneColor(priceZone) {
  const pz = String(priceZone).toLowerCase();
  if (pz === '1' || pz === '2') return '#3b82f6'; // Blue
  if (pz === '3' || pz === '4' || pz.startsWith('4')) return '#06b6d4'; // Cyan
  if (pz === '5' || pz === '6') return '#10b981'; // Green
  if (pz === '7' || pz === '8' || pz === '9') return '#f59e0b'; // Amber
  if (pz === '10' || pz === '11' || pz === '12') return '#8b5cf6'; // Purple
  if (pz === '13' || pz === '14' || pz === '15') return '#ec4899'; // Pink
  return '#2563eb'; // Default Primary Blue
}

/**
 * Render polylines and pin markers onto the map
 */
function renderMapFeatures() {
  // Clear existing layers
  elements.polylineLayer.clearLayers();
  elements.markerClusterGroup.clearLayers();
  elements.markerStandardLayer.clearLayers();

  const bounds = [];

  state.filteredZones.forEach(zone => {
    // 1. Draw Polyline Shapes
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

      // Hover effect on shape
      poly.on('mouseover', () => {
        poly.setStyle({ weight: 8, opacity: 1 });
      });
      poly.on('mouseout', () => {
        if (state.selectedZone !== zone) {
          poly.setStyle({ weight: 5, opacity: 0.85 });
        }
      });

      // Click on shape selects zone
      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectZone(zone);
      });

      // Tooltip on shape
      poly.bindTooltip(`<strong>Zone ${zone.zoneNumber}</strong><br>${zone.address}`, {
        sticky: true,
        className: 'zone-tooltip'
      });

      polylines.push(poly);
      if (state.showShapes) {
        elements.polylineLayer.addLayer(poly);
      }
    });

    zone.polylineLayer = polylines;

    // 2. Create Pin Marker at Midpoint
    const customPinIcon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="pin-bubble" title="Zone ${zone.zoneNumber}">
          <span>P</span>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28]
    });

    const marker = L.marker(zone.midpoint, { icon: customPinIcon });

    // Popup content
    const popupContent = createPopupHtml(zone);
    marker.bindPopup(popupContent, { maxWidth: 280 });

    // Pin click event
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      selectZone(zone);
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

  // Fit bounds if search or filter applied and results exist
  if ((state.searchQuery || state.currentFilterBRZ !== 'ALL') && bounds.length > 0) {
    try {
      elements.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 16 });
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Format Enforceable Hours into human-friendly string
 * e.g. "0910-1750 MON-SAT" -> "09:10 - 17:50 (Mon-Sat)"
 */
function formatEnforceableTime(raw) {
  if (!raw) return 'Check posted signs';
  // Check pattern like 0900-1800 MON-FRI
  const m = raw.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})\s*(.*)$/);
  if (m) {
    return `${m[1]}:${m[2]} - ${m[3]}:${m[4]} ${m[5]}`;
  }
  return raw;
}

/**
 * Generate Popup HTML
 */
function createPopupHtml(zone) {
  return `
    <div class="popup-card">
      <div class="popup-header">
        <span class="popup-zone-badge">Zone #${zone.zoneNumber}</span>
        <small style="color:var(--text-muted);">${zone.stallType || 'Parallel'}</small>
      </div>
      <div class="popup-address">${zone.address}</div>
      <div class="popup-meta">
        <div><strong>Capacity:</strong> ${zone.zoneCapacity} stalls (${zone.segLength}m)</div>
        <div><strong>Area:</strong> ${zone.brzName}</div>
      </div>
      <button class="popup-btn" onclick="window.cpaApp.selectZoneById('${zone.id}')">
        View All Details
      </button>
    </div>
  `;
}

/**
 * Select a parking zone and display all details in sidebar
 */
function selectZone(zone) {
  state.selectedZone = zone;

  // Reset previously active polyline style
  if (state.activePolyline) {
    state.activePolyline.forEach(p => p.setStyle({
      color: getZoneColor(p._zoneRef?.priceZone || ''),
      weight: 5,
      opacity: 0.85
    }));
  }

  // Highlight current polyline shape
  if (zone.polylineLayer) {
    zone.polylineLayer.forEach(p => {
      p._zoneRef = zone;
      p.setStyle({
        color: '#f59e0b',
        weight: 9,
        opacity: 1
      });
      p.bringToFront();
    });
    state.activePolyline = zone.polylineLayer;
  }

  // Highlight pin marker
  document.querySelectorAll('.pin-active').forEach(el => el.classList.remove('pin-active'));
  if (zone.markerLayer && zone.markerLayer.getElement()) {
    zone.markerLayer.getElement().classList.add('pin-active');
  }

  // Render details in sidebar
  renderDetailsSidebar(zone);
  openSidebar();
}

/**
 * Render all zone details into the slide-out panel
 */
function renderDetailsSidebar(zone) {
  elements.sidebarZoneNum.textContent = `Zone #${zone.zoneNumber}`;
  elements.sidebarStreet.textContent = zone.address;

  // Format Max Time
  let maxTimeStr = 'Not Specified';
  if (zone.maxTime) {
    const hours = Math.floor(zone.maxTime / 60);
    const mins = zone.maxTime % 60;
    maxTimeStr = hours > 0 ? `${hours} hr${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins}m` : ''}` : `${mins} mins`;
  }

  // Block side label
  const sideMap = { 'N': 'North', 'S': 'South', 'E': 'East', 'W': 'West' };
  const blockSideName = sideMap[zone.blockSide] || zone.blockSide || 'Both';

  // Format HTML rates content safely
  let formattedRatesHtml = zone.htmlRates;
  if (!formattedRatesHtml || formattedRatesHtml.trim() === '') {
    formattedRatesHtml = '<em>No detailed rate schedule provided in database. Refer to on-street signs.</em>';
  }

  // Restriction warning check
  let restrictionAlert = '';
  if (zone.restrictType && zone.restrictType.toLowerCase() !== 'none') {
    restrictionAlert = `
      <div class="restriction-alert">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <strong>Parking Restriction (${zone.restrictType}):</strong><br>
          ${zone.restrictTime}
        </div>
      </div>
    `;
  }

  // Prohibitions check
  let prohibitions = '';
  if (zone.noStopping || zone.noParking) {
    prohibitions = `
      <div class="restriction-alert danger">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <div>
          ${zone.noStopping ? `<strong>No Stopping:</strong> ${zone.noStopping}<br>` : ''}
          ${zone.noParking ? `<strong>No Parking:</strong> ${zone.noParking}` : ''}
        </div>
      </div>
    `;
  }

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${zone.midpoint[0]},${zone.midpoint[1]}`;

  elements.sidebarContent.innerHTML = `
    <!-- Location Card -->
    <div class="detail-card">
      <div class="detail-card-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Location & Street
      </div>
      <div class="address-highlight">${zone.address}</div>
      <div class="quick-stats-grid">
        <div class="stat-item">
          <span class="stat-label">Block Side</span>
          <span class="stat-val">${blockSideName} Side (${zone.blockSide || 'N/A'})</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Area (BRZ)</span>
          <span class="stat-val">${zone.brzName}</span>
        </div>
      </div>
    </div>

    ${restrictionAlert}
    ${prohibitions}

    <!-- Capacity & Timing Stats -->
    <div class="detail-card">
      <div class="detail-card-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Stalls & Enforceability
      </div>
      <div class="quick-stats-grid">
        <div class="stat-item">
          <span class="stat-label">Stall Capacity</span>
          <span class="stat-val">${zone.zoneCapacity} stalls</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Max Stay</span>
          <span class="stat-val">${maxTimeStr}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Stall Type</span>
          <span class="stat-val">${zone.stallType}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Zone Length</span>
          <span class="stat-val">${zone.zoneLength} meters</span>
        </div>
      </div>
      <div class="info-row">
        <span class="info-label">Enforceable Hours</span>
        <span class="info-val">${formatEnforceableTime(zone.enforceableTime)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Price Zone</span>
        <span class="info-val">Zone ${zone.priceZone}</span>
      </div>
      ${zone.permitZone ? `
      <div class="info-row">
        <span class="info-label">Permit Zone</span>
        <span class="info-val">${zone.permitZone}</span>
      </div>` : ''}
    </div>

    <!-- Rate Schedule -->
    <div class="detail-card">
      <div class="detail-card-title">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        Rate Schedule & Free Parking
      </div>
      <div class="rates-container">
        ${formattedRatesHtml}
      </div>
    </div>

    <!-- Technical Meta -->
    <div class="detail-card">
      <div class="detail-card-title">Technical Details</div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-val" style="color:var(--success);">${zone.status}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Segment Capacity</span>
        <span class="info-val">${zone.segCapacity} stalls (${zone.segLength} m)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Coordinates</span>
        <span class="info-val">${zone.midpoint[0].toFixed(5)}, ${zone.midpoint[1].toFixed(5)}</span>
      </div>
      ${zone.comments ? `
      <div class="info-row">
        <span class="info-label">Comments</span>
        <span class="info-val">${zone.comments}</span>
      </div>` : ''}
    </div>

    <!-- Actions -->
    <div class="sidebar-actions">
      <button class="btn btn-primary" onclick="window.cpaApp.zoomToCurrentZone()">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        Zoom into Street Segment
      </button>
      <a href="${gmapsUrl}" target="_blank" rel="noopener" class="btn btn-secondary" style="text-decoration:none;justify-content:center;">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Open in Google Maps Navigation
      </a>
    </div>
  `;
}

/**
 * Zoom map into selected zone
 */
function zoomToCurrentZone() {
  if (!state.selectedZone) return;
  const zone = state.selectedZone;
  
  if (zone.polylineLayer && zone.polylineLayer.length > 0) {
    const group = L.featureGroup(zone.polylineLayer);
    elements.map.fitBounds(group.getBounds(), { padding: [80, 80], maxZoom: 18 });
  } else {
    elements.map.setView(zone.midpoint, 18);
  }

  // Open marker popup if available
  if (zone.markerLayer) {
    zone.markerLayer.openPopup();
  }
}

function openSidebar() {
  elements.detailsSidebar.classList.add('open');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  elements.detailsSidebar.classList.remove('open');
  document.body.classList.remove('sidebar-open');
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
  closeSidebar();
}

/**
 * Update Status Badge UI
 */
function updateStatus(type, message) {
  elements.statusDot.className = `status-dot ${type}`;
  elements.statusText.textContent = message;
}

/**
 * Update Zone Count Display
 */
function updateCountDisplay() {
  const visible = state.filteredZones.length;
  const total = state.parsedZones.length;
  if (visible === total) {
    elements.zoneCount.textContent = `${total.toLocaleString()} parking zones`;
  } else {
    elements.zoneCount.textContent = `${visible.toLocaleString()} of ${total.toLocaleString()} zones`;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Refresh Button
  elements.refreshBtn.addEventListener('click', () => {
    fetchParkingData();
  });

  // Search Input
  let debounceTimeout = null;
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
    
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      applyFilterAndRender();
    }, 200);
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn.style.display = 'none';
    applyFilterAndRender();
  });

  // Area (BRZ) Filter
  elements.brzFilter.addEventListener('change', (e) => {
    state.currentFilterBRZ = e.target.value;
    applyFilterAndRender();
  });

  // Toggle Pins
  elements.togglePins.addEventListener('change', (e) => {
    state.showPins = e.target.checked;
    if (state.showPins) {
      if (state.useClustering) {
        elements.map.addLayer(elements.markerClusterGroup);
      } else {
        elements.map.addLayer(elements.markerStandardLayer);
      }
    } else {
      elements.map.removeLayer(elements.markerClusterGroup);
      elements.map.removeLayer(elements.markerStandardLayer);
    }
  });

  // Toggle Shapes (Polylines)
  elements.toggleShapes.addEventListener('change', (e) => {
    state.showShapes = e.target.checked;
    if (state.showShapes) {
      elements.map.addLayer(elements.polylineLayer);
    } else {
      elements.map.removeLayer(elements.polylineLayer);
    }
  });

  // Toggle Cluster
  elements.toggleCluster.addEventListener('change', (e) => {
    state.useClustering = e.target.checked;
    renderMapFeatures();
  });

  // Sidebar Close Button
  elements.sidebarCloseBtn.addEventListener('click', () => {
    closeSidebar();
  });

  // Settings Modal
  elements.settingsBtn.addEventListener('click', () => {
    elements.apiUrlInput.value = state.apiUrl;
    elements.settingsModal.classList.add('open');
  });

  elements.settingsCloseBtn.addEventListener('click', () => {
    elements.settingsModal.classList.remove('open');
  });

  elements.settingsResetBtn.addEventListener('click', () => {
    elements.apiUrlInput.value = DEFAULT_API_URL;
  });

  elements.settingsSaveBtn.addEventListener('click', () => {
    const newUrl = elements.apiUrlInput.value.trim();
    if (newUrl) {
      state.apiUrl = newUrl;
      localStorage.setItem('cpa_api_url', newUrl);
      elements.settingsModal.classList.remove('open');
      fetchParkingData();
    }
  });

  // Close modal when clicking backdrop
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.remove('open');
    }
  });
}

// Expose public methods for inline HTML events
window.cpaApp = {
  selectZoneById: (id) => {
    const zone = state.parsedZones.find(z => String(z.id) === String(id));
    if (zone) selectZone(zone);
  },
  zoomToCurrentZone,
};

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  fetchParkingData();
});
