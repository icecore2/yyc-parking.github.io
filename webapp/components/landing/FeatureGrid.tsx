import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Building2,
  Navigation2,
  BellRing,
  Receipt,
  Crown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function FeatureGrid() {
  const features = [
    {
      title: '24-Hour Stepped Rate Curves',
      description:
        'Know exactly what parking costs at 10 AM versus 7 PM. Area charts clearly highlight free evening windows and weekend savings.',
      icon: TrendingUp,
      badge: 'Free Feature',
      variant: 'success' as const,
    },
    {
      title: 'Rush-Hour Anti-Tow Warnings',
      description:
        'Never get towed on 4th Ave or 9th Ave again. Critical AM/PM peak restrictions and no-stopping tow zones are prominently flagged.',
      icon: AlertTriangle,
      badge: 'Free Feature',
      variant: 'success' as const,
    },
    {
      title: 'All Operators in One View',
      description:
        'Seamlessly toggle between ParkPlus on-street curbside spots, City parkades (Centennial, Platform), CTrain Park & Ride, and Impark lots.',
      icon: Building2,
      badge: 'Free Feature',
      variant: 'success' as const,
    },
    {
      title: 'Cheapest Spot Proximity Finder',
      description:
        'Heading to the Saddledome, Arts Commons, or Bow Tower? Our optimizer ranks all stalls within a 5-minute walk by lowest total cost.',
      icon: Navigation2,
      badge: 'PRO Feature',
      variant: 'warning' as const,
      isPro: true,
    },
    {
      title: 'Meter Expiry & Tow Alarm',
      description:
        'Set a countdown when you step away. Receive notifications 15 minutes before your time expires or before rush-hour towing commences.',
      icon: BellRing,
      badge: 'PRO Feature',
      variant: 'warning' as const,
      isPro: true,
    },
    {
      title: 'Cloud Favorites & Tax Receipt Export',
      description:
        'Sync your regular work and gym zones across devices. Log business parking expenses and export clean CSV reports for employer claims or CRA tax write-offs.',
      icon: Receipt,
      badge: 'PRO Feature',
      variant: 'warning' as const,
      isPro: true,
    },
  ];

  return (
    <section className="py-16 md:py-24 border-t border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="success" className="text-xs uppercase tracking-widest font-bold mb-2">
            Intelligent City Parking
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-2">
            Everything you need to park faster &amp; pay less
          </h2>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            From casual weekend dining to daily downtown commutes, we turn Calgary&apos;s confusing parking regulations into simple, actionable decisions.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card
                key={idx}
                className={`relative flex flex-col justify-between transition-all hover:shadow-md ${
                  item.isPro ? 'border-amber-500/30 dark:border-amber-500/20' : ''
                }`}
              >
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                          item.isPro
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-primary/15 text-primary'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant={item.variant} className="gap-1 text-[10px]">
                        {item.isPro && <Crown className="w-2.5 h-2.5" />}
                        {item.badge}
                      </Badge>
                    </div>

                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {item.isPro && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                      <span>Included in Pro ($3.99/mo)</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
