import React from 'react';
import { Bricolage_Grotesque } from 'next/font/google';
import Navbar from '@/components/Navbar';
import ChinookHero from '@/components/landing/ChinookHero';
import DayMoments from '@/components/landing/DayMoments';
import LandingPricing from '@/components/landing/LandingPricing';
import Footer from '@/components/Footer';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['300', '500', '700'],
  display: 'swap',
});

export default function LandingPage() {
  return (
    <div className={`relative min-h-screen flex flex-col bg-background text-foreground ${bricolage.className}`}>
      <Navbar variant="overlay" />

      <main className="flex-1">
        <ChinookHero />
        <DayMoments />
        <LandingPricing />
      </main>

      <Footer />
    </div>
  );
}
