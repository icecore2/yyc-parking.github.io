'use client';

import React from 'react';
import {
  Layers,
  MapPin,
  Route,
  Network,
  Crosshair,
  Sparkles,
  X,
  Footprints,
} from 'lucide-react';
import { ParkingZone, CustomLocation, BasemapId } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';

interface MapOverlaysProps {
  totalZonesCount: number;
  filteredZonesCount: number;
  showPins: boolean;
  onTogglePins: () => void;
  showShapes: boolean;
  onToggleShapes: () => void;
  showCluster: boolean;
  onToggleCluster: () => void;
  basemap: BasemapId;
  onBasemapChange: (b: BasemapId) => void;
  isPickingLocation: boolean;
  onCancelPickLocation: () => void;
  activeLocation: CustomLocation | null;
  showBestValuePanel: boolean;
  onCloseBestValuePanel: () => void;
  bestValueZones: ParkingZone[];
  onSelectZone: (zone: ParkingZone) => void;
  isRefreshing?: boolean;
}

export default function MapOverlays({
  totalZonesCount,
  filteredZonesCount,
  showPins,
  onTogglePins,
  showShapes,
  onToggleShapes,
  showCluster,
  onToggleCluster,
  basemap,
  onBasemapChange,
  isPickingLocation,
  onCancelPickLocation,
  activeLocation,
  showBestValuePanel,
  onCloseBestValuePanel,
  bestValueZones,
  onSelectZone,
  isRefreshing = false,
}: MapOverlaysProps) {
  return (
    <>
      {/* Map Picker Notification Banner (Top Center) */}
      {isPickingLocation && (
        <div
          id="map-picker-banner"
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full border border-primary bg-background/95 px-4 py-2 shadow-xl backdrop-blur text-xs font-medium animate-bounce"
        >
          <Crosshair className="h-4 w-4 text-primary" />
          <span className="text-foreground font-semibold">
            Click anywhere on the map to set location point
          </span>
          <button
            type="button"
            onClick={onCancelPickLocation}
            className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Status & Zone Count (Top-Left Badge Overlay) */}
      <div className="absolute top-3 left-4 z-20 flex flex-col sm:flex-row gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isRefreshing ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isRefreshing ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="truncate max-w-[220px]">
            {isRefreshing
              ? 'Refreshing parking data...'
              : `Showing ${filteredZonesCount} parking zones`}
          </span>
        </div>

        <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">{totalZonesCount} in database</span>
        </div>
      </div>

      {/* Floating Best Value Panel (Top-Left overlay below status) */}
      {activeLocation && showBestValuePanel && (
        <div
          id="best-value-panel"
          className="absolute top-14 left-4 z-20 flex flex-col gap-2 rounded-xl border border-border bg-background/95 p-3.5 shadow-xl backdrop-blur w-80 max-h-[calc(100vh-230px)] overflow-hidden transition-all text-xs animate-in slide-in-from-left duration-200"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Best Value Near {activeLocation.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {bestValueZones.length} spots
              </span>
              <button
                type="button"
                onClick={onCloseBestValuePanel}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5 max-h-[50vh]">
            {bestValueZones.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-[11px]">
                No parking spots found within current radius. Try expanding radius in the toolbar above.
              </div>
            ) : (
              bestValueZones.slice(0, 20).map((zone, idx) => {
                const prov = PROVIDERS[zone.provider] || PROVIDERS.parkplus_on_street;
                return (
                  <div
                    key={zone.id}
                    onClick={() => onSelectZone(zone)}
                    className="p-2.5 rounded-lg border border-border bg-card/60 hover:border-primary/50 cursor-pointer transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">
                          #{idx + 1} {zone.title}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: prov.color }}
                        />
                      </div>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {zone.isCurrentlyFree ? 'FREE' : `$${zone.activeRate.toFixed(2)}/hr`}
                      </span>
                    </div>

                    <div className="text-muted-foreground text-[11px] truncate">{zone.address}</div>

                    {zone.distanceToTarget !== undefined && zone.distanceToTarget !== null && (
                      <div className="flex items-center gap-1 text-[11px] text-primary font-medium">
                        <Footprints className="w-3 h-3" />
                        <span>
                          {Math.round(zone.distanceToTarget)}m • ~{zone.walkingMinutes} min walk
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Map Controls (Bottom-Left Card Overlay) */}
      <div className="absolute bottom-6 left-4 z-20 flex items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer select-none text-foreground font-medium">
          <input
            type="checkbox"
            checked={showPins}
            onChange={onTogglePins}
            className="h-3.5 w-3.5 rounded border-border text-primary accent-neutral-900 dark:accent-neutral-100"
          />
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> Pins
          </span>
        </label>

        <div className="h-4 w-px bg-border" />

        <label className="flex items-center gap-1.5 cursor-pointer select-none text-foreground font-medium">
          <input
            type="checkbox"
            checked={showShapes}
            onChange={onToggleShapes}
            className="h-3.5 w-3.5 rounded border-border text-primary accent-neutral-900 dark:accent-neutral-100"
          />
          <span className="flex items-center gap-1">
            <Route className="h-3.5 w-3.5 text-muted-foreground" /> Shapes
          </span>
        </label>

        <div className="h-4 w-px bg-border" />

        <label className="flex items-center gap-1.5 cursor-pointer select-none text-foreground font-medium">
          <input
            type="checkbox"
            checked={showCluster}
            onChange={onToggleCluster}
            className="h-3.5 w-3.5 rounded border-border text-primary accent-neutral-900 dark:accent-neutral-100"
          />
          <span className="flex items-center gap-1">
            <Network className="h-3.5 w-3.5 text-muted-foreground" /> Cluster
          </span>
        </label>
      </div>

      {/* Price & Provider Legend (Bottom-Right Card Overlay) */}
      <div
        id="map-legend"
        className="hidden md:flex absolute bottom-6 right-16 z-20 flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur text-xs min-w-[200px]"
      >
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 flex items-center justify-between">
          <span>Provider Pins</span>
          {/* Basemap Mini Toggle */}
          <div className="inline-flex rounded border border-border overflow-hidden text-[9px]">
            <button
              onClick={() => onBasemapChange('osm')}
              className={`px-1.5 py-0.5 ${basemap === 'osm' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}
            >
              OSM
            </button>
            <button
              onClick={() => onBasemapChange('light')}
              className={`px-1.5 py-0.5 ${basemap === 'light' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground'}`}
            >
              Light
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-[11px] text-foreground">
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#059669] shadow-xs">
              P+
            </span>
            <span className="truncate font-medium">ParkPlus (On-Street)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#2563eb] shadow-xs">
              P
            </span>
            <span className="truncate font-medium">City Parkades &amp; Lots</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#dc2626] shadow-xs">
              T
            </span>
            <span className="truncate font-medium">Transit Park &amp; Ride</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#be123c] shadow-xs">
              i
            </span>
            <span className="truncate font-medium">Impark (hangTag)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#0891b2] shadow-xs">
              i
            </span>
            <span className="truncate font-medium">Indigo Neo</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white bg-[#1e3a8a] shadow-xs">
              P
            </span>
            <span className="truncate font-medium">Precise ParkLink</span>
          </div>
        </div>
      </div>
    </>
  );
}
