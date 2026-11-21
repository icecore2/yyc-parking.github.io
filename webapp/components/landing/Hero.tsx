'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Tag Pill */}
        <Badge variant="success" className="gap-2 px-3.5 py-1 text-xs font-semibold mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>Official Calgary On-Street &amp; Parkade Real-Time Rates</span>
        </Badge>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
          Never Overpay for{' '}
          <span className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 bg-clip-text text-transparent">
            Calgary Parking
          </span>{' '}
          Again.
        </h1>

        {/* Subhead */}
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Find the cheapest street stalls, avoid costly <strong className="text-foreground">$100+ rush-hour towing traps</strong>, and compare ParkPlus, City Parkades, CTrain Park &amp; Ride, and Impark rates across 1,600+ Calgary zones.
        </p>

        {/* CTA Button Group */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="emerald" size="lg" className="w-full sm:w-auto font-bold shadow-md shadow-emerald-600/20 gap-2">
            <Link href="/app">
              <MapPin className="w-4 h-4" />
              <span>Launch Live Free Map</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto font-semibold gap-2">
            <Link href="/pricing">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Explore Pro Features ($3.99/mo)</span>
            </Link>
          </Button>
        </div>

        {/* Trust Points */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>1,600+ Calgary Parking Zones</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>Free Sunday Parking Maps</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>CPA Live Feed API Sync</span>
          </div>
        </div>
      </div>
    </section>
  );
}
