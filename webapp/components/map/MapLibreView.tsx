'use client';

import React, { useEffect, useRef } from 'react';
import {
  Map,
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
  GeoJSONSource,
  config,
} from 'maplibre-gl';
import { ParkingZone, CustomLocation, BasemapId } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';

if (typeof window !== 'undefined' && !config.WORKER_URL) {
  config.WORKER_URL = '/maplibre-gl-worker.mjs';
}

export type { BasemapId };

interface MapLibreViewProps {
  zones: ParkingZone[];
  selectedZone: ParkingZone | null;
  onSelectZone: (zone: ParkingZone) => void;
  basemap?: BasemapId;
  showPins?: boolean;
  showShapes?: boolean;
  rateMode?: 'max' | 'live';
  activeLocation?: CustomLocation | null;
  maxRadius?: number | 'ALL';
  isPickingLocation?: boolean;
  onPickMapPoint?: (coords: [number, number]) => void;
}

function createGeoJSONCircle(center: [number, number], radiusInMeters: number, points = 64) {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const distanceX = radiusInMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusInMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([lng + x, lat + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

export default function MapLibreView({
  zones,
  selectedZone,
  onSelectZone,
  basemap = 'osm',
  showPins = true,
  showShapes = true,
  rateMode = 'max',
  activeLocation = null,
  maxRadius = 500,
  isPickingLocation = false,
  onPickMapPoint,
}: MapLibreViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerElementsRef = useRef<Record<string, HTMLDivElement>>({});
  const targetMarkerRef = useRef<Marker | null>(null);
  const activePopupRef = useRef<Popup | null>(null);

  const zonesRef = useRef(zones);
  const onSelectZoneRef = useRef(onSelectZone);
  const selectedZoneRef = useRef(selectedZone);
  const onPickMapPointRef = useRef(onPickMapPoint);

  useEffect(() => {
    zonesRef.current = zones;
    onSelectZoneRef.current = onSelectZone;
    selectedZoneRef.current = selectedZone;
    onPickMapPointRef.current = onPickMapPoint;
  }, [zones, onSelectZone, selectedZone, onPickMapPoint]);

  // Initialize Map with 100% Free OpenStreetMap & Keyless Basemaps (No watermarks)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-standard': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxzoom: 19,
          },
          'carto-light': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxzoom: 19,
          },
          'osm-hot': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'layer-osm-standard',
            type: 'raster',
            source: 'osm-standard',
            layout: { visibility: 'visible' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'layer-carto-light',
            type: 'raster',
            source: 'carto-light',
            layout: { visibility: 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'layer-osm-hot',
            type: 'raster',
            source: 'osm-hot',
            layout: { visibility: 'none' },
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-114.0719, 51.0447], // Calgary Downtown Core
      zoom: 14.5,
      pitch: 30, // 3D perspective
      attributionControl: { compact: true },
    });

    // Add 3D rotation and zoom controls
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right');

    // Add Geolocation control
    map.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'bottom-right'
    );

    map.on('load', () => {
      // GeoJSON source for catchment radius circle
      map.addSource('catchment-radius-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'catchment-radius-fill',
        type: 'fill',
        source: 'catchment-radius-source',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.08,
        },
      });

      map.addLayer({
        id: 'catchment-radius-line',
        type: 'line',
        source: 'catchment-radius-source',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 1.5,
          'line-dasharray': [2, 2],
        },
      });

      // GeoJSON source for parking polylines
      map.addSource('parking-lines-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Layer: Base colored parking lines
      map.addLayer({
        id: 'parking-lines-layer',
        type: 'line',
        source: 'parking-lines-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 3, 16, 7],
          'line-color': ['get', 'color'],
          'line-opacity': 0.85,
        },
      });

      // Layer: Glow highlight for selected line (bright amber)
      map.addLayer({
        id: 'parking-selected-line-layer',
        type: 'line',
        source: 'parking-lines-source',
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 7, 16, 13],
          'line-color': '#f59e0b',
          'line-opacity': 0.95,
        },
      });

      // Click on line opens zone details
      map.on('click', 'parking-lines-layer', (e) => {
        if (!e.features || e.features.length === 0) return;
        const featId = e.features[0].properties?.id;
        const match = zonesRef.current.find((z) => z.id === featId);
        if (match) onSelectZoneRef.current(match);
      });

      map.on('mouseenter', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Click anywhere to pick location point (if in picker mode)
      map.on('click', (e) => {
        if (onPickMapPointRef.current) {
          onPickMapPointRef.current([e.lngLat.lng, e.lngLat.lat]);
        }
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update basemap layer visibility dynamically when basemap changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      if (map.getLayer('layer-osm-standard')) {
        map.setLayoutProperty('layer-osm-standard', 'visibility', basemap === 'osm' ? 'visible' : 'none');
      }
      if (map.getLayer('layer-carto-light')) {
        map.setLayoutProperty('layer-carto-light', 'visibility', basemap === 'light' ? 'visible' : 'none');
      }
      if (map.getLayer('layer-osm-hot')) {
        map.setLayoutProperty('layer-osm-hot', 'visibility', basemap === 'hot' ? 'visible' : 'none');
      }
    };

    if (map.isStyleLoaded()) {
      applyVisibility();
    } else {
      map.once('load', applyVisibility);
    }
  }, [basemap]);

  // Update Shapes layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !map.getLayer('parking-lines-layer')) return;
    map.setLayoutProperty('parking-lines-layer', 'visibility', showShapes ? 'visible' : 'none');
  }, [showShapes]);

  // Cursor in picking mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isPickingLocation ? 'crosshair' : '';
  }, [isPickingLocation]);

  // Update Target Destination Marker & Catchment Radius Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }

    const updateRadius = () => {
      const source = map.getSource('catchment-radius-source') as GeoJSONSource;
      if (!source) return;

      if (!activeLocation || maxRadius === 'ALL') {
        source.setData({ type: 'FeatureCollection', features: [] });
      } else {
        const circleFeature = createGeoJSONCircle(activeLocation.coordinates, Number(maxRadius));
        source.setData({ type: 'FeatureCollection', features: [circleFeature] });
      }
    };

    if (map.isStyleLoaded()) {
      updateRadius();
    } else {
      map.once('load', updateRadius);
    }

    if (activeLocation) {
      const targetEl = document.createElement('div');
      targetEl.className = 'custom-target-marker';
      targetEl.innerHTML = `
        <div class="target-marker-wrapper">
          <div class="target-marker-pulse"></div>
          <div class="target-marker-badge" title="${activeLocation.name}">🎯</div>
        </div>
      `;

      targetMarkerRef.current = new Marker({ element: targetEl })
        .setLngLat(activeLocation.coordinates)
        .addTo(map);

      map.flyTo({
        center: activeLocation.coordinates,
        zoom: 15,
        speed: 1.2,
      });
    }
  }, [activeLocation, maxRadius]);

  // Update polylines and authentic teardrop pin markers when zones or rateMode change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing HTML markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerElementsRef.current = {};

    // Build GeoJSON features for lines
    const lineFeatures = zones
      .filter((z) => z.geometry && z.geometry.coordinates && z.geometry.coordinates.length > 0)
      .map((z) => {
        let color = '#059669'; // Green (Free)
        if (!z.isCurrentlyFree) {
          if (z.activeRate <= 2.5) color = '#2563eb'; // Blue
          else if (z.activeRate <= 3.75) color = '#d97706'; // Amber
          else color = '#e11d48'; // Rose
        }

        return {
          type: 'Feature' as const,
          properties: {
            id: z.id,
            title: z.title,
            rate: z.activeRate,
            color,
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: z.geometry!.coordinates,
          },
        };
      });

    const updateSource = () => {
      const source = map.getSource('parking-lines-source') as GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: lineFeatures,
        });
      }
    };

    if (map.isStyleLoaded()) {
      updateSource();
    } else {
      map.once('load', updateSource);
    }

    if (!showPins) return;

    // Add Authentic Teardrop Branded Pin Markers
    zones.forEach((zone) => {
      const el = document.createElement('div');
      const isSelected = selectedZoneRef.current?.id === zone.id;
      el.className = `custom-pin-marker ${isSelected ? 'pin-active' : ''}`;
      el.title = `${zone.title} - ${zone.address}`;

      const prov = PROVIDERS[zone.provider] || PROVIDERS.parkplus_on_street;

      const bubble = document.createElement('div');
      bubble.className = 'pin-bubble';
      bubble.style.setProperty('--provider-color', prov.color);
      if (prov.border) bubble.style.setProperty('--provider-border', prov.border);

      if (rateMode === 'live') {
        const span = document.createElement('span');
        span.textContent = zone.isCurrentlyFree ? 'FREE' : `$${zone.activeRate.toFixed(2)}`;
        bubble.appendChild(span);
      } else {
        const logoDiv = document.createElement('div');
        logoDiv.className = 'pin-logo';
        logoDiv.innerHTML = prov.logoSvg || '<span>P</span>';
        bubble.appendChild(logoDiv);
      }

      el.appendChild(bubble);

      // On pin click: open authentic popup card
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();

        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }

        // If the details sheet is already open, immediately update to this clicked pin's details!
        if (selectedZoneRef.current) {
          onSelectZoneRef.current(zone);
          return;
        }

        const popupContent = document.createElement('div');
        popupContent.className = 'p-3 flex flex-col gap-2 min-w-[240px] text-xs text-foreground';

        popupContent.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${prov.badgeClass}">
              ${prov.shortName}
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
              zone.isCurrentlyFree
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-primary/10 text-primary border border-primary/20'
            }">
              ${zone.isCurrentlyFree ? 'FREE' : `$${zone.activeRate.toFixed(2)} / hr`}
            </span>
          </div>

          <div class="font-bold text-xs text-foreground leading-snug">${zone.title}</div>
          <div class="text-[11px] text-muted-foreground">${zone.address}</div>

          ${
            zone.distanceToTarget !== undefined && zone.distanceToTarget !== null
              ? `<div class="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/5 rounded-md px-2 py-1 border border-primary/20">
                  <span>${Math.round(zone.distanceToTarget)}m • ~${zone.walkingMinutes} min walk from Target</span>
                </div>`
              : ''
          }

          <div class="text-[11px] text-muted-foreground flex flex-col gap-0.5 border-t border-border pt-1.5 mt-0.5">
            <div><strong>Hours:</strong> ${zone.enforceableHours || '09:00 - 18:00'}</div>
            <div><strong>Capacity:</strong> ${zone.stallCount || 12} stalls • ${zone.stallType || 'Standard'}</div>
            <div><strong>Operator:</strong> ${prov.operator}</div>
          </div>

          <div class="flex flex-col gap-1.5 mt-1">
            <button
              id="popup-btn-details-${zone.id}"
              class="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Full Details &amp; Rates
            </button>
            ${
              zone.paymentUrl
                ? `<a
                    href="${zone.paymentUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex w-full items-center justify-center gap-1 rounded-md border border-input bg-background hover:bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors"
                  >
                    Open ${zone.paymentApp || prov.paymentApp || 'Provider Website'}
                  </a>`
                : ''
            }
          </div>
        `;

        const popup = new Popup({
          offset: [0, -28],
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px',
        })
          .setLngLat(zone.coordinates)
          .setDOMContent(popupContent)
          .addTo(map);

        activePopupRef.current = popup;

        // Hook click on details button inside popup immediately without timeout
        const btn = popupContent.querySelector(`#popup-btn-details-${zone.id}`);
        if (btn) {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.remove();
            activePopupRef.current = null;
            onSelectZoneRef.current(zone);
          });
        }
      });

      markerElementsRef.current[zone.id] = el;

      const marker = new Marker({ element: el })
        .setLngLat(zone.coordinates)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [zones, showPins, rateMode]);

  // When selected zone changes, highlight line and marker in O(1) time
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.entries(markerElementsRef.current).forEach(([id, el]) => {
      if (id === selectedZone?.id) {
        el.classList.add('pin-active');
      } else {
        el.classList.remove('pin-active');
      }
    });

    if (!selectedZone) {
      if (map.getLayer('parking-selected-line-layer')) {
        map.setFilter('parking-selected-line-layer', ['==', ['get', 'id'], '']);
      }
      return;
    }

    if (activePopupRef.current) {
      activePopupRef.current.remove();
      activePopupRef.current = null;
    }

    if (map.getLayer('parking-selected-line-layer')) {
      map.setFilter('parking-selected-line-layer', ['==', ['get', 'id'], selectedZone.id]);
    }

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;

    map.flyTo({
      center: selectedZone.coordinates,
      zoom: 16,
      speed: 1.2,
      curve: 1.4,
      essential: true,
      offset: isDesktop ? [-160, 0] : [0, 0],
    });
  }, [selectedZone]);

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainer} className="h-full w-full" />
    </div>
  );
}
