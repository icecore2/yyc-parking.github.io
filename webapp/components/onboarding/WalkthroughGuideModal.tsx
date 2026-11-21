'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  Compass,
  Crosshair,
  Heart,
  MapPin,
  Minimize2,
  Navigation,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  dismissExamplesForUser,
  saveParkingSession,
  saveUserFavorite,
  saveUserLocation,
  saveUserVehicle,
} from '@/lib/firebase/firestore';
import {
  EXAMPLE_IDS_BY_SECTION,
  getRealItems,
  isPlaceholderDisplayName,
} from '@/lib/parking/example-data';
import { SAMPLE_CALGARY_ZONES } from '@/lib/parking/data-service';
import { WalkthroughStepId } from '@/lib/parking/types';
import { useWalkthrough } from './WalkthroughProvider';
import { ExampleBadge } from './ExampleDataBanner';
import AuthModal from '@/components/auth/AuthModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STEP_CONFIG: {
  id: WalkthroughStepId;
  title: string;
  shortTitle: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'profile',
    title: 'Personalize Your Profile',
    shortTitle: 'Profile',
    subtitle: 'Replace the placeholder driver name with your real name.',
    icon: User,
  },
  {
    id: 'vehicles',
    title: 'Add Your Real Vehicle',
    shortTitle: 'Vehicle',
    subtitle: 'Replace the example Subaru Outback plate (BXY-8492) with your own vehicle.',
    icon: Car,
  },
  {
    id: 'locations',
    title: 'Set Your Commute Destination',
    shortTitle: 'Destination',
    subtitle: 'Add your office, home, or school so the map ranks nearby spots for you.',
    icon: MapPin,
  },
  {
    id: 'favorites',
    title: 'Save a Favorite Parking Spot',
    shortTitle: 'Favorites',
    subtitle: 'Bookmark a Calgary parking zone you use regularly.',
    icon: Heart,
  },
  {
    id: 'expenses',
    title: 'Set Up Your Expense Log',
    shortTitle: 'Expenses',
    subtitle: 'Log a real parking receipt or clear the 3 example transactions to start at $0.00.',
    icon: Receipt,
  },
];

