'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Map,
  Marker,
  NavigationControl,
  GeolocateControl,
  GeoJSONSource,
  config,
} from 'maplibre-gl';
import { ParkingZone, CustomLocation, BasemapId } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { resolvePinAnchorCoordinates } from '@/lib/parking/geometry';

if (typeof window !== 'undefined' && !config.WORKER_URL) {
  config.WORKER_URL = '/maplibre-gl-worker.mjs';
}

export type { BasemapId };

interface MapLibreViewProps {
  zones: ParkingZone[];
  selectedZone: ParkingZone | null;
  onSelectZone: (zone: ParkingZone) => void;
  previewZone?: ParkingZone | null;
  onPreviewZone?: (zone: ParkingZone | null) => void;
  basemap?: BasemapId;
  showPins?: boolean;
  showShapes?: boolean;
  rateMode?: 'max' | 'live';
  activeLocation?: CustomLocation | null;
  maxRadius?: number | 'ALL';
  isPickingLocation?: boolean;
  onPickMapPoint?: (coords: [number, number]) => void;
  hasOpenModal?: boolean;
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
  previewZone = null,
  onPreviewZone,
  basemap = 'osm',
  showPins = true,
  showShapes = true,
  rateMode = 'max',
  activeLocation = null,
  maxRadius = 500,
  isPickingLocation = false,
  onPickMapPoint,
  hasOpenModal = false,
}: MapLibreViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const markerElementsRef = useRef<Record<string, HTMLDivElement>>({});
  const pinAnchorMapRef = useRef<globalThis.Map<string, [number, number]>>(new globalThis.Map());
  const targetMarkerRef = useRef<Marker | null>(null);
  const styleReadyRef = useRef(false);
  const lastFlownKeyRef = useRef<string>('');
  const [mapStyleReady, setMapStyleReady] = useState(false);

  const pinAnchorMap = useMemo(() => resolvePinAnchorCoordinates(zones), [zones]);

  const zonesRef = useRef(zones);
  const onSelectZoneRef = useRef(onSelectZone);
  const selectedZoneRef = useRef(selectedZone);
  const previewZoneRef = useRef(previewZone);
  const onPreviewZoneRef = useRef(onPreviewZone);
  const isPickingLocationRef = useRef(isPickingLocation);
  const onPickMapPointRef = useRef(onPickMapPoint);

    useEffect(() => {
    zonesRef.current = zones;
    onSelectZoneRef.current = onSelectZone;
    selectedZoneRef.current = selectedZone;
    previewZoneRef.current = previewZone;
    onPreviewZoneRef.current = onPreviewZone;
    isPickingLocationRef.current = isPickingLocation;
    onPickMapPointRef.current = onPickMapPoint;
    pinAnchorMapRef.current = pinAnchorMap;
  }, [
    zones,
    onSelectZone,
    selectedZone,
    previewZone,
    onPreviewZone,
    isPickingLocation,
    onPickMapPoint,
    pinAnchorMap,
  ]);

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

      // Layer: Soft outer glow highlight for selected stalls bar (amber)
      map.addLayer({
        id: 'parking-selected-line-glow',
        type: 'line',
        source: 'parking-lines-source',
        filter: ['==', ['get', 'id'], ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 18, 18, 22],
          'line-color': '#f59e0b',
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      });

      // Layer: Core highlight for selected stalls bar (bright amber)
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 6, 16, 11, 18, 14],
          'line-color': '#f59e0b',
          'line-opacity': 1,
        },
      });

      // Contact ring directly under the sharp teardrop tip on the stalls bar
      map.addSource('parking-selected-anchor-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'parking-selected-anchor-layer',
        type: 'circle',
        source: 'parking-selected-anchor-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 6],
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
      });

      const handleLineClick = (e: { features?: { properties?: { id?: string } }[] }) => {
        if (isPickingLocationRef.current) return;
        if (!e.features || e.features.length === 0) return;
        const featId = e.features[0].properties?.id;
        const match = zonesRef.current.find((z) => z.id === featId);
        if (!match) return;
        if (selectedZoneRef.current) {
          onSelectZoneRef.current(match);
        } else if (onPreviewZoneRef.current) {
          onPreviewZoneRef.current(match);
        } else {
          onSelectZoneRef.current(match);
        }
      };

      // Click on base or highlighted line previews zone (or updates open details sheet)
      map.on('click', 'parking-lines-layer', handleLineClick);
      map.on('click', 'parking-selected-line-layer', handleLineClick);

      map.on('mouseenter', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'parking-selected-line-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'parking-selected-line-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Click anywhere to pick location point (if in picker mode) or dismiss preview card
      map.on('click', (e) => {
        const clickTarget = e.originalEvent?.target as HTMLElement | null;
        if (clickTarget?.closest('.custom-pin-marker')) {
          return;
        }
        if (isPickingLocationRef.current && onPickMapPointRef.current) {
          onPickMapPointRef.current([e.lngLat.lng, e.lngLat.lat]);
          return;
        }
        const queryLayers = ['parking-lines-layer', 'parking-selected-line-layer'].filter((id) =>
          Boolean(map.getLayer(id))
        );
        const hitLines =
          queryLayers.length > 0 ? map.queryRenderedFeatures(e.point, { layers: queryLayers }) : [];
        if (hitLines.length === 0 && previewZoneRef.current && onPreviewZoneRef.current) {
          onPreviewZoneRef.current(null);
        }
      });

      styleReadyRef.current = true;
      setMapStyleReady(true);
    });

    mapRef.current = map;

    return () => {
      styleReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update basemap layer visibility dynamically when basemap changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    if (map.getLayer('layer-osm-standard')) {
      map.setLayoutProperty('layer-osm-standard', 'visibility', basemap === 'osm' ? 'visible' : 'none');
    }
    if (map.getLayer('layer-carto-light')) {
      map.setLayoutProperty('layer-carto-light', 'visibility', basemap === 'light' ? 'visible' : 'none');
    }
    if (map.getLayer('layer-osm-hot')) {
      map.setLayoutProperty('layer-osm-hot', 'visibility', basemap === 'hot' ? 'visible' : 'none');
    }
  }, [basemap, mapStyleReady]);

  // Update Shapes layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current || !map.getLayer('parking-lines-layer')) return;
    map.setLayoutProperty('parking-lines-layer', 'visibility', showShapes ? 'visible' : 'none');
  }, [showShapes, mapStyleReady]);

  // Cursor in picking mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isPickingLocation ? 'crosshair' : '';
  }, [isPickingLocation]);

  // Dismiss any open zone preview card when a modal dialog opens or location picking starts
  useEffect(() => {
    if ((isPickingLocation || hasOpenModal) && previewZoneRef.current && onPreviewZoneRef.current) {
      onPreviewZoneRef.current(null);
    }
  }, [isPickingLocation, hasOpenModal]);

  // Update Target Destination Marker & Catchment Radius Circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }

    if (styleReadyRef.current) {
      const source = map.getSource('catchment-radius-source') as GeoJSONSource | undefined;
      if (source) {
        if (!activeLocation || maxRadius === 'ALL') {
          source.setData({ type: 'FeatureCollection', features: [] });
        } else {
          const circleFeature = createGeoJSONCircle(activeLocation.coordinates, Number(maxRadius));
          source.setData({ type: 'FeatureCollection', features: [circleFeature] });
        }
      }
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
  }, [activeLocation, maxRadius, mapStyleReady]);

  // Sync GeoJSON stalls bars source whenever zones or map readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    // Build GeoJSON features for stalls bars (supports LineString & MultiLineString)
    const lineFeatures = zones
      .filter((z) => Boolean(z.geometry && z.geometry.coordinates && z.geometry.coordinates.length > 0))
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
            zoneNumber: z.zoneNumber || z.id,
            title: z.title,
            rate: z.activeRate,
            color,
          },
          geometry: z.geometry!,
        };
      });

    const source = map.getSource('parking-lines-source') as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: lineFeatures,
      });
    }

    const activeZone = selectedZoneRef.current || previewZoneRef.current || null;
    const filterExpr = [
      '==',
      ['get', 'id'],
      activeZone ? activeZone.id : '',
    ] as ['==', ['get', string], string];

    if (map.getLayer('parking-selected-line-glow')) {
      map.setFilter('parking-selected-line-glow', filterExpr);
    }
    if (map.getLayer('parking-selected-line-layer')) {
      map.setFilter('parking-selected-line-layer', filterExpr);
    }
    const anchorSource = map.getSource('parking-selected-anchor-source') as
      | GeoJSONSource
      | undefined;
    if (anchorSource) {
      if (activeZone) {
        const anchorCoord = pinAnchorMap.get(activeZone.id) || activeZone.coordinates;
        anchorSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: activeZone.id },
              geometry: { type: 'Point', coordinates: anchorCoord },
            },
          ],
        });
      } else {
        anchorSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [zones, pinAnchorMap, mapStyleReady]);

  // Update authentic teardrop pin markers anchored by exact sharp tip on each stalls bar
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing HTML markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    markerElementsRef.current = {};

    if (!showPins) return;

    zones.forEach((zone) => {
      const el = document.createElement('div');
      const activeId = selectedZoneRef.current?.id || previewZoneRef.current?.id;
      const isSelected = activeId === zone.id;
      el.className = `custom-pin-marker ${isSelected ? 'pin-active' : ''}`;
      el.dataset.zoneId = zone.id;
      el.dataset.zoneNumber = zone.zoneNumber || zone.id;
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

      // Attach click directly on visible teardrop bubble so transparent marker corners never block neighbor pins
      bubble.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (isPickingLocationRef.current) return;

        // If the details sheet is already open, immediately update to this clicked pin's details!
        if (selectedZoneRef.current) {
          onSelectZoneRef.current(zone);
          return;
        }

        if (onPreviewZoneRef.current) {
          onPreviewZoneRef.current(zone);
        } else {
          onSelectZoneRef.current(zone);
        }
      });

      el.appendChild(bubble);
      markerElementsRef.current[zone.id] = el;

      const anchorCoord = pinAnchorMap.get(zone.id) || zone.coordinates;
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat(anchorCoord)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [zones, pinAnchorMap, showPins, rateMode]);

  // When selected or previewed zone changes, highlight pin, stalls bar & sharp-tip contact point
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeZone = selectedZone || previewZone || null;

    Object.entries(markerElementsRef.current).forEach(([id, el]) => {
      if (id === activeZone?.id) {
        el.classList.add('pin-active');
      } else {
        el.classList.remove('pin-active');
      }
    });

    if (styleReadyRef.current) {
      const filterExpr = [
        '==',
        ['get', 'id'],
        activeZone ? activeZone.id : '',
      ] as ['==', ['get', string], string];

      if (map.getLayer('parking-selected-line-glow')) {
        map.setFilter('parking-selected-line-glow', filterExpr);
      }
      if (map.getLayer('parking-selected-line-layer')) {
        map.setFilter('parking-selected-line-layer', filterExpr);
      }

      const anchorSource = map.getSource('parking-selected-anchor-source') as
        | GeoJSONSource
        | undefined;
      if (anchorSource) {
        if (activeZone) {
          const anchorCoord = pinAnchorMap.get(activeZone.id) || activeZone.coordinates;
          anchorSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { id: activeZone.id },
                geometry: { type: 'Point', coordinates: anchorCoord },
              },
            ],
          });
        } else {
          anchorSource.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    }

    if (!activeZone) {
      lastFlownKeyRef.current = '';
      return;
    }

    const flyKey = `${activeZone.id}:${Boolean(selectedZone)}`;
    if (lastFlownKeyRef.current === flyKey) return;
    lastFlownKeyRef.current = flyKey;

    const anchorCoord = pinAnchorMap.get(activeZone.id) || activeZone.coordinates;
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 640;
    const isDetailSheetOpen = Boolean(selectedZone);

    map.flyTo({
      center: anchorCoord,
      zoom: Math.max(map.getZoom(), isDetailSheetOpen ? 16 : 15.5),
      speed: 1.2,
      curve: 1.4,
      essential: true,
      offset: isDetailSheetOpen && isDesktop ? [-160, 0] : [0, 0],
    });
  }, [selectedZone, previewZone, pinAnchorMap, mapStyleReady]);

  return (
    <div className="relative z-0 isolate h-full w-full">
      <div ref={mapContainer} className="relative z-0 isolate h-full w-full" />
    </div>
  );
}
