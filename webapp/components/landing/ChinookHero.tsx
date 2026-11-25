'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  downtownVerdict,
  formatClock,
  getCalgaryTime,
  skyPhase,
  type SkyPhase,
} from '@/lib/parking/calgary-clock';

type SkyPalette = { top: string; arch: string; cloud: string; ridgeFar: string; ridge: string };

const SKIES: Record<SkyPhase, SkyPalette> = {
  dawn: { top: '#3D4D6E', arch: '#F2B98B', cloud: '#5B5F78', ridgeFar: '#6A6E8E', ridge: '#2D3650' },
  day: { top: '#36618F', arch: '#9FC6E6', cloud: '#5C6E88', ridgeFar: '#7D93B2', ridge: '#3A4C6A' },
  dusk: { top: '#2C2E57', arch: '#E89A6B', cloud: '#46496E', ridgeFar: '#4F4F75', ridge: '#20243F' },
  night: { top: '#0E1A30', arch: '#2D4A70', cloud: '#1B273C', ridgeFar: '#1E2C45', ridge: '#0A1222' },
};

// Re-render once a minute so the clock and verdict stay current.
function subscribeToMinute(onChange: () => void) {
  let interval: ReturnType<typeof setInterval> | undefined;
  const timeout = setTimeout(() => {
    onChange();
    interval = setInterval(onChange, 60_000);
  }, 60_000 - (Date.now() % 60_000));
  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}
const getMinute = () => Math.floor(Date.now() / 60_000);
const getServerMinute = () => null;

export default function ChinookHero() {
  // null on the server and during hydration; the live sky and statement fade in once mounted.
  const minute = useSyncExternalStore(subscribeToMinute, getMinute, getServerMinute);
  const now = minute === null ? null : getCalgaryTime(new Date(minute * 60_000));
  const sky = SKIES[now ? skyPhase(now) : 'night'];

  return (
    <section
      className="chinook-sky relative isolate flex min-h-svh flex-col overflow-hidden bg-[#16233A] text-white"
      style={
        {
          '--sky-top': sky.top,
          '--sky-arch': sky.arch,
          '--sky-cloud': sky.cloud,
          '--sky-ridge-far': sky.ridgeFar,
          '--sky-ridge': sky.ridge,
        } as React.CSSProperties
      }
    >
      <div
        aria-hidden="true"
        className={`chinook-reveal absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--sky-top)_0%,var(--sky-arch)_78%)] ${now ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Chinook arch: a cloud deck with a band of clear sky beneath it */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46%] w-full"
        viewBox="0 0 1440 400"
        preserveAspectRatio="none"
      >
        <path d="M0 0 H1440 V250 C 1180 210, 980 330, 720 330 C 460 330, 260 205, 0 250 Z" fill="var(--sky-cloud)" opacity="0.92" />
        <path d="M0 0 H1440 V200 C 1180 170, 980 270, 720 270 C 460 270, 260 165, 0 200 Z" fill="var(--sky-cloud)" />
      </svg>

      {/* Rockies on the horizon and the downtown skyline */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[34%] w-full"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
      >
        <path
          d="M0 210 L90 150 L160 190 L250 110 L330 170 L420 95 L510 160 L600 120 L690 175 L780 105 L880 165 L960 125 L1060 180 L1150 115 L1240 170 L1330 130 L1440 175 V300 H0 Z"
          fill="var(--sky-ridge-far)"
        />
        <path d="M0 260 L1440 250 V300 H0 Z" fill="var(--sky-ridge)" />
        <g fill="var(--sky-ridge)">
          <rect x="1010" y="170" width="26" height="85" />
          <rect x="1042" y="140" width="34" height="115" />
          <rect x="1082" y="185" width="22" height="70" />
          <rect x="1110" y="120" width="30" height="135" />
          <rect x="1146" y="160" width="40" height="95" />
          <rect x="1196" y="92" width="6" height="163" />
          <ellipse cx="1199" cy="96" rx="14" ry="9" />
          <rect x="1210" y="175" width="28" height="80" />
          <rect x="1244" y="150" width="24" height="105" />
        </g>
      </svg>

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-36 pb-[38vh] sm:px-8 md:pt-[22vh] [text-shadow:0_1px_18px_rgba(14,26,48,0.25)]">
        <p
          key={now ? 'live-clock' : 'fallback-clock'}
          className={`m-0 text-[clamp(44px,8.4vw,128px)] font-light leading-[0.95] tracking-[-0.035em] ${now ? 'chinook-fade' : ''}`}
        >
          {now ? `It's ${formatClock(now)} in Calgary.` : 'Calgary parking, right now.'}
        </p>
        <h1
          aria-live="polite"
          key={now ? 'live-verdict' : 'fallback-verdict'}
          className={`mt-5 max-w-[22ch] text-[clamp(26px,3.4vw,48px)] font-medium leading-[1.12] tracking-[-0.015em] ${now ? 'chinook-fade' : ''}`}
        >
          {now ? downtownVerdict(now) : 'See what every street, parkade and lot in Calgary costs at this moment.'}
        </h1>
        <p className="mt-6 mb-8 max-w-[48ch] text-lg leading-relaxed text-white/90">
          We track rates, free hours and rush-hour tow windows for 1,600+ zones, so the map always shows what parking
          costs right now.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <Link
            href="/app"
            className="rounded-full bg-[#F3F6FA] px-6.5 py-3.5 text-[17px] font-bold text-[#1E2838] [text-shadow:none] transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#E2B158]"
          >
            Open the map
          </Link>
          <Link
            href="#pricing"
            className="rounded-full border-[1.5px] border-white/80 bg-[#0E1A30]/20 px-6.5 py-3.5 text-[17px] font-bold transition-colors hover:bg-white/15 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#E2B158]"
          >
            See Pro
          </Link>
        </div>
      </div>
    </section>
  );
}
