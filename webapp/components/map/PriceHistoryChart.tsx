'use client';

import React, { useState } from 'react';
import { OfficialRatePoint, UserPriceReport } from '@/lib/parking/types';

interface PriceHistoryChartProps {
  /** Official server-side history, ascending by recordedAt. */
  official: OfficialRatePoint[];
  /** The zone's current official rate; extends the official line to "now". */
  currentRate: number;
  /** The signed-in user's own posted prices (private). */
  mine: UserPriceReport[];
  now?: number;
}

const OFFICIAL_COLOR = '#10b981';
const MINE_COLOR = '#f59e0b';
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/**
 * Official rate history (stepped line) with the user's own posted prices (dots) on top.
 * The two series are drawn from separate sources; nothing here writes data.
 */
export default function PriceHistoryChart({
  official,
  currentRate,
  mine,
  now: nowProp,
}: PriceHistoryChartProps) {
  // Captured once per mount so re-renders are stable.
  const [mountedAt] = useState(() => Date.now());
  const now = nowProp ?? mountedAt;
  const width = 360;
  const height = 140;
  const padLeft = 32;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 20;
  const graphW = width - padLeft - padRight;
  const graphH = height - padTop - padBottom;

  // Official steps, always ending at the current rate "now".
  const officialSteps: OfficialRatePoint[] = [...official].sort((a, b) => a.recordedAt - b.recordedAt);
  const last = officialSteps[officialSteps.length - 1];
  if (!last || last.rate !== currentRate) {
    officialSteps.push({ recordedAt: last ? Math.max(last.recordedAt, now) : now, rate: currentRate });
  }

  const times = [...officialSteps.map((p) => p.recordedAt), ...mine.map((m) => m.observedAt), now];
  let minT = Math.min(...times);
  let maxT = Math.max(...times);
  if (maxT - minT < 7 * DAY_MS) minT = maxT - 7 * DAY_MS;
  maxT = Math.max(maxT, now);

  const rates = [...officialSteps.map((p) => p.rate), ...mine.map((m) => m.rate)];
  const maxRate = Math.max(5, Math.ceil(Math.max(...rates, 0)));

  const x = (t: number) => padLeft + ((t - minT) / (maxT - minT || 1)) * graphW;
  const y = (r: number) => padTop + graphH - (r / maxRate) * graphH;

  // Stepped path: hold each rate until the next point. Start at the left edge.
  let d = `M ${x(minT)} ${y(officialSteps[0].rate)}`;
  for (let i = 0; i < officialSteps.length; i++) {
    const p = officialSteps[i];
    const px = x(Math.max(p.recordedAt, minT));
    if (i > 0) d += ` L ${px} ${y(officialSteps[i - 1].rate)}`;
    d += ` L ${px} ${y(p.rate)}`;
  }
  d += ` L ${x(maxT)} ${y(officialSteps[officialSteps.length - 1].rate)}`;

  const hasOfficialHistory = official.length > 0;
  const realMine = mine.filter((m) => !m.isExample);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs" data-testid="price-history-chart">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-semibold text-foreground text-[11px]">Price History</span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: OFFICIAL_COLOR }} />
            Official
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: MINE_COLOR }} />
            Mine
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto text-muted-foreground"
        role="img"
        aria-label="Official rate history with your posted prices"
      >
        {[0, maxRate / 2, maxRate].map((val, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={y(val)}
              x2={width - padRight}
              y2={y(val)}
              stroke="currentColor"
              strokeOpacity="0.15"
              strokeDasharray="2,2"
            />
            <text x={padLeft - 4} y={y(val) + 3} textAnchor="end" fontSize="9" fill="currentColor">
              ${val.toFixed(val % 1 ? 1 : 0)}
            </text>
          </g>
        ))}

        <path
          d={d}
          fill="none"
          stroke={OFFICIAL_COLOR}
          strokeWidth="2.5"
          strokeLinejoin="round"
          data-series="official"
        />

        {mine.map((m) => (
          <circle
            key={m.id}
            cx={x(m.observedAt)}
            cy={y(m.rate)}
            r={4}
            fill={m.isExample ? 'transparent' : MINE_COLOR}
            stroke={MINE_COLOR}
            strokeWidth={1.5}
            strokeDasharray={m.isExample ? '2,1.5' : undefined}
            data-series="mine"
          >
            <title>
              {`${m.note ? `${m.note} · ` : ''}$${m.rate.toFixed(2)}/hr · ${formatDate(m.observedAt)}${
                m.isExample ? ' (example)' : ''
              }`}
            </title>
          </circle>
        ))}

        <text x={padLeft} y={height - 4} textAnchor="start" fontSize="9" fill="currentColor">
          {formatDate(minT)}
        </text>
        <text x={width - padRight} y={height - 4} textAnchor="end" fontSize="9" fill="currentColor">
          Today
        </text>
      </svg>

      <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        {!hasOfficialHistory && (
          <span>No official rate changes recorded yet. The line shows the current rate.</span>
        )}
        {realMine.length === 0 && <span>Post a price below to plot what you paid.</span>}
        <span>Your posted prices are private and don&apos;t change official rates.</span>
      </div>
    </div>
  );
}
