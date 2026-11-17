'use client';

import React from 'react';
import { Search, Heart, Crown, Layers } from 'lucide-react';
import { ProviderId } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { BasemapId } from './MapLibreView';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MapControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBrz: string;
  onBrzChange: (brz: string) => void;
  selectedProviders: ProviderId[];
  onToggleProvider: (id: ProviderId) => void;
  onOpenOptimizer: () => void;
  onOpenFavorites: () => void;
  isPro: boolean;
  basemap: BasemapId;
  onBasemapChange: (b: BasemapId) => void;
}

const BRZ_OPTIONS = [
  'All Calgary',
  'Downtown',
  'Beltline',
  '17th Ave',
  'Kensington',
  'Inglewood',
  'East Village',
  'Chinatown',
];

export default function MapControls({
  searchQuery,
  onSearchChange,
  selectedBrz,
  onBrzChange,
  selectedProviders,
  onToggleProvider,
  onOpenOptimizer,
  onOpenFavorites,
  isPro,
  basemap,
  onBasemapChange,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-[420px] z-20 space-y-2 pointer-events-none">
      {/* Search & Area Filter Bar */}
      <div className="rounded-2xl border border-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md pointer-events-auto space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search Zone # (e.g. 1008) or Street..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="w-36">
            <Select value={selectedBrz} onValueChange={onBrzChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Area" />
              </SelectTrigger>
              <SelectContent>
                {BRZ_OPTIONS.map((brz) => (
                  <SelectItem key={brz} value={brz}>
                    {brz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/60">
          <Button
            type="button"
            variant={isPro ? 'default' : 'secondary'}
            size="sm"
            onClick={onOpenOptimizer}
            className="flex-1 h-8 text-xs font-bold gap-1.5"
          >
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            <span>Cheapest Spot</span>
            {!isPro && (
              <Badge variant="warning" className="text-[9px] px-1 h-4 font-bold">
                PRO
              </Badge>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenFavorites}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>Favorites</span>
          </Button>
        </div>
      </div>

      {/* Map Layer Switcher & Provider Badges */}
      <div className="flex flex-col gap-1.5 pointer-events-auto">
        {/* Basemap Switcher Pill */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-md backdrop-blur text-[11px] self-start">
          <span className="flex items-center gap-1 px-1.5 text-muted-foreground font-semibold">
            <Layers className="w-3 h-3 text-primary" />
            <span>Map:</span>
          </span>
          <Button
            type="button"
            variant={basemap === 'osm' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onBasemapChange('osm')}
            className="h-6 px-2 text-[11px]"
            title="OpenStreetMap Standard - 100% Free, Official OSM"
          >
            OSM
          </Button>
          <Button
            type="button"
            variant={basemap === 'light' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onBasemapChange('light')}
            className="h-6 px-2 text-[11px]"
            title="Clean Light - High contrast for parking lines"
          >
            Light
          </Button>
          <Button
            type="button"
            variant={basemap === 'hot' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onBasemapChange('hot')}
            className="h-6 px-2 text-[11px]"
            title="Humanitarian OSM - Pedestrian & detailed street layout"
          >
            Humanitarian
          </Button>
        </div>

        {/* Provider Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(PROVIDERS) as ProviderId[]).map((pid) => {
            const prov = PROVIDERS[pid];
            const isSelected = selectedProviders.includes(pid);
            return (
              <Button
                key={pid}
                type="button"
                variant={isSelected ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => onToggleProvider(pid)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border ${
                  isSelected
                    ? 'bg-card text-foreground border-border shadow-sm ring-1 ring-primary/40'
                    : 'bg-card/70 text-muted-foreground border-border/60 opacity-60'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0"
                  style={{ backgroundColor: prov.color }}
                />
                {prov.shortName}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
