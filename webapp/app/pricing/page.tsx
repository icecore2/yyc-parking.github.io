import React from 'react';
import Navbar from '@/components/Navbar';
import PricingTable from '@/components/landing/PricingTable';
import FAQ from '@/components/landing/FAQ';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Pricing & Pro Plan — Calgary Parking Map',
  description: 'Choose between the free Calgary Explorer plan or upgrade to Calgary Commuter Pro for the Cheapest Parking Finder and Anti-Tow Alarms.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 py-6">
        <PricingTable />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
