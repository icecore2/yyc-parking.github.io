'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Hero from '@/components/landing/Hero';
import FeatureGrid from '@/components/landing/FeatureGrid';
import PricingTable from '@/components/landing/PricingTable';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/Footer';

const MiniMapTeaser = dynamic(() => import('@/components/landing/MiniMapTeaser'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full rounded-3xl border border-border bg-card/60 animate-pulse flex items-center justify-center text-xs text-muted-foreground">
      Loading Calgary Map Preview...
    </div>
  ),
});

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        <Hero />

        {/* Embedded Interactive Teaser Map */}
        <section className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto -mt-6 mb-12">
          <MiniMapTeaser />
        </section>

        <FeatureGrid />

        <PricingTable />

        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
