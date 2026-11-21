'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { ProviderId } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { Button } from '@/components/ui/button';

interface ProviderToolbarProps {
  selectedProviders: ProviderId[];
  onToggleProvider: (id: ProviderId) => void;
  onSelectAllProviders: () => void;
  onClearProviders: () => void;
  providerCounts: Record<ProviderId, number>;
}

export default function ProviderToolbar({
  selectedProviders,
  onToggleProvider,
  onSelectAllProviders,
  onClearProviders,
  providerCounts,
}: ProviderToolbarProps) {
  const providerList = Object.keys(PROVIDERS) as ProviderId[];

  return (
    <div
      id="provider-toolbar-row"
      className="relative z-20 flex flex-wrap items-center justify-between border-b border-border bg-background/90 px-4 py-1.5 backdrop-blur gap-2 text-xs"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px] shrink-0">
        <Layers className="h-3.5 w-3.5 text-primary" />
        <span>Providers:</span>
      </div>

      <div id="provider-pills-container" className="flex flex-wrap items-center gap-1.5 flex-1">
        {providerList.map((pid) => {
          const prov = PROVIDERS[pid];
          const isSelected = selectedProviders.includes(pid);
          const count = providerCounts[pid] || 0;

          return (
            <button
              key={pid}
              type="button"
              onClick={() => onToggleProvider(pid)}
              className={`provider-pill ${isSelected ? 'active' : ''}`}
              style={{ ['--provider-color' as string]: prov.color }}
              title={prov.name}
            >
              <span className="pill-dot" />
              <span>{prov.shortName}</span>
              <span className="pill-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1 shrink-0 text-[11px]">
        <Button
          id="btn-select-all-providers"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelectAllProviders}
          className="h-6 px-2 text-[11px] text-primary hover:text-primary font-semibold"
        >
          Select All
        </Button>
        <span className="text-muted-foreground/40">•</span>
        <Button
          id="btn-select-none-providers"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearProviders}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground font-medium"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
