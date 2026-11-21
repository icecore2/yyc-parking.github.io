'use client';

import React from 'react';
import Link from 'next/link';
import { Footprints, X } from 'lucide-react';
import { ParkingZone } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { cn } from '@/lib/utils';

export interface ZonePreviewCardProps {
  zone: ParkingZone;
  inspectHref?: string;
  onInspect?: (zone: ParkingZone) => void;
  onClose?: () => void;
  className?: string;
}

export default function ZonePreviewCard({
  zone,
  inspectHref,
  onInspect,
  onClose,
  className,
}: ZonePreviewCardProps) {
  const provider = PROVIDERS[zone.provider] || PROVIDERS.parkplus_on_street;
  const districtLabel =
    zone.brz && zone.brz.toLowerCase() !== 'none' ? zone.brz : provider.shortName;
  const capacityLabel =
    typeof zone.stallCount === 'number' && zone.stallCount > 0
      ? `${zone.stallCount} stalls`
      : zone.stallType || 'Parking';

  return (
    <div
      id="zone-preview-card"
      className={cn(
        'rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-foreground">{zone.title}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              {zone.isCurrentlyFree ? 'FREE NOW' : `$${zone.activeRate.toFixed(2)}/hr`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{zone.address}</p>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          <div className="text-right">
            <span className="text-[10px] font-medium text-muted-foreground block">
              {districtLabel}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              {capacityLabel}
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close zone preview"
              title="Close preview (Esc)"
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {zone.distanceToTarget !== undefined && zone.distanceToTarget !== null && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          <Footprints className="h-3 w-3 shrink-0" />
          <span>
            {Math.round(zone.distanceToTarget)}m • ~{zone.walkingMinutes ?? Math.max(1, Math.round(zone.distanceToTarget / 80))} min walk from Target
          </span>
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground text-[11px] truncate">
          {zone.enforceableHours || 'See details for hours'}
        </span>

        {inspectHref ? (
          <Link
            href={inspectHref}
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] shrink-0"
          >
            Inspect Zone →
          </Link>
        ) : onInspect ? (
          <button
            type="button"
            onClick={() => onInspect(zone)}
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] shrink-0 cursor-pointer"
          >
            Inspect Zone →
          </button>
        ) : null}
      </div>
    </div>
  );
}
