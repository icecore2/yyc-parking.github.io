'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/firebase/auth-context';
import { getUserFavorites, getUserParkingSessions } from '@/lib/firebase/firestore';
import { UserFavoriteSpot, ParkingSession } from '@/lib/parking/types';
import {
  Crown,
  Sparkles,
  Car,
  Heart,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AccountPage() {
  const { user, profile, isPro, toggleDemoTier } = useAuth();
  const [favorites, setFavorites] = useState<UserFavoriteSpot[]>([]);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [vehicles, setVehicles] = useState<{ plate: string; desc: string }[]>([
    { plate: 'BXY-8492', desc: 'Subaru Outback (Silver)' },
  ]);
  const [newPlate, setNewPlate] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    const uid = user ? user.uid : 'demo_user';
    getUserFavorites(uid).then(setFavorites);
    getUserParkingSessions(uid).then(setSessions);
  }, [user]);

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    setVehicles([...vehicles, { plate: newPlate.toUpperCase().trim(), desc: newDesc.trim() || 'Vehicle' }]);
    setNewPlate('');
    setNewDesc('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Profile Header Card */}
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl shadow-md">
                {(profile?.displayName || user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">
                    {profile?.displayName || user?.displayName || 'Calgary Commuter'}
                  </h1>
                  <Badge variant={isPro ? 'warning' : 'secondary'} className="gap-1">
                    {isPro && <Crown className="w-3 h-3" />}
                    {isPro ? 'PRO PLAN' : 'FREE TIER'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile?.email || user?.email || 'calgary.driver@example.com'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleDemoTier}
              className="text-xs font-semibold"
            >
              Toggle Demo Tier: {isPro ? 'Switch to Free' : 'Switch to Pro'}
            </Button>
          </CardContent>
        </Card>

        {/* Subscription Management Box */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Subscription Status</h2>
                  <p className="text-xs text-muted-foreground">
                    {isPro
                      ? 'Active Calgary Commuter Pro subscription'
                      : 'Currently on the Free Calgary Explorer plan'}
                  </p>
                </div>
              </div>

              {isPro ? (
                <Badge variant="success" className="gap-1 px-3 py-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active
                </Badge>
              ) : (
                <Button asChild variant="emerald" size="sm" className="gap-1.5">
                  <Link href="/pricing">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Upgrade to Pro ($3.99/mo)</span>
                  </Link>
                </Button>
              )}
            </div>

            <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl border border-border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Cheapest Spot Finder</span>
                <span className="font-semibold text-foreground">
                  {isPro ? 'Unlocked (Full Proximity)' : 'Locked (Preview only)'}
                </span>
              </div>
              <div className="p-3 rounded-2xl border border-border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Parking Alarms</span>
                <span className="font-semibold text-foreground">
                  {isPro ? 'Unlimited Notifications' : 'Inactive'}
                </span>
              </div>
              <div className="p-3 rounded-2xl border border-border bg-muted/20">
                <span className="text-[10px] text-muted-foreground block">Cloud Saved Spots</span>
                <span className="font-semibold text-foreground">
                  {isPro ? 'Unlimited Multi-Device' : '1 spot max (Local)'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicles / License Plates (for ParkPlus lookup) */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Registered Vehicles</h2>
                <p className="text-xs text-muted-foreground">
                  Keep license plates handy for 1-tap entry into ParkPlus &amp; hangTag
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {vehicles.map((v, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl border border-border bg-background flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono font-bold text-sm tracking-widest text-foreground block">
                      {v.plate}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{v.desc}</span>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    Primary
                  </Badge>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddVehicle} className="flex gap-2 pt-2">
              <Input
                type="text"
                placeholder="PLATE (e.g. ABC-1234)"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                className="w-40 font-mono uppercase"
              />
              <Input
                type="text"
                placeholder="Vehicle description (e.g. Honda Civic Blue)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="emerald" size="sm">
                Add Vehicle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Saved Favorites & Expense Export Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <h3 className="font-bold text-sm text-foreground">Saved Favorites ({favorites.length})</h3>
                </div>
                <Link href="/app" className="text-xs text-primary hover:underline">
                  View on Map →
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                Bookmarked parking stalls near your home, office, and downtown Calgary destinations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-sm text-foreground">Parking Expenses ({sessions.length})</h3>
                </div>
                <Link href="/expenses" className="text-xs text-primary hover:underline">
                  Export CSV →
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                View your parking transaction log and export monthly reports for CRA business tax write-offs.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
