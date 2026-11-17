'use client';

import React, { useState } from 'react';
import { ParkingZone, ProximityResult } from '@/lib/parking/types';
import { findCheapestParkingSpots } from '@/lib/parking/optimizer';
import { Footprints, Crown } from 'lucide-react';
import { formatDistance } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface CheapestSpotFinderProps {
  zones: ParkingZone[];
  onSelectZone: (zone: ParkingZone) => void;
  onClose: () => void;
}

const POPULAR_DESTINATIONS: { name: string; coords: [number, number] }[] = [
  { name: 'Scotiabank Saddledome / Stampede', coords: [-114.0519, 51.0374] },
  { name: 'Stephen Ave (8th Ave Walkway)', coords: [-114.0719, 51.0447] },
  { name: 'The Bow Tower / Core Downtown', coords: [-114.0622, 51.0494] },
  { name: 'Core Shopping Centre (4th St SW)', coords: [-114.0705, 51.0458] },
  { name: 'Eau Claire Market & Plaza', coords: [-114.0694, 51.0543] },
  { name: '17th Avenue SW (Red Mile)', coords: [-114.0729, 51.0379] },
  { name: 'Kensington Shopping District', coords: [-114.0862, 51.0531] },
];

export default function CheapestSpotFinder({
  zones,
  onSelectZone,
  onClose,
}: CheapestSpotFinderProps) {
  const [selectedDest, setSelectedDest] = useState(POPULAR_DESTINATIONS[0]);
  const [durationHours, setDurationHours] = useState<number>(2);
  const [radiusMeters, setRadiusMeters] = useState<number>(800);

  const results: ProximityResult[] = findCheapestParkingSpots(
    selectedDest.coords,
    zones,
    durationHours,
    radiusMeters
  );

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Cheapest Parking Finder</DialogTitle>
              <DialogDescription>
                Destination proximity optimizer: ranks closest stalls by lowest total cost
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Destination & Options Controls */}
        <div className="py-3 space-y-3 border-b border-border text-xs">
          <div>
            <Label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Target Destination in Calgary
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {POPULAR_DESTINATIONS.map((d, i) => (
                <Button
                  key={i}
                  type="button"
                  variant={selectedDest.name === d.name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDest(d)}
                  className="h-8 justify-start truncate text-xs"
                >
                  <span className="truncate">{d.name}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Parking Duration
              </Label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 8].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={durationHours === h ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDurationHours(h)}
                    className="flex-1 h-8"
                  >
                    {h}h
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Max Walking Distance
              </Label>
              <div className="flex items-center gap-1.5">
                {[
                  { m: 400, label: '400m' },
                  { m: 800, label: '800m' },
                  { m: 1200, label: '1.2km' },
                ].map((r) => (
                  <Button
                    key={r.m}
                    type="button"
                    variant={radiusMeters === r.m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRadiusMeters(r.m)}
                    className="flex-1 h-8"
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pb-1">
            <span>Found {results.length} available zones nearby</span>
            <span>Sorted by lowest total cost</span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No parking zones found within {radiusMeters}m of {selectedDest.name}. Try increasing the walking distance!
            </div>
          ) : (
            results.slice(0, 15).map((res, idx) => (
              <Card
                key={idx}
                className="hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm truncate">
                        {res.zone.title}
                      </span>
                      {idx === 0 && (
                        <Badge variant="success" className="text-[10px] font-extrabold">
                          ⭐ CHEAPEST OPTION
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs truncate mt-0.5">
                      {res.zone.address}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Footprints className="w-3.5 h-3.5 text-primary" />
                        {formatDistance(res.distanceMeters)} (~{res.walkingMinutes} min walk)
                      </span>
                      <span>•</span>
                      <span>Rate: {res.hourlyRate === 0 ? 'FREE' : `$${res.hourlyRate.toFixed(2)}/hr`}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-primary">
                      {res.totalCostDollars === 0 ? 'FREE' : `$${res.totalCostDollars.toFixed(2)}`}
                    </div>
                    <span className="block text-[10px] text-muted-foreground">
                      Total for {durationHours}h
                    </span>
                    <Button
                      size="sm"
                      variant="emerald"
                      onClick={() => {
                        onSelectZone(res.zone);
                        onClose();
                      }}
                      className="mt-1.5 h-7 text-[11px]"
                    >
                      Select Spot
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
