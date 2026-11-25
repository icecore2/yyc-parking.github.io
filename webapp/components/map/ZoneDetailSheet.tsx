'use client';

import React, { useState, useEffect } from 'react';
import { OfficialRatePoint, ParkingZone, UserPriceReport } from '@/lib/parking/types';
import { PROVIDERS } from '@/lib/parking/providers';
import { resolveRateAt, summarizeSchedule } from '@/lib/parking/rate-schedule';
import { getCalgaryTime } from '@/lib/parking/calgary-clock';
import RateCurveChart from './RateCurveChart';
import PriceHistoryChart from './PriceHistoryChart';
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
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  createPriceReport,
  deleteUserPriceReport,
  dismissPriceReportExamples,
  getUserFavorites,
  getUserPriceReports,
  saveUserFavorite,
  saveUserPriceReport,
  updateUserPriceReport,
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

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a yyyy-mm-dd input as local noon; today's date maps to "now". */
function fromDateInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  if (value === toDateInputValue(Date.now())) return Date.now();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isFinite(d.getTime()) ? d.getTime() : null;
}

function formatReportDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ZoneDetailSheet({
  zone,
  onClose,
  onTriggerProGate,
  onOpenAlarm,
  onZoomToZone,
}: ZoneDetailSheetProps) {
  const { user, profile, isPro } = useAuth();
  const uid = user?.uid || profile?.uid || 'demo_user';
  const canonicalZoneKey = zone.zoneNumber || zone.id;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  // Per-user posted prices (private) and the official server-side history are kept apart:
  // posting a price only writes under users/{uid}/price_reports.
  const [priceReports, setPriceReports] = useState<UserPriceReport[]>([]);
  const [officialHistory, setOfficialHistory] = useState<OfficialRatePoint[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postRate, setPostRate] = useState('');
  const [postNote, setPostNote] = useState('');
  const [postDate, setPostDate] = useState('');
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editRate, setEditRate] = useState('');

  const provider = PROVIDERS[zone.provider] || PROVIDERS.parkplus_on_street;
  const [now, setNow] = useState(() => getCalgaryTime());
  useEffect(() => {
    const id = setInterval(() => setNow(getCalgaryTime()), 60_000);
    return () => clearInterval(id);
  }, []);
  const live = resolveRateAt(zone.rateSchedule, now);
  const { peakRate } = summarizeSchedule(zone.rateSchedule);
  // No published schedule (loading/taxi/no-parking zones): we can't say it's free.
  const hasSchedule = (zone.rateSchedule?.length ?? 0) > 0;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${zone.coordinates[1]},${zone.coordinates[0]}`;

  useEffect(() => {
    let cancelled = false;
    getUserFavorites(uid).then((favs) => {
      if (cancelled) return;
      setIsSaved(
        favs.some(
          (f) =>
            f.zoneId === zone.id ||
            f.id === zone.id ||
            f.zoneId === canonicalZoneKey ||
            f.id === canonicalZoneKey
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [uid, zone.id, canonicalZoneKey]);

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
        id: canonicalZoneKey,
        zoneId: canonicalZoneKey,
        label: zone.title,
        address: zone.address,
        hourlyRate: zone.peakRate ?? zone.activeRate,
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

  const reloadPriceReports = React.useCallback(async () => {
    const reports = await getUserPriceReports(uid, canonicalZoneKey, zone.activeRate);
    setPriceReports(reports);
  }, [uid, canonicalZoneKey, zone.activeRate]);

  // Load history data lazily, the first time the History tab is opened for this zone.
  useEffect(() => {
    if (activeTab !== 'history') return;
    let cancelled = false;
    getUserPriceReports(uid, canonicalZoneKey, zone.activeRate).then((reports) => {
      if (!cancelled) setPriceReports(reports);
    });
    fetch(`/api/parking/history?zoneId=${encodeURIComponent(zone.id)}`)
      .then((res) => (res.ok ? res.json() : { points: [] }))
      .then((json: { points?: OfficialRatePoint[] }) => {
        if (!cancelled) setOfficialHistory(Array.isArray(json.points) ? json.points : []);
      })
      .catch(() => {
        if (!cancelled) setOfficialHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, uid, canonicalZoneKey, zone.id, zone.activeRate]);

  const openPostForm = () => {
    setPostRate(zone.activeRate.toFixed(2));
    setPostNote('');
    setPostDate(toDateInputValue(Date.now()));
    setShowPostForm(true);
  };

  const handlePostPrice = async () => {
    const rate = parseFloat(postRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return;
    const observedAt = fromDateInputValue(postDate) ?? Date.now();
    const report = createPriceReport(canonicalZoneKey, { rate, note: postNote, observedAt });
    await saveUserPriceReport(uid, report);
    setShowPostForm(false);
    await reloadPriceReports();
  };

  const handleClearExampleReports = async () => {
    dismissPriceReportExamples(uid, canonicalZoneKey);
    await reloadPriceReports();
  };

  const startEditReport = (report: UserPriceReport) => {
    setEditingReportId(report.id);
    setEditNote(report.note || '');
    setEditRate(report.rate.toFixed(2));
  };

  const handleSaveReportEdit = async (orig: UserPriceReport) => {
    const rate = parseFloat(editRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return;

    if (orig.isExample) {
      // Editing an example turns it into a real report and retires the examples.
      const created = createPriceReport(canonicalZoneKey, {
        rate,
        note: editNote,
        observedAt: orig.observedAt,
      });
      await saveUserPriceReport(uid, created);
      dismissPriceReportExamples(uid, canonicalZoneKey);
    } else {
      await updateUserPriceReport(uid, orig, { rate, note: editNote });
    }
    setEditingReportId(null);
    await reloadPriceReports();
  };

  const handleDeleteReport = async (report: UserPriceReport) => {
    if (report.isExample) {
      dismissPriceReportExamples(uid, canonicalZoneKey);
    } else {
      await deleteUserPriceReport(uid, report.id);
    }
    await reloadPriceReports();
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
                      variant={!hasSchedule ? 'secondary' : live.isFree ? 'success' : 'default'}
                      className="text-xs font-bold"
                    >
                      {!hasSchedule ? 'See posted signs' : live.isFree ? 'FREE NOW' : live.statusText}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {peakRate === 0 ? 'No paid periods posted' : `Peak $${peakRate.toFixed(2)}/hr`}
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
                  {zone.enforceableHours && (
                    <div className="text-xs font-semibold text-foreground">{zone.enforceableHours}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    Max stay duration:{' '}
                    <strong className="text-foreground">
                      {zone.maxStayHours ? `${zone.maxStayHours} Hours` : 'Not posted'}
                    </strong>
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
              <RateCurveChart schedule={zone.rateSchedule} initialDay={now.day} />

              {/* Schedule Windows Table */}
              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Schedule Breakdown
                  </span>
                  <div className="space-y-1.5 divide-y divide-border text-xs">
                    {zone.rateSchedule && zone.rateSchedule.length > 0 ? (
                      zone.rateSchedule.map((period, i) => {
                        const isLive = period === live.period;
                        const isFreePeriod = period.isFree || period.ratePerHour === 0;
                        return (
                          <div
                            key={i}
                            aria-current={isLive ? 'true' : undefined}
                            className={`pt-1.5 first:pt-0 flex items-center justify-between ${
                              isLive ? 'rounded-md bg-primary/10 px-1.5 -mx-1.5 font-semibold' : ''
                            }`}
                          >
                            <span className={isLive ? 'text-foreground' : 'text-muted-foreground'}>
                              {`${period.days} ${period.startTime}–${period.endTime}`}
                            </span>
                            <span className="font-bold text-foreground">
                              {isFreePeriod ? 'FREE' : `$${period.ratePerHour.toFixed(2)}/hr`}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-muted-foreground">No published rate schedule for this zone.</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Free Parking Times */}
              {zone.provider === 'parkplus_on_street' && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    <strong>Tip:</strong> All Calgary on-street ParkPlus zones offer free parking on Sundays and statutory holidays!
                  </span>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: HISTORY */}
            <TabsContent value="history" className="mt-0 flex flex-col gap-3">
              <PriceHistoryChart
                official={officialHistory}
                currentRate={zone.activeRate}
                mine={priceReports}
              />
              {!historyLoaded && (
                <p className="text-[10px] text-muted-foreground -mt-1">Loading official history…</p>
              )}

              <Card>
                <CardContent className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      My Posted Prices
                    </span>
                    <div className="flex items-center gap-1">
                      {priceReports.some((r) => r.isExample) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearExampleReports}
                          className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                        >
                          Clear Examples
                        </Button>
                      )}
                      {!showPostForm && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={openPostForm}
                          className="h-7 text-[11px] gap-1 text-primary"
                        >
                          <Plus className="w-3 h-3" />
                          Post a price
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Log what you actually paid here. Only you can see these, and they never change the official rate.
                  </p>

                  {showPostForm && (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-border p-2" data-testid="post-price-form">
                      <div className="flex gap-1.5">
                        <Input
                          type="number"
                          step="0.25"
                          min="0"
                          max="1000"
                          value={postRate}
                          onChange={(e) => setPostRate(e.target.value)}
                          className="h-7 text-xs w-20"
                          aria-label="Price per hour"
                        />
                        <Input
                          type="text"
                          maxLength={200}
                          value={postNote}
                          onChange={(e) => setPostNote(e.target.value)}
                          className="h-7 text-xs flex-1"
                          placeholder="Note (e.g. Flames game)"
                          aria-label="Note"
                        />
                        <Input
                          type="date"
                          value={postDate}
                          onChange={(e) => setPostDate(e.target.value)}
                          className="h-7 text-xs w-32"
                          aria-label="Date"
                        />
                      </div>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPostForm(false)}
                          className="h-6 text-[11px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="emerald"
                          size="sm"
                          onClick={handlePostPrice}
                          className="h-6 text-[11px]"
                        >
                          Post
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 divide-y divide-border text-xs mt-1">
                    {priceReports.length === 0 ? (
                      <div className="py-3 text-center text-[11px] text-muted-foreground">
                        You haven&apos;t posted a price for this zone yet.
                      </div>
                    ) : (
                      [...priceReports].reverse().map((item) => (
                        <div key={item.id} className="pt-2 first:pt-0">
                          {editingReportId === item.id ? (
                            <div className="flex flex-col gap-1.5 py-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="text"
                                  maxLength={200}
                                  value={editNote}
                                  onChange={(e) => setEditNote(e.target.value)}
                                  className="h-7 text-xs flex-1"
                                  placeholder="Note"
                                />
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  value={editRate}
                                  onChange={(e) => setEditRate(e.target.value)}
                                  className="h-7 text-xs w-20"
                                />
                              </div>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingReportId(null)}
                                  className="h-6 text-[11px]"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  variant="emerald"
                                  size="sm"
                                  onClick={() => handleSaveReportEdit(item)}
                                  className="h-6 text-[11px]"
                                >
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-muted-foreground truncate">
                                  {formatReportDate(item.observedAt)}
                                  {item.note ? ` · ${item.note}` : ''}
                                </span>
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
                                  onClick={() => startEditReport(item)}
                                  title="Edit price"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="iconSm"
                                  onClick={() => handleDeleteReport(item)}
                                  title="Delete price"
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
