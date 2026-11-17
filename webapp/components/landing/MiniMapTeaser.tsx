'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, config } from 'maplibre-gl';
import { SAMPLE_CALGARY_ZONES } from '@/lib/parking/data-service';
import { ParkingZone } from '@/lib/parking/types';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

if (typeof window !== 'undefined' && !config.WORKER_URL) {
  config.WORKER_URL = '/maplibre-gl-worker.mjs';
}

export default function MiniMapTeaser() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(SAMPLE_CALGARY_ZONES[1]);

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
      // Add authentic teardrop branded pin markers for sample downtown spots
      SAMPLE_CALGARY_ZONES.forEach((zone) => {
        const el = document.createElement('div');
        el.className = 'custom-pin-marker';
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
        el.appendChild(bubble);

        el.addEventListener('click', () => {
          setSelectedZone(zone);
          map.flyTo({ center: zone.coordinates, zoom: 15.5, speed: 1.2 });
        });

        new Marker({ element: el })
          .setLngLat(zone.coordinates)
          .addTo(map);
      });
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [isInView]);

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
        <div ref={mapContainer} className="h-full w-full" />

        {/* Selected Zone Float Sheet */}
        {selectedZone && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{selectedZone.title}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {selectedZone.isCurrentlyFree ? 'FREE NOW' : `$${selectedZone.activeRate.toFixed(2)}/hr`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedZone.address}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-medium text-muted-foreground block">{selectedZone.brz}</span>
                <span className="text-[10px] text-slate-500 font-semibold">{selectedZone.stallCount} stalls</span>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">{selectedZone.enforceableHours}</span>
              <Link
                href={`/app?zone=${selectedZone.id}`}
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-[11px]"
              >
                Inspect Zone →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
