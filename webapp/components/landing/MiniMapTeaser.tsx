'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GeoJSONSource, Map, Marker, NavigationControl, config } from 'maplibre-gl';
import { SAMPLE_CALGARY_ZONES } from '@/lib/parking/data-service';
import { ParkingZone } from '@/lib/parking/types';
import { resolvePinAnchorCoordinates } from '@/lib/parking/geometry';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import ZonePreviewCard from '@/components/map/ZonePreviewCard';

if (typeof window !== 'undefined' && !config.WORKER_URL) {
  config.WORKER_URL = '/maplibre-gl-worker.mjs';
}

export default function MiniMapTeaser() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const markerElementsRef = useRef<Record<string, HTMLDivElement>>({});
  const anchorMapRef = useRef<globalThis.Map<string, [number, number]>>(new globalThis.Map());
  const selectedZoneRef = useRef<ParkingZone | null>(SAMPLE_CALGARY_ZONES[1]);
  const styleReadyRef = useRef(false);
  const [isInView, setIsInView] = useState(false);
  const [mapStyleReady, setMapStyleReady] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(SAMPLE_CALGARY_ZONES[1]);

  useEffect(() => {
    selectedZoneRef.current = selectedZone;
  }, [selectedZone]);

  // Defer heavy WebGL canvas initialization until user scrolls near the preview section
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView || !mapContainer.current || mapInstance.current) return;

    // Official OpenStreetMap Standard tiles (100% free, zero API key, no watermark)
    const map = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-114.0719, 51.0447], // Stephen Ave / Downtown Calgary
      zoom: 14.2,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      const anchorMap = resolvePinAnchorCoordinates(SAMPLE_CALGARY_ZONES);
      anchorMapRef.current = anchorMap;

      const lineFeatures = SAMPLE_CALGARY_ZONES
        .filter((z) => Boolean(z.geometry && z.geometry.coordinates && z.geometry.coordinates.length > 0))
        .map((z) => {
          const color = z.isCurrentlyFree ? '#059669' : z.activeRate >= 4 ? '#e11d48' : '#2563eb';
          return {
            type: 'Feature' as const,
            properties: {
              id: z.id,
              title: z.title,
              color,
            },
            geometry: z.geometry!,
          };
        });

      const initialZone = selectedZoneRef.current;
      const initialId = initialZone?.id || '';
      const initialCoord = initialZone
        ? anchorMap.get(initialZone.id) || initialZone.coordinates
        : null;

      map.addSource('parking-lines-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: lineFeatures,
        },
      });

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

      map.addLayer({
        id: 'parking-selected-line-glow',
        type: 'line',
        source: 'parking-lines-source',
        filter: ['==', ['get', 'id'], initialId],
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

      map.addLayer({
        id: 'parking-selected-line-layer',
        type: 'line',
        source: 'parking-lines-source',
        filter: ['==', ['get', 'id'], initialId],
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

      map.addSource('parking-selected-anchor-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: initialCoord
            ? [
                {
                  type: 'Feature',
                  properties: { id: initialId },
                  geometry: { type: 'Point', coordinates: initialCoord },
                },
              ]
            : [],
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
        const featId = e.features?.[0]?.properties?.id;
        const match = SAMPLE_CALGARY_ZONES.find((z) => z.id === featId);
        if (match) {
          setSelectedZone(match);
          const coord = anchorMap.get(match.id) || match.coordinates;
          map.flyTo({ center: coord, zoom: 15.5, speed: 1.2 });
        }
      };

      map.on('click', 'parking-lines-layer', handleLineClick);
      map.on('click', 'parking-selected-line-layer', handleLineClick);
      map.on('mouseenter', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'parking-lines-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      // Add authentic teardrop branded pin markers anchored by exact sharp tip on each stalls bar
      SAMPLE_CALGARY_ZONES.forEach((zone) => {
        const el = document.createElement('div');
        el.className = 'custom-pin-marker';
        el.dataset.zoneId = zone.id;
        el.title = `${zone.title} - ${zone.address}`;

        const isFree = zone.isCurrentlyFree;
        const colorClass = isFree ? '#059669' : zone.activeRate >= 4 ? '#e11d48' : '#2563eb';

        const bubble = document.createElement('div');
        bubble.className = 'pin-bubble';
        bubble.style.setProperty('--provider-color', colorClass);

        const logoDiv = document.createElement('div');
        logoDiv.className = 'pin-logo';
        logoDiv.innerHTML = isFree
          ? '<span>FREE</span>'
          : `<span>$${zone.activeRate.toFixed(0)}</span>`;
        bubble.appendChild(logoDiv);

        bubble.addEventListener('click', (ev) => {
          ev.stopPropagation();
          setSelectedZone(zone);
          const coord = anchorMap.get(zone.id) || zone.coordinates;
          map.flyTo({ center: coord, zoom: 15.5, speed: 1.2 });
        });

        el.appendChild(bubble);
        markerElementsRef.current[zone.id] = el;

        const anchorCoord = anchorMap.get(zone.id) || zone.coordinates;
        new Marker({ element: el, anchor: 'bottom' })
          .setLngLat(anchorCoord)
          .addTo(map);
      });

      if (initialId) {
        markerElementsRef.current[initialId]?.classList.add('pin-active');
      }

      styleReadyRef.current = true;
      setMapStyleReady(true);
    });

    mapInstance.current = map;

    return () => {
      styleReadyRef.current = false;
      markerElementsRef.current = {};
      map.remove();
      mapInstance.current = null;
    };
  }, [isInView]);

  useEffect(() => {
    Object.entries(markerElementsRef.current).forEach(([id, el]) => {
      if (id === selectedZone?.id) {
        el.classList.add('pin-active');
      } else {
        el.classList.remove('pin-active');
      }
    });

    const map = mapInstance.current;
    if (!map || !styleReadyRef.current) return;

    const targetId = selectedZone?.id || '';
    const filterExpr = ['==', ['get', 'id'], targetId] as ['==', ['get', string], string];
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
      if (selectedZone) {
        const anchorCoord =
          anchorMapRef.current.get(selectedZone.id) || selectedZone.coordinates;
        anchorSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { id: selectedZone.id },
              geometry: { type: 'Point', coordinates: anchorCoord },
            },
          ],
        });
      } else {
        anchorSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  }, [selectedZone, mapStyleReady]);

  return (
    <div ref={wrapperRef} className="relative w-full rounded-3xl border border-border bg-card shadow-2xl overflow-hidden">
      {/* Top Banner on Mini Map */}
      <div className="flex items-center justify-between border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-foreground">Interactive Downtown Calgary Preview</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">• Click any pin to inspect rates</span>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          Open Fullscreen Map <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Map Canvas */}
      <div className="relative h-[380px] sm:h-[450px] w-full bg-slate-100 dark:bg-slate-900">
        <div ref={mapContainer} className="relative z-0 isolate h-full w-full" />

        {/* Selected Zone Float Sheet */}
        {selectedZone && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-10">
            <ZonePreviewCard
              zone={selectedZone}
              inspectHref={`/app?zone=${selectedZone.id}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
