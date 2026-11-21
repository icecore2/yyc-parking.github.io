'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, Crown, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function PricingTable() {
  const { isPro, upgradeToProDemo, toggleDemoTier } = useAuth();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const handleStripeCheckout = (plan: 'monthly' | 'annual') => {
    upgradeToProDemo();
    alert(`Success! You have activated Calgary Parking PRO (${plan === 'annual' ? 'Annual Pass: $29.99/yr' : 'Monthly: $3.99/mo'}). All Pro tools are now unlocked.`);
  };

  return (
    <section id="pricing" className="py-16 md:py-24 border-t border-border">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <Badge variant="success" className="uppercase tracking-widest text-xs font-bold mb-2">
            Simple, Transparent Pricing
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            Free forever, or upgrade for superpower features
          </h2>
          <p className="text-sm text-muted-foreground mt-3">
            One saved parking ticket easily pays for over 2 years of Pro membership.
          </p>

          {/* Billing Toggle */}
          <div className="mt-6 inline-flex items-center rounded-2xl border border-border bg-card p-1 shadow-sm">
            <Button
              type="button"
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
              className="h-8 text-xs font-semibold"
            >
              Monthly Billing
            </Button>
            <Button
              type="button"
              variant={billingPeriod === 'annual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('annual')}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              Annual Billing
              <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-4">
                Save 37%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Free Tier Card */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg font-bold">Calgary Explorer</CardTitle>
                <Badge variant="secondary">Free Forever</Badge>
              </div>
              <CardDescription className="text-xs">
                Essential tools for anyone parking occasionally in Calgary.
              </CardDescription>

              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-black text-foreground">$0</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
            </CardHeader>

            <CardContent className="px-8 space-y-3 pt-4 border-t border-border text-xs">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Full MapLibre vector map access</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>1,600+ On-street ParkPlus zones &amp; rates</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Real-time active rate calculator</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Search by Zone number or street name</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Rush-hour towing warning banners</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Save 1 favorite spot locally</span>
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-6">
              <Button asChild variant="outline" className="w-full h-9.5 text-xs sm:text-sm font-semibold rounded-lg gap-2">
                <Link href="/app">
                  <span>Launch Free Map</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Pro Tier Card */}
          <Card className="relative border-2 border-primary shadow-xl flex flex-col justify-between overflow-hidden">
            {/* Pro Ribbon */}
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider py-1 px-4 rounded-bl-xl shadow-sm flex items-center gap-1">
              <Crown className="w-3 h-3" />
              Most Popular
            </div>

            <CardHeader className="p-8 pb-4">
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg font-bold">Calgary Commuter Pro</CardTitle>
                <Badge variant="warning">PRO</Badge>
              </div>
              <CardDescription className="text-xs">
                For daily downtown workers, regular diners, and drivers who hate parking tickets.
              </CardDescription>

              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-black text-foreground">
                  {billingPeriod === 'monthly' ? '$3.99' : '$2.49'}
                </span>
                <span className="text-xs text-muted-foreground">/ month</span>
                {billingPeriod === 'annual' && (
                  <span className="text-[11px] text-primary font-semibold ml-2">
                    ($29.99 billed annually)
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-8 space-y-3 pt-4 border-t border-border text-xs">
              <div className="flex items-center gap-2.5 font-medium text-foreground">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Everything in Free, plus:</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground">Destination &quot;Cheapest Spot&quot; Proximity Optimizer</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground">Parking Expiry &amp; Towing Sweeper Push Alarms</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Unlimited Cloud Favorites &amp; Cross-Device Sync</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Historical 24h Price Curves &amp; Peak Rate Trends</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Parking Expense Tracker &amp; Tax Receipt CSV Export</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>100% Ad-Free Priority Experience</span>
              </div>
            </CardContent>

            <CardFooter className="p-8 pt-6 flex flex-col gap-2">
              <Button
                type="button"
                variant="emerald"
                onClick={() => handleStripeCheckout(billingPeriod)}
                className="w-full h-9.5 text-xs sm:text-sm font-semibold rounded-lg gap-2"
              >
                <Crown className="w-4 h-4" />
                <span>{isPro ? 'You are Subscribed to PRO' : 'Upgrade to Pro with Stripe'}</span>
              </Button>

              <button
                type="button"
                onClick={toggleDemoTier}
                className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground py-1"
              >
                (Developer Demo Mode: Click here to instantly toggle Pro state)
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}
