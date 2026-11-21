'use client';

import React, { useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ExampleBadge({ label = 'Example Data' }: { label?: string }) {
  return (
    <Badge
      variant="warning"
      className="text-[10px] gap-1 px-2 py-0.5 font-semibold shrink-0"
    >
      <Sparkles className="w-2.5 h-2.5" />
      <span>{label}</span>
    </Badge>
  );
}

interface ExampleDataBannerProps {
  sectionLabel: string;
  exampleCount: number;
  onClearExamples: () => unknown;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  compact?: boolean;
}

export default function ExampleDataBanner({
  sectionLabel,
  exampleCount,
  onClearExamples,
  onPrimaryAction,
  primaryActionLabel,
  compact = false,
}: ExampleDataBannerProps) {
  const [clearing, setClearing] = useState(false);

  if (exampleCount <= 0) return null;

  const handleClear = async () => {
    setClearing(true);
    try {
      await onClearExamples();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        compact ? 'p-2.5' : 'p-3.5'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="space-y-0.5">
          <div className="font-semibold text-foreground">
            Showing {exampleCount} editable {sectionLabel} {exampleCount === 1 ? 'example' : 'examples'}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Edit or replace any example row with your real data, or clear examples to start with a clean slate.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        {onPrimaryAction && primaryActionLabel && (
          <Button
            type="button"
            variant="emerald"
            size="sm"
            onClick={onPrimaryAction}
            className="h-7 text-[11px] px-2.5"
          >
            {primaryActionLabel}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={clearing}
          onClick={handleClear}
          className="h-7 text-[11px] px-2.5 gap-1 border-amber-500/40 hover:bg-amber-500/15"
        >
          <Trash2 className="w-3 h-3" />
          <span>{clearing ? 'Clearing...' : 'Clear Examples'}</span>
        </Button>
      </div>
    </div>
  );
}
