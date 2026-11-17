'use client';

import React, { useState } from 'react';
import { generate24HourProfile, ParsedInterval } from '@/lib/parking/rate-parser';
import { HourlyRatePoint } from '@/lib/parking/types';

interface RateCurveChartProps {
  intervals: ParsedInterval[];
}

export default function RateCurveChart({ intervals }: RateCurveChartProps) {
  const [dayType, setDayType] = useState<'weekday' | 'saturday' | 'sunday'>('weekday');
  const profile: HourlyRatePoint[] = generate24HourProfile(intervals, dayType);

  const maxRate = Math.max(5, ...profile.map((p) => p.rate));
  const height = 120;
  const width = 360;
  const paddingLeft = 28;
  const paddingBottom = 20;
  const graphWidth = width - paddingLeft - 10;
  const graphHeight = height - paddingBottom - 10;

  // Build SVG path
  const points = profile.map((pt, i) => {
    const x = paddingLeft + (i / 23) * graphWidth;
    const y = 10 + graphHeight - (pt.rate / maxRate) * graphHeight;
    return { x, y, ...pt };
  });

  let pathD = `M ${paddingLeft} ${10 + graphHeight}`;
  points.forEach((pt) => {
    pathD += ` L ${pt.x} ${pt.y}`;
  });

  const areaD = `${pathD} L ${paddingLeft + graphWidth} ${10 + graphHeight} Z`;

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs">
      {/* Day Selector Pills */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-foreground text-[11px]">24-Hour Rate Profile</span>
        <div className="flex items-center gap-1 bg-background rounded-lg p-0.5 border border-border">
          {(['weekday', 'saturday', 'sunday'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDayType(d)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                dayType === d
                  ? 'bg-emerald-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d === 'weekday' ? 'Mon-Fri' : d === 'saturday' ? 'Sat' : 'Sun'}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-muted-foreground">
          {/* Y-axis gridlines */}
          {[0, maxRate / 2, maxRate].map((val, idx) => {
            const y = 10 + graphHeight - (val / maxRate) * graphHeight;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - 10}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.15"
                  strokeDasharray="2,2"
                />
                <text x={paddingLeft - 4} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor">
                  ${val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="rgba(16, 185, 129, 0.15)" />

          {/* Stepped line */}
          <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

          {/* X-axis labels */}
          {[0, 6, 12, 18, 23].map((hr) => {
            const x = paddingLeft + (hr / 23) * graphWidth;
            const label = hr === 0 ? '12A' : hr === 12 ? '12P' : hr > 12 ? `${hr - 12}P` : `${hr}A`;
            return (
              <text key={hr} x={x} y={height - 4} textAnchor="middle" fontSize="9" fill="currentColor">
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Peak: ${maxRate.toFixed(2)}/hr</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
          {dayType === 'sunday' ? 'Free All Day' : 'Free after enforced hours'}
        </span>
      </div>
    </div>
  );
}
