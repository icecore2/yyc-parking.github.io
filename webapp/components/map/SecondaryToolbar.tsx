'use client';

import React from 'react';
import {
  MapPin,
  MapPinPlus,
  Footprints,
  ArrowDownUp,
  BadgeDollarSign,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { CustomLocation } from '@/lib/parking/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SecondaryToolbarProps {
  customLocations: CustomLocation[];
  activeLocationId: string;
  onSelectLocation: (id: string) => void;
  onOpenManageLocations: () => void;
  maxRadius: number | 'ALL';
  onRadiusChange: (r: number | 'ALL') => void;
  sortMode: 'closest_cheapest' | 'cheapest' | 'closest';
  onSortModeChange: (m: 'closest_cheapest' | 'cheapest' | 'closest') => void;
  priceFilter: string; // 'ALL', 'free', '1', '2', '3', '4', '5'
  onPriceFilterChange: (p: string) => void;
  rateMode: 'max' | 'live';
  onRateModeChange: (rm: 'max' | 'live') => void;
  showBestValuePanel: boolean;
  onToggleBestValuePanel: () => void;
  onResetFilters: () => void;
  bestValueCount: number;
}

export default function SecondaryToolbar({
  customLocations,
  activeLocationId,
  onSelectLocation,
  onOpenManageLocations,
  maxRadius,
  onRadiusChange,
  sortMode,
  onSortModeChange,
  priceFilter,
  onPriceFilterChange,
  rateMode,
  onRateModeChange,
  showBestValuePanel,
  onToggleBestValuePanel,
  onResetFilters,
  bestValueCount,
}: SecondaryToolbarProps) {
  const hasActiveLocation = activeLocationId !== 'NONE';

  return (
    <div
      id="filter-toolbar-row"
      className="z-20 flex flex-wrap items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur gap-2 text-xs"
    >
      {/* Left Section: Custom Location & Proximity Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Target Location Picker */}
        <div className="flex items-center gap-1.5 w-[210px] sm:w-[240px]">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <Select value={activeLocationId} onValueChange={onSelectLocation}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All Calgary (No Target)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">All Calgary (No Target)</SelectItem>
              {customLocations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manage Locations Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenManageLocations}
          className="h-8 gap-1.5 text-xs"
          title="Manage saved locations & add new rows"
        >
          <MapPinPlus className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline">Manage Locations</span>
          <span className="sm:hidden">Locations</span>
        </Button>

        {/* Walking Radius Dropdown (active when location is chosen) */}
        {hasActiveLocation && (
          <div className="flex items-center gap-1.5 w-[165px] animate-in fade-in duration-150">
            <Footprints className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={String(maxRadius)}
              onValueChange={(val) =>
                onRadiusChange(val === 'ALL' ? 'ALL' : Number(val))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select Radius" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="300">Within 300m (~4 min)</SelectItem>
                <SelectItem value="500">Within 500m (~6 min)</SelectItem>
                <SelectItem value="1000">Within 1 km (~12 min)</SelectItem>
                <SelectItem value="2000">Within 2 km (~25 min)</SelectItem>
                <SelectItem value="ALL">Any Distance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort Criterion Dropdown (active when location is chosen) */}
        {hasActiveLocation && (
          <div className="flex items-center gap-1.5 w-[170px] animate-in fade-in duration-150">
            <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Select
              value={sortMode}
              onValueChange={(val) =>
                onSortModeChange(val as 'closest_cheapest' | 'cheapest' | 'closest')
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closest_cheapest">Best Value (Closest + Cheapest)</SelectItem>
                <SelectItem value="cheapest">Cheapest First</SelectItem>
                <SelectItem value="closest">Closest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right Section: Price Threshold & Rate Mode */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Price Threshold Filter */}
        <div className="flex items-center gap-1.5 w-[130px]">
          <BadgeDollarSign className="h-3.5 w-3.5 text-primary shrink-0" />
          <Select value={priceFilter} onValueChange={onPriceFilterChange}>
            <SelectTrigger className="h-8 text-xs font-semibold">
              <SelectValue placeholder="Price Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Rates</SelectItem>
              <SelectItem value="free">Free Only</SelectItem>
              <SelectItem value="1">≤ $1.00 / hr</SelectItem>
              <SelectItem value="2">≤ $2.00 / hr</SelectItem>
              <SelectItem value="3">≤ $3.00 / hr</SelectItem>
              <SelectItem value="4">≤ $4.00 / hr</SelectItem>
              <SelectItem value="5">≤ $5.00 / hr</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Rate Mode Toggle (Live Now vs Peak) */}
        <div className="flex items-center gap-1.5 w-[150px]">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select
            value={rateMode}
            onValueChange={(val) => onRateModeChange(val as 'max' | 'live')}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Rate Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="max">Peak Daytime Rate</SelectItem>
              <SelectItem value="live">Live Rate (Now)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Best Value Spots Panel Toggle (visible when target location set) */}
        {hasActiveLocation && (
          <Button
            type="button"
            variant={showBestValuePanel ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleBestValuePanel}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="View ranked best value parking near target"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Best Value</span>
            <Badge variant="secondary" className="px-1 text-[10px] h-4">
              {bestValueCount}
            </Badge>
          </Button>
        )}

        {/* Reset Filters Button */}
        <Button
          type="button"
          variant="outline"
          size="iconSm"
          onClick={onResetFilters}
          className="h-8 w-8 text-xs"
          title="Reset all filters & target location"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
