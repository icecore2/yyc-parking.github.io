'use client';

import React, { useState, useEffect } from 'react';
import { ParkingZone, RateSnapshot } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { parseRateSchedule } from '@/lib/parking/rate-parser';
import RateCurveChart from './RateCurveChart';
import { ExampleBadge } from '@/components/onboarding/ExampleDataBanner';
import {
  Navigation,
  Heart,
  BellRing,
  ExternalLink,
  Check,
  Clock,
  Focus,
  Footprints,
  Info,
  Camera,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  createRateSnapshot,
  getUserFavorites,
  getZoneRateSnapshots,
  saveUserFavorite,
  saveZoneRateSnapshots,
} from '@/lib/firebase/firestore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ZoneDetailSheetProps {
  zone: ParkingZone;
  onClose: () => void;
  onTriggerProGate: (feature: string, desc: string) => void;
  onOpenAlarm: (zone: ParkingZone) => void;
  onZoomToZone?: (zone: ParkingZone) => void;
}

type TabType = 'overview' | 'rates' | 'history' | 'rules';

export default function ZoneDetailSheet({
  zone,
  onClose,
  onTriggerProGate,
  onOpenAlarm,
  onZoomToZone,
}: ZoneDetailSheetProps) {
  const { user, profile, isPro } = useAuth();
  const uid = user?.uid || profile?.uid || 'demo_user';
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [savedSnapshots, setSavedSnapshots] = useState<RateSnapshot[]>(() =>
    getZoneRateSnapshots(uid, zone.id, zone.activeRate)
  );
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editSnapPeriod, setEditSnapPeriod] = useState('');
  const [editSnapRate, setEditSnapRate] = useState('');

  const provider = PROVIDERS[zone.provider] || PROVIDERS.parkplus_on_street;
  const { intervals } = parseRateSchedule(zone.enforceableHours);

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${zone.coordinates[1]},${zone.coordinates[0]}`;

  useEffect(() => {
    let cancelled = false;
    getUserFavorites(uid).then((favs) => {
      if (cancelled) return;
      setIsSaved(favs.some((f) => f.zoneId === zone.id || f.id === zone.id));
    });
    return () => {
      cancelled = true;
    };
  }, [uid, zone.id]);

  const handleSaveFavorite = async () => {
    if (!isPro && !user && !profile) {
      onTriggerProGate(
        'Cloud Saved Favorites',
        'Upgrade to Calgary Commuter Pro to sync your favorite parking zones across all your devices.'
      );
      return;
    }

    try {
      setSaveLoading(true);
      await saveUserFavorite(uid, {
        id: zone.id,
        zoneId: zone.id,
        label: zone.title,
        address: zone.address,
        hourlyRate: zone.activeRate,
        coordinates: zone.coordinates,
        provider: zone.provider,
        createdAt: Date.now(),
      });
      setIsSaved(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAlarmClick = () => {
    if (!isPro) {
      onTriggerProGate(
        'Parking Expiry & Tow Alarms',
        'Get automated notifications 15 minutes before your meter expires or street cleaning begins.'
      );
      return;
    }
    onOpenAlarm(zone);
  };

  const handleTakeSnapshot = () => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const nextSnapshot: RateSnapshot = {
      id: `snap_${now.getTime()}`,
      period: timeStr,
      rate: zone.activeRate,
      createdAt: now.getTime(),
      isExample: false,
    };
    const next = [...savedSnapshots, nextSnapshot];
    setSavedSnapshots(next);
    saveZoneRateSnapshots(uid, zone.id, next);
  };

  const handleClearExampleSnapshots = () => {
    const next = savedSnapshots.filter((s) => !s.isExample);
    setSavedSnapshots(next);
    saveZoneRateSnapshots(uid, zone.id, next, true);
  };

  const startEditSnapshot = (snap: RateSnapshot) => {
    setEditingSnapshotId(snap.id);
    setEditSnapPeriod(snap.period);
    setEditSnapRate(snap.rate.toFixed(2));
  };

  const handleSaveSnapshotEdit = (orig: RateSnapshot) => {
    const parsedRate = parseFloat(editSnapRate);
    if (!editSnapPeriod.trim() || !Number.isFinite(parsedRate) || parsedRate < 0) return;

    const updatedSnap: RateSnapshot = orig.isExample
      ? createRateSnapshot(editSnapPeriod, parsedRate, orig.createdAt)
      : {
          ...orig,
          period: editSnapPeriod.trim(),
          rate: Number(parsedRate.toFixed(2)),
          isExample: false,
        };

    const next = savedSnapshots.map((s) => (s.id === orig.id ? updatedSnap : s));
    const hasRemainingExample = next.some((s) => s.isExample);
    setSavedSnapshots(next);
    saveZoneRateSnapshots(uid, zone.id, next, !hasRemainingExample);
    setEditingSnapshotId(null);
  };

  const handleDeleteSnapshot = (snap: RateSnapshot) => {
    const next = savedSnapshots.filter((s) => s.id !== snap.id);
    const hasRemainingExample = next.some((s) => s.isExample);
    setSavedSnapshots(next);
    saveZoneRateSnapshots(uid, zone.id, next, !hasRemainingExample);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-40 w-full sm:max-w-md md:max-w-lg p-0 flex flex-col gap-0 border-l border-border bg-card text-card-foreground shadow-2xl transition-all duration-300 ease-in-out"
      style={{ backgroundColor: 'var(--card)' }}
      role="region"
      aria-label="Parking Zone Details"
    >
      {/* Header with Close Button */}
      <div
        className="flex items-start justify-between border-b border-border p-4 bg-card text-left shrink-0"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <div className="flex flex-col gap-1 pr-3">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${provider.badgeClass}`}
            >
              {provider.shortName}
            </span>
            <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
              {zone.title}
            </Badge>
            <Badge variant="secondary">
              {zone.stallType || 'Standard'}
            </Badge>
          </div>
          <h2 className="text-sm sm:text-base font-semibold text-foreground leading-snug">
            {zone.address}
          </h2>
          <p className="text-xs text-muted-foreground">
            {zone.brz ? `${zone.brz} District · ` : ''}Managed by {provider.operator}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="iconSm"
          onClick={onClose}
          className="rounded-xl text-muted-foreground hover:text-foreground shrink-0"
          title="Close details (Esc)"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as TabType)}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="px-4 pt-2 border-b border-border bg-muted/40 shrink-0">
          <TabsList className="grid grid-cols-4 w-full h-9">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rates">Rates</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
        </div>

        {/* Scrollable Body */}
        <div
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-card"
          style={{ backgroundColor: 'var(--card)' }}
        >
            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="mt-0 flex flex-col gap-3">
              {/* Location & Facility Card */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Location &amp; Facility
                  </span>
                  <div className="text-xs font-semibold text-foreground leading-snug">
                    {zone.address}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="rounded-xl border border-border bg-muted/40 p-2 text-xs">
                      <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                        Facility Type
                      </span>
                      <span className="font-semibold text-foreground truncate block">
                        {zone.zoneType || 'On-Street Curbside'}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/40 p-2 text-xs">
                      <span className="text-muted-foreground block text-[10px] uppercase font-medium">
                        Operator
                      </span>
                      <span className="font-semibold text-foreground truncate block">
                        {provider.operator}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Live Rate & Target Proximity Card */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Live Rate
                    </span>
                    <Badge
                      variant={zone.isCurrentlyFree ? 'success' : 'default'}
                      className="text-xs font-bold"
                    >
                      {zone.isCurrentlyFree ? 'FREE PARKING' : `$${zone.activeRate.toFixed(2)} / hr`}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {zone.isCurrentlyFree
                      ? 'Outside Enforceable Hours / Free Parking'
                      : `Active Daytime Rate: $${zone.activeRate.toFixed(2)}/hr`}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                    <span>Price Tier:</span>
                    <span className="font-bold text-foreground">{zone.priceZone || 'Standard CPA'}</span>
                  </div>

                  {zone.distanceToTarget !== undefined && zone.distanceToTarget !== null && (
                    <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-2 text-xs font-semibold text-primary">
                      <Footprints className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        {Math.round(zone.distanceToTarget)}m (~{zone.walkingMinutes} min walk) from destination
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="p-3 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Stall Capacity
                    </span>
                    <span className="text-base font-bold text-foreground">
                      {zone.stallCount || 12}{' '}
                      <span className="text-xs font-normal text-muted-foreground">stalls</span>
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Stall Type
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">
                      {zone.stallType || 'Parallel Curbside'}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Enforceable Hours */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Enforceable Schedule</span>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {zone.enforceableHours || '09:00 - 18:00 Mon-Sat'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Max stay duration: <strong className="text-foreground">{zone.maxStayHours || 3} Hours</strong>
                  </div>
                </CardContent>
              </Card>

              {/* Direct Directions & Details */}
              <Card>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <span className="font-semibold block text-foreground">Turn-by-turn Navigation</span>
                      <span className="text-muted-foreground text-[10px]">Open coordinates in maps app</span>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                      Directions
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: RATES */}
            <TabsContent value="rates" className="mt-0 flex flex-col gap-3">
              {/* Interactive 24-Hour Rate Curve Chart */}
              <RateCurveChart intervals={intervals} />

              {/* Schedule Windows Table */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Schedule Breakdown
                  </span>
                  <div className="space-y-1.5 divide-y divide-border text-xs">
                    {intervals && intervals.length > 0 ? (
                      intervals.map((int, i) => (
                        <div key={i} className="pt-1.5 first:pt-0 flex items-center justify-between">
                          <span className="text-muted-foreground">{int.header || 'Schedule Window'}</span>
                          <span className="font-bold text-foreground">
                            {int.isFree ? 'FREE' : int.price !== null ? `$${int.price.toFixed(2)}/hr` : int.rateText}
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Mon - Fri (09:00 - 18:00)</span>
                          <span className="font-bold text-foreground">${zone.activeRate.toFixed(2)}/hr</span>
                        </div>
                        <div className="pt-1.5 flex items-center justify-between">
                          <span className="text-muted-foreground">Saturday (09:00 - 18:00)</span>
                          <span className="font-bold text-foreground">
                            ${Math.max(1.5, zone.activeRate - 1.0).toFixed(2)}/hr
                          </span>
                        </div>
                        <div className="pt-1.5 flex items-center justify-between">
                          <span className="text-muted-foreground">Sunday &amp; Stat Holidays</span>
                          <Badge variant="success">FREE</Badge>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Free Parking Times */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <strong>Tip:</strong> All Calgary on-street ParkPlus zones offer free parking on Sundays and statutory holidays!
                </span>
              </div>
            </TabsContent>

            {/* TAB 3: HISTORY */}
            <TabsContent value="history" className="mt-0 flex flex-col gap-3">
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Rate Audit History
                    </span>
                    <div className="flex items-center gap-1">
                      {savedSnapshots.some((s) => s.isExample) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearExampleSnapshots}
                          className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                        >
                          Clear Examples
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleTakeSnapshot}
                        className="h-7 text-[11px] gap-1 text-primary"
                      >
                        <Camera className="w-3 h-3" />
                        Take Snapshot
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Track price fluctuations in this parking zone. Edit or replace example baseline rows, or capture live rate snapshots.
                  </p>
                  <div className="space-y-1.5 divide-y divide-border text-xs mt-1">
                    {savedSnapshots.length === 0 ? (
                      <div className="py-3 text-center text-[11px] text-muted-foreground">
                        No snapshots recorded. Click &quot;Take Snapshot&quot; above to log the current rate.
                      </div>
                    ) : (
                      savedSnapshots.map((item) => (
                        <div key={item.id} className="pt-2 first:pt-0">
                          {editingSnapshotId === item.id ? (
                            <div className="flex flex-col gap-1.5 py-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="text"
                                  value={editSnapPeriod}
                                  onChange={(e) => setEditSnapPeriod(e.target.value)}
                                  className="h-7 text-xs flex-1"
                                  placeholder="Label (e.g. Nov Peak)"
                                />
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  value={editSnapRate}
                                  onChange={(e) => setEditSnapRate(e.target.value)}
                                  className="h-7 text-xs w-20"
                                />
                              </div>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingSnapshotId(null)}
                                  className="h-6 text-[11px]"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  variant="emerald"
                                  size="sm"
                                  onClick={() => handleSaveSnapshotEdit(item)}
                                  className="h-6 text-[11px]"
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-muted-foreground truncate">{item.period}</span>
                                {item.isExample && <ExampleBadge label="Example" />}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-bold text-foreground mr-1">
                                  ${item.rate.toFixed(2)}/hr
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="iconSm"
                                  onClick={() => startEditSnapshot(item)}
                                  title="Edit snapshot"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="iconSm"
                                  onClick={() => handleDeleteSnapshot(item)}
                                  title="Delete snapshot"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3.5 flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Occupancy Trends
                  </span>
                  <div className="text-xs text-muted-foreground">
                    High demand hours in this area occur between <strong className="text-foreground">11:30 AM - 1:30 PM</strong> on weekdays.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: RULES */}
            <TabsContent value="rules" className="mt-0 flex flex-col gap-3">
              {/* Active Restriction Alert */}
              {zone.restrictions && zone.restrictions.length > 0 ? (
                zone.restrictions.map((res, i) => (
                  <div
                    key={i}
                    className="rounded-xl border-l-4 border-amber-500 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1"
                  >
                    <span className="font-bold uppercase tracking-wider text-[10px]">
                      Active Parking Restriction
                    </span>
                    <p>{res}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col gap-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">
                    No Rush-Hour Towing Restrictions
                  </span>
                  <p>Standard pay-parking rules apply during enforceable hours.</p>
                </div>
              )}

              {/* ParkPlus Instructions */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Session Payment Rules
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Start your session on the MyParking app, pay station, or text your Zone # to 77587.
                    Payment is required for the entire duration parked within enforceable hours.
                  </p>
                </CardContent>
              </Card>

              {/* Pro Feature: Alarm */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAlarmClick}
                className="w-full justify-between h-auto py-2 px-3 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-amber-500" />
                  <span>Set Expiry / Tow Sweeper Alarm</span>
                </div>
                {!isPro && (
                  <Badge variant="warning" className="text-[10px] font-bold">
                    PRO
                  </Badge>
                )}
              </Button>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div
          className="border-t border-border p-3.5 bg-card flex flex-col gap-2 shrink-0"
          style={{ backgroundColor: 'var(--card)' }}
        >
          {zone.paymentUrl && (
            <Button asChild variant="emerald" size="default" className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-semibold rounded-lg">
              <a href={zone.paymentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Pay on {provider.paymentApp || 'Provider Website'}</span>
              </a>
            </Button>
          )}

          {onZoomToZone && (
            <Button
              type="button"
              onClick={() => onZoomToZone(zone)}
              variant="default"
              size="default"
              className="w-full h-8.5 sm:h-9 text-xs sm:text-sm font-semibold rounded-lg"
            >
              <Focus className="h-3.5 w-3.5" />
              <span>Zoom into Facility</span>
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs rounded-md">
              <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="h-3.5 w-3.5 text-primary" />
                <span>Google Maps</span>
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveFavorite}
              disabled={saveLoading || isSaved}
              className={`w-full h-8 text-xs rounded-md ${isSaved ? 'text-rose-600 font-semibold' : ''}`}
            >
              {isSaved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-rose-500" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span>Save Favorite</span>
                </>
              )}
            </Button>
          </div>
        </div>
    </aside>
  );
}
