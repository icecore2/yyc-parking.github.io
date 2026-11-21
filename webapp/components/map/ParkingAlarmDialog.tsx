'use client';

import React, { useState } from 'react';
import { ParkingZone } from '@/lib/parking/types';
import { BellRing, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { saveParkingSession } from '@/lib/firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ParkingAlarmDialogProps {
  zone: ParkingZone;
  onClose: () => void;
}

export default function ParkingAlarmDialog({ zone, onClose }: ParkingAlarmDialogProps) {
  const { user, profile } = useAuth();
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [leadMinutes, setLeadMinutes] = useState<number>(15);
  const [isAlarmActive, setIsAlarmActive] = useState(false);

  const handleStartAlarm = async () => {
    const now = Date.now();
    const expiry = now + durationMinutes * 60 * 1000;
    const durationHours = durationMinutes / 60;
    const totalCost = Number((durationHours * zone.activeRate).toFixed(2));

    const uid = user?.uid || profile?.uid || 'demo_user';

    await saveParkingSession(uid, {
      id: `session_${now}`,
      zoneId: zone.id,
      address: zone.address,
      startTime: now,
      durationHours,
      hourlyRate: zone.activeRate,
      totalCostDollars: totalCost,
      expiryTime: expiry,
      alertLeadMinutes: leadMinutes,
      active: true,
      notes: `Parked at ${zone.title}`,
    });

    setIsAlarmActive(true);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  return (
    <Dialog open={Boolean(zone)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>Set Parking Alarm</DialogTitle>
              <DialogDescription>{zone.title} • {zone.address}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isAlarmActive ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-foreground text-sm">Parking Alarm Active!</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              We&apos;ll notify you {leadMinutes} minutes before your time expires so you can return to your car or extend your ParkPlus session safely.
            </p>
            <Button
              onClick={onClose}
              variant="emerald"
              className="mt-4"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-xs py-2">
            <div>
              <Label className="block mb-2">
                How long are you parking for?
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { m: 30, label: '30 min' },
                  { m: 60, label: '1 hour' },
                  { m: 120, label: '2 hours' },
                  { m: 180, label: '3 hours' },
                ].map((d) => (
                  <Button
                    key={d.m}
                    type="button"
                    variant={durationMinutes === d.m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDurationMinutes(d.m)}
                    className="h-9"
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="block mb-2">
                Notify me in advance:
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { m: 5, label: '5 min prior' },
                  { m: 10, label: '10 min prior' },
                  { m: 15, label: '15 min prior' },
                ].map((l) => (
                  <Button
                    key={l.m}
                    type="button"
                    variant={leadMinutes === l.m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLeadMinutes(l.m)}
                    className="h-8 text-xs rounded-md"
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Rush-Hour Tow Warning Reminder */}
            {zone.restrictions && zone.restrictions.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-2.5 flex items-start gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  This zone has peak restrictions. Make sure you depart before the designated rush-hour tow window!
                </span>
              </div>
            )}

            <Button
              onClick={handleStartAlarm}
              variant="emerald"
              size="default"
              className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-semibold rounded-lg mt-2"
            >
              <BellRing className="w-4 h-4" />
              Activate Alarm
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