export default function WalkthroughGuideModal() {
  const router = useRouter();
  const { user, profile, updateUserDisplayName } = useAuth();
  const {
    isOpen,
    isMinimized,
    activeStep,
    setActiveStep,
    openWalkthrough,
    minimizeWalkthrough,
    dismissWalkthrough,
    completeWalkthrough,
    markStepCompleted,
    clearAllExamples,
    refreshData,
    vehicles,
    locations,
    favorites,
    sessions,
    progress,
  } = useWalkthrough();

  const uid = user?.uid || profile?.uid || 'demo_user';
  const currentDisplayName = profile?.displayName ?? user?.displayName ?? '';
  const stepIndex = Math.max(
    0,
    STEP_CONFIG.findIndex((s) => s.id === activeStep)
  );
  const currentConfig = STEP_CONFIG[stepIndex];

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1 state
  const [nameInput, setNameInput] = useState(() =>
    isPlaceholderDisplayName(currentDisplayName) ? '' : currentDisplayName
  );

  // Step 2 state
  const [plateInput, setPlateInput] = useState('');
  const [vehicleDescInput, setVehicleDescInput] = useState('');

  // Step 3 state
  const [locNameInput, setLocNameInput] = useState('');
  const [locAddressInput, setLocAddressInput] = useState('');
  const [resolvedCoords, setResolvedCoords] = useState<[number, number] | null>(null);

  // Step 4 state
  const [favZoneInput, setFavZoneInput] = useState('1008');
  const [favLabelInput, setFavLabelInput] = useState('');
  const [favNotesInput, setFavNotesInput] = useState('');

  // Step 5 state
  const [expDateInput, setExpDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [expZoneInput, setExpZoneInput] = useState('');
  const [expAddressInput, setExpAddressInput] = useState('');
  const [expHoursInput, setExpHoursInput] = useState('2');
  const [expRateInput, setExpRateInput] = useState('3.50');
  const [expNotesInput, setExpNotesInput] = useState('');

  if (!isOpen) {
    return showAuthModal ? (
      <AuthModal defaultMode="signup" onClose={() => setShowAuthModal(false)} />
    ) : null;
  }

  if (isMinimized) {
    const stepStatus = progress.steps[activeStep];
    return (
      <>
        <div
          id="walkthrough-floating-pill"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-primary/40 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur-md text-xs max-w-sm"
        >
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-foreground truncate flex items-center gap-1.5">
              <span>Setup Guide ({progress.completedCount}/5)</span>
              {stepStatus?.completed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Step {stepIndex + 1}: {currentConfig.title}
            </p>
          </div>
          <Button
            type="button"
            variant="emerald"
            size="sm"
            onClick={() => openWalkthrough(activeStep)}
            className="h-8 text-[11px] px-3 shrink-0"
          >
            Resume
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={() => void dismissWalkthrough()}
            title="Dismiss Setup Guide"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
        {showAuthModal && (
          <AuthModal defaultMode="signup" onClose={() => setShowAuthModal(false)} />
        )}
      </>
    );
  }

  const realVehicles = getRealItems(vehicles);
  const realLocations = getRealItems(locations);
  const realFavorites = getRealItems(favorites);
  const realSessions = getRealItems(sessions);

  const goToStep = (step: WalkthroughStepId) => {
    setStatusMsg(null);
    setActiveStep(step);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setStatusMsg({ text: 'Please enter your name or preferred display name.', isError: true });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      await updateUserDisplayName(trimmed);
      await markStepCompleted('profile');
      setStatusMsg({ text: `Profile updated to "${trimmed}"!` });
    } catch (err: unknown) {
      setStatusMsg({
        text: err instanceof Error ? err.message : 'Could not update display name.',
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateInput.trim()) {
      setStatusMsg({ text: 'Please enter your license plate number.', isError: true });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const now = Date.now();
      await saveUserVehicle(uid, {
        id: `veh_${now}`,
        plate: plateInput.toUpperCase().trim(),
        description: vehicleDescInput.trim() || 'My Vehicle',
        isPrimary: true,
        createdAt: now,
      });
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.vehicles]);
      await markStepCompleted('vehicles');
      await refreshData();
      setPlateInput('');
      setVehicleDescInput('');
      setStatusMsg({ text: 'Real vehicle saved and example vehicle replaced!' });
    } finally {
      setBusy(false);
    }
  };

  const handleClearSectionExamples = async (ids: readonly string[], label: string) => {
    setBusy(true);
    setStatusMsg(null);
    try {
      await dismissExamplesForUser(uid, [...ids]);
      await refreshData();
      setStatusMsg({ text: `Cleared example ${label}.` });
    } finally {
      setBusy(false);
    }
  };

  const handleGeocodeLocation = async () => {
    if (!locAddressInput.trim()) {
      setStatusMsg({ text: 'Enter a Calgary street address first.', isError: true });
      return;
    }
    const coordMatch = locAddressInput.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const v1 = parseFloat(coordMatch[1]);
      const v2 = parseFloat(coordMatch[3]);
      const lat = v1 > 40 && v1 < 60 ? v1 : v2;
      const lng = v1 < -100 && v1 > -130 ? v1 : v2;
      setResolvedCoords([lng, lat]);
      setStatusMsg({ text: `Coordinates detected (${lat.toFixed(4)}, ${lng.toFixed(4)}).` });
      return;
    }
    setBusy(true);
    setStatusMsg({ text: 'Looking up address in Calgary...' });
    try {
      const query = encodeURIComponent(`${locAddressInput.trim()}, Calgary, AB, Canada`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setResolvedCoords([lon, lat]);
        setStatusMsg({
          text: `Found: ${data[0].display_name.split(',')[0]} (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        });
      } else {
        setResolvedCoords(null);
        setStatusMsg({
          text: 'Address not found. You can still save or pick the exact point on the map.',
          isError: true,
        });
      }
    } catch {
      setStatusMsg({ text: 'Geocoding failed. Check your connection or pick on the map.', isError: true });
    } finally {
      setBusy(false);
    }
  };

  const handleGpsLocation = () => {
    if (!navigator.geolocation) {
      setStatusMsg({ text: 'Geolocation is not supported in this browser.', isError: true });
      return;
    }
    setStatusMsg({ text: 'Getting current GPS coordinates...' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setResolvedCoords([lng, lat]);
        setLocAddressInput(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        if (!locNameInput.trim()) setLocNameInput('My Current Location');
        setStatusMsg({ text: `GPS locked (${lat.toFixed(4)}, ${lng.toFixed(4)}).` });
      },
      (err) => {
        setStatusMsg({ text: `GPS error: ${err.message}`, isError: true });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locNameInput.trim()) {
      setStatusMsg({ text: 'Please enter a name for your destination.', isError: true });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const coords: [number, number] = resolvedCoords || [-114.0719, 51.0447];
      const now = Date.now();
      await saveUserLocation(uid, {
        id: `loc_${now}`,
        name: locNameInput.trim(),
        address: locAddressInput.trim() || 'Calgary, AB',
        coordinates: coords,
        createdAt: now,
      });
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.locations]);
      await markStepCompleted('locations');
      await refreshData();
      setLocNameInput('');
      setLocAddressInput('');
      setResolvedCoords(null);
      setStatusMsg({ text: 'Destination saved and example landmarks cleared!' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFavorite = async (e: React.FormEvent) => {
    e.preventDefault();
    const zoneNum = favZoneInput.trim();
    if (!zoneNum) {
      setStatusMsg({ text: 'Enter a Calgary Parking Zone # or choose one on the map.', isError: true });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const matchedZone = SAMPLE_CALGARY_ZONES.find(
        (z) =>
          z.id.toLowerCase() === zoneNum.toLowerCase() ||
          z.zoneNumber?.toLowerCase() === zoneNum.toLowerCase()
      );
      const now = Date.now();
      await saveUserFavorite(uid, {
        id: matchedZone ? matchedZone.id : `fav_${now}`,
        zoneId: matchedZone ? matchedZone.id : zoneNum,
        label: favLabelInput.trim() || (matchedZone ? matchedZone.title : `Zone #${zoneNum}`),
        address: matchedZone ? matchedZone.address : `Calgary Zone #${zoneNum}`,
        hourlyRate: matchedZone ? matchedZone.activeRate : 3.5,
        coordinates: matchedZone ? matchedZone.coordinates : [-114.0719, 51.0447],
        provider: matchedZone ? matchedZone.provider : 'parkplus_on_street',
        notes: favNotesInput.trim() || undefined,
        createdAt: now,
      });
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.favorites]);
      await markStepCompleted('favorites');
      await refreshData();
      setFavLabelInput('');
      setFavNotesInput('');
      setStatusMsg({ text: 'Favorite parking spot saved!' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const zoneId = expZoneInput.trim();
    const durationHours = parseFloat(expHoursInput);
    const hourlyRate = parseFloat(expRateInput);
    if (!zoneId) {
      setStatusMsg({ text: 'Please enter a Zone # or lot name.', isError: true });
      return;
    }
    if (!Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 720) {
      setStatusMsg({ text: 'Enter a valid duration in hours (> 0).', isError: true });
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 1000) {
      setStatusMsg({ text: 'Enter a valid hourly rate ($0 or more).', isError: true });
      return;
    }
    setBusy(true);
    setStatusMsg(null);
    try {
      const parsedDate = expDateInput ? new Date(`${expDateInput}T12:00:00`).getTime() : Date.now();
      const startTime = Number.isFinite(parsedDate) && parsedDate > 0 ? parsedDate : Date.now();
      const totalCostDollars = Number((durationHours * hourlyRate).toFixed(2));
      const now = Date.now();
      await saveParkingSession(uid, {
        id: `session_${now}`,
        zoneId,
        address: expAddressInput.trim() || `Calgary Zone #${zoneId}`,
        startTime,
        durationHours,
        hourlyRate,
        totalCostDollars,
        expiryTime: startTime + Math.round(durationHours * 3600 * 1000),
        alertLeadMinutes: 15,
        active: false,
        notes: expNotesInput.trim() || undefined,
        createdAt: now,
      });
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.sessions]);
      await markStepCompleted('expenses');
      await refreshData();
      setExpZoneInput('');
      setExpAddressInput('');
      setExpNotesInput('');
      setStatusMsg({ text: 'Real parking transaction logged and example entries cleared!' });
    } finally {
      setBusy(false);
    }
  };

  const handleNavigateAndMinimize = (href: string, step: WalkthroughStepId) => {
    minimizeWalkthrough(step);
    router.push(href);
  };

  return (
    <>
      <Dialog
        open={isOpen && !isMinimized}
        onOpenChange={(open) => {
          if (!open) minimizeWalkthrough(activeStep);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border bg-muted/20">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-8">
                <Badge variant="success" className="gap-1.5 text-[11px] font-bold">
                  <Sparkles className="w-3 h-3" />
                  New User Setup Walkthrough
                </Badge>
                <span className="text-xs font-semibold text-muted-foreground">
                  {progress.completedCount} / {progress.totalCount} steps complete
                </span>
              </div>
              <DialogTitle className="text-xl font-bold mt-2">
                {currentConfig.title}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {currentConfig.subtitle}
              </DialogDescription>
            </DialogHeader>

            {/* Progress Bar & Stepper */}
            <div className="mt-4 space-y-2.5">
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(progress.completedCount / progress.totalCount) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {STEP_CONFIG.map((s, idx) => {
                  const Icon = s.icon;
                  const done = progress.steps[s.id]?.completed;
                  const isCurrent = s.id === activeStep;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goToStep(s.id)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary/10 text-primary shadow-xs'
                          : done
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="hidden sm:inline truncate">
                        {idx + 1}. {s.shortTitle}
                      </span>
                      <span className="sm:hidden">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Step Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
            {statusMsg && (
              <div
                className={`rounded-xl border p-3 text-xs font-medium ${
                  statusMsg.isError
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {statusMsg.text}
              </div>
            )}

            {/* STEP 1: PROFILE */}
            {activeStep === 'profile' && (
              <div className="space-y-4">
                {!user && !profile && (
                  <Card className="border-amber-500/40 bg-amber-500/10">
                    <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          Create or sign in to sync across devices
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          You are currently in local browser preview mode. Sign up free to sync your vehicles, spots, and expenses in the cloud.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="emerald"
                        size="sm"
                        onClick={() => setShowAuthModal(true)}
                        className="shrink-0"
                      >
                        Create Account / Sign In
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Current Display Name</span>
                      {isPlaceholderDisplayName(currentDisplayName) ? (
                        <Badge variant="warning" className="text-[10px]">
                          Placeholder — Needs Setup
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px]">
                          Personalized: {currentDisplayName}
                        </Badge>
                      )}
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="walkthrough-name">Your Real Name</Label>
                        <Input
                          id="walkthrough-name"
                          type="text"
                          placeholder="e.g. Jordan Lee"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                        />
                      </div>
                      <Button type="submit" variant="emerald" size="sm" disabled={busy}>
                        {busy ? 'Saving...' : 'Save Real Name'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 2: VEHICLES */}
            {activeStep === 'vehicles' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Current Vehicles ({vehicles.length})
                      </span>
                      {vehicles.some((v) => v.isExample) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void handleClearSectionExamples(
                              EXAMPLE_IDS_BY_SECTION.vehicles,
                              'vehicle'
                            )
                          }
                          className="h-7 text-[11px] gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear Example
                        </Button>
                      )}
                    </div>

                    {vehicles.length === 0 ? (
                      <p className="text-muted-foreground text-[11px]">
                        Example cleared. Add your real vehicle below!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {vehicles.map((v) => (
                          <div
                            key={v.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${
                              v.isExample
                                ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                                : 'border-border bg-background'
                            }`}
                          >
                            <div>
                              <span className="font-mono font-bold tracking-widest text-foreground">
                                {v.plate}
                              </span>
                              <span className="text-muted-foreground ml-2">{v.description}</span>
                            </div>
                            {v.isExample ? (
                              <ExampleBadge />
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                Saved
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleSaveVehicle} className="space-y-3">
                      <div className="font-semibold text-foreground">
                        Add Your Real Vehicle {realVehicles.length === 0 && '(Replaces Example)'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="wt-plate">License Plate</Label>
                          <Input
                            id="wt-plate"
                            type="text"
                            placeholder="e.g. ABC-1234"
                            value={plateInput}
                            onChange={(e) => setPlateInput(e.target.value)}
                            className="font-mono uppercase"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-vdesc">Vehicle Make / Color</Label>
                          <Input
                            id="wt-vdesc"
                            type="text"
                            placeholder="e.g. Honda Civic (Blue)"
                            value={vehicleDescInput}
                            onChange={(e) => setVehicleDescInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <Button type="submit" variant="emerald" size="sm" disabled={busy}>
                        {busy ? 'Saving...' : 'Save Vehicle & Replace Example'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 3: DESTINATIONS */}
            {activeStep === 'locations' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        Saved Destinations ({locations.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        {locations.some((l) => l.isExample) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void handleClearSectionExamples(
                                EXAMPLE_IDS_BY_SECTION.locations,
                                'destinations'
                              )
                            }
                            className="h-7 text-[11px] gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear Examples
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateAndMinimize('/app', 'locations')}
                          className="h-7 text-[11px] gap-1"
                        >
                          <Crosshair className="w-3 h-3 text-primary" />
                          Pick Point on Map →
                        </Button>
                      </div>
                    </div>

                    {locations.length === 0 ? (
                      <p className="text-muted-foreground text-[11px]">
                        Example landmarks cleared. Add your workplace, home, or school below.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {locations.map((loc) => (
                          <div
                            key={loc.id}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                              loc.isExample
                                ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                                : 'border-border bg-background'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {loc.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {loc.address}
                              </span>
                            </div>
                            {loc.isExample ? (
                              <ExampleBadge label="Example" />
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                Saved
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleSaveLocation} className="space-y-3">
                      <div className="font-semibold text-foreground">
                        Add Your Real Destination {realLocations.length === 0 && '(Replaces Examples)'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="wt-loc-name">Label</Label>
                          <Input
                            id="wt-loc-name"
                            type="text"
                            placeholder="e.g. My Office, Gym, Home"
                            value={locNameInput}
                            onChange={(e) => setLocNameInput(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-loc-addr">Calgary Address or Lat, Lng</Label>
                          <div className="flex gap-1.5">
                            <Input
                              id="wt-loc-addr"
                              type="text"
                              placeholder="e.g. 225 6 Ave SW"
                              value={locAddressInput}
                              onChange={(e) => {
                                setLocAddressInput(e.target.value);
                                setResolvedCoords(null);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleGeocodeLocation()}
                              disabled={busy}
                              title="Find coordinates"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGpsLocation}
                          className="gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5 text-primary" />
                          Use My GPS
                        </Button>
                        <Button type="submit" variant="emerald" size="sm" disabled={busy}>
                          {busy ? 'Saving...' : 'Save Destination & Replace Examples'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 4: FAVORITES */}
            {activeStep === 'favorites' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        Favorite Parking Spots ({favorites.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        {favorites.some((f) => f.isExample) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void handleClearSectionExamples(
                                EXAMPLE_IDS_BY_SECTION.favorites,
                                'favorite spot'
                              )
                            }
                            className="h-7 text-[11px] gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear Example
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateAndMinimize('/app', 'favorites')}
                          className="h-7 text-[11px] gap-1"
                        >
                          Open Interactive Map →
                        </Button>
                      </div>
                    </div>

                    {favorites.length === 0 ? (
                      <p className="text-muted-foreground text-[11px]">
                        Example spot cleared. Enter a Zone # below or click &quot;Open Interactive Map&quot; to bookmark any stall.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {favorites.map((fav) => (
                          <div
                            key={fav.id}
                            className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                              fav.isExample
                                ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                                : 'border-border bg-background'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground block truncate">
                                {fav.label} (Zone #{fav.zoneId})
                              </span>
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {fav.address}
                              </span>
                            </div>
                            {fav.isExample ? (
                              <ExampleBadge label="Example" />
                            ) : (
                              <Badge variant="success" className="text-[10px]">
                                Saved
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-muted/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleSaveFavorite} className="space-y-3">
                      <div className="font-semibold text-foreground">
                        Quick-Save a Favorite Zone {realFavorites.length === 0 && '(Replaces Example)'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="wt-fav-zone">Calgary Zone #</Label>
                          <Input
                            id="wt-fav-zone"
                            type="text"
                            placeholder="e.g. 1008 or 1042"
                            value={favZoneInput}
                            onChange={(e) => setFavZoneInput(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-fav-label">Custom Label</Label>
                          <Input
                            id="wt-fav-label"
                            type="text"
                            placeholder="e.g. Downtown Office"
                            value={favLabelInput}
                            onChange={(e) => setFavLabelInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="wt-fav-notes">Optional Notes</Label>
                        <Input
                          id="wt-fav-notes"
                          type="text"
                          placeholder="e.g. Near north entrance, free after 6pm"
                          value={favNotesInput}
                          onChange={(e) => setFavNotesInput(e.target.value)}
                        />
                      </div>
                      <Button type="submit" variant="emerald" size="sm" disabled={busy}>
                        {busy ? 'Saving...' : 'Save Favorite Spot'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* STEP 5: EXPENSES */}
            {activeStep === 'expenses' && (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        Transaction Log ({realSessions.length} real, {sessions.filter((s) => s.isExample).length} example)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {sessions.some((s) => s.isExample) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void handleClearSectionExamples(
                                EXAMPLE_IDS_BY_SECTION.sessions,
                                'transactions'
                              )
                            }
                            className="h-7 text-[11px] gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear Examples ($0.00)
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigateAndMinimize('/expenses', 'expenses')}
                          className="h-7 text-[11px]"
                        >
                          Open Expense Tracker →
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Example entries are excluded from CRA tax CSV exports by default. Log your first real receipt below or clear the examples to start cleanly.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-muted/20">
                  <CardContent className="p-4">
                    <form onSubmit={handleSaveExpense} className="space-y-3">
                      <div className="font-semibold text-foreground">Log a Real Parking Transaction</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="wt-exp-date">Date</Label>
                          <Input
                            id="wt-exp-date"
                            type="date"
                            value={expDateInput}
                            onChange={(e) => setExpDateInput(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-exp-zone">Zone # / Lot</Label>
                          <Input
                            id="wt-exp-zone"
                            type="text"
                            placeholder="e.g. 1008"
                            value={expZoneInput}
                            onChange={(e) => setExpZoneInput(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-exp-hours">Duration (hrs)</Label>
                          <Input
                            id="wt-exp-hours"
                            type="number"
                            step="0.25"
                            min="0.25"
                            value={expHoursInput}
                            onChange={(e) => setExpHoursInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <Label htmlFor="wt-exp-addr">Street / Address</Label>
                          <Input
                            id="wt-exp-addr"
                            type="text"
                            placeholder="e.g. 5 Ave SW & 3 St SW"
                            value={expAddressInput}
                            onChange={(e) => setExpAddressInput(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="wt-exp-rate">Rate ($/hr)</Label>
                          <Input
                            id="wt-exp-rate"
                            type="number"
                            step="0.25"
                            min="0"
                            value={expRateInput}
                            onChange={(e) => setExpRateInput(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="wt-exp-notes">Business / Trip Notes</Label>
                        <Input
                          id="wt-exp-notes"
                          type="text"
                          placeholder="e.g. Client site visit"
                          value={expNotesInput}
                          onChange={(e) => setExpNotesInput(e.target.value)}
                        />
                      </div>
                      <Button type="submit" variant="emerald" size="sm" disabled={busy}>
                        {busy ? 'Saving...' : 'Log Transaction & Clear Examples'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-4 px-6 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => minimizeWalkthrough(activeStep)}
                className="text-xs gap-1"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Minimize
              </Button>
              {progress.remainingExampleCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void clearAllExamples()}
                  className="text-xs gap-1 border-amber-500/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear All Examples ({progress.remainingExampleCount})
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void dismissWalkthrough()}
                className="text-xs text-muted-foreground"
              >
                Skip for Now
              </Button>
              {stepIndex > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => goToStep(STEP_CONFIG[stepIndex - 1].id)}
                  className="text-xs gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </Button>
              )}
              {stepIndex < STEP_CONFIG.length - 1 ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => goToStep(STEP_CONFIG[stepIndex + 1].id)}
                  className="text-xs gap-1"
                >
                  Next
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="emerald"
                  size="sm"
                  onClick={() => void completeWalkthrough()}
                  className="text-xs gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Finish Setup
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showAuthModal && (
        <AuthModal defaultMode="signup" onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}
