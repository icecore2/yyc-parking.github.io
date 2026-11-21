'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/auth/AuthModal';
import ExampleDataBanner, { ExampleBadge } from '@/components/onboarding/ExampleDataBanner';
import { useWalkthrough } from '@/components/onboarding/WalkthroughProvider';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  deleteUserFavorite,
  deleteUserLocation,
  deleteUserVehicle,
  dismissExamplesForUser,
  restoreExamplesForUser,
  saveOrReplaceFavorite,
  saveOrReplaceLocation,
  saveOrReplaceVehicle,
  setPrimaryUserVehicle,
} from '@/lib/firebase/firestore';
import {
  EXAMPLE_IDS_BY_SECTION,
  getRealItems,
  isPlaceholderDisplayName,
} from '@/lib/parking/example-data';
import {
  CustomLocation,
  UserFavoriteSpot,
  UserVehicle,
  WalkthroughStepId,
} from '@/lib/parking/types';
import {
  Car,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Heart,
  MapPin,
  Pencil,
  Receipt,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STEP_LABELS: { id: WalkthroughStepId; label: string }[] = [
  { id: 'profile', label: '1. Profile Name' },
  { id: 'vehicles', label: '2. Real Vehicle' },
  { id: 'locations', label: '3. Destination' },
  { id: 'favorites', label: '4. Favorite Spot' },
  { id: 'expenses', label: '5. Expense Log' },
];

export default function AccountPage() {
  const { user, profile, isPro, isAdmin, toggleDemoTier, updateUserDisplayName } = useAuth();
  const {
    vehicles,
    locations,
    favorites,
    sessions,
    progress,
    onboardingState,
    openWalkthrough,
    clearAllExamples,
    refreshData,
  } = useWalkthrough();

  const uid = user?.uid || profile?.uid || 'demo_user';
  const currentDisplayName = profile?.displayName || user?.displayName || 'Calgary Commuter';
  const nameNeedsSetup = isPlaceholderDisplayName(profile?.displayName ?? user?.displayName ?? null);

  const [showAuthModal, setShowAuthModal] = useState(false);

  // Profile name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Vehicle add & edit state
  const [newPlate, setNewPlate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [replaceExampleVehicle, setReplaceExampleVehicle] = useState(true);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleDesc, setEditVehicleDesc] = useState('');

  // Favorite edit state
  const [editingFavId, setEditingFavId] = useState<string | null>(null);
  const [editFavLabel, setEditFavLabel] = useState('');
  const [editFavNotes, setEditFavNotes] = useState('');

  // Location edit state
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');

  const exampleVehicleCount = vehicles.filter((v) => v.isExample).length;
  const exampleFavoriteCount = favorites.filter((f) => f.isExample).length;
  const exampleLocationCount = locations.filter((l) => l.isExample).length;
  const realSessionCount = getRealItems(sessions).length;
  const exampleSessionCount = sessions.filter((s) => s.isExample).length;

  // Profile name handlers
  const startEditingName = () => {
    setNameDraft(nameNeedsSetup ? '' : currentDisplayName);
    setNameError(null);
    setIsEditingName(true);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameDraft.trim()) {
      setNameError('Please enter your name.');
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      await updateUserDisplayName(nameDraft.trim());
      setIsEditingName(false);
    } catch (err: unknown) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  };

  // Vehicle handlers
  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    await saveOrReplaceVehicle(uid, null, {
      plate: newPlate,
      description: newDesc,
      isPrimary: getRealItems(vehicles).length === 0,
    });
    if (replaceExampleVehicle && exampleVehicleCount > 0) {
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.vehicles]);
    }
    setNewPlate('');
    setNewDesc('');
    await refreshData();
  };

  const startEditVehicle = (v: UserVehicle) => {
    setEditingVehicleId(v.id);
    setEditVehiclePlate(v.plate);
    setEditVehicleDesc(v.description);
  };

  const handleSaveVehicleEdit = async (orig: UserVehicle) => {
    if (!editVehiclePlate.trim()) return;
    await saveOrReplaceVehicle(uid, orig, {
      plate: editVehiclePlate,
      description: editVehicleDesc,
      isPrimary: orig.isExample ? true : orig.isPrimary,
    });
    setEditingVehicleId(null);
    await refreshData();
  };

  const handleDeleteVehicle = async (v: UserVehicle) => {
    if (v.isExample) {
      await dismissExamplesForUser(uid, [v.id]);
    } else {
      await deleteUserVehicle(uid, v.id);
    }
    await refreshData();
  };

  // Favorite handlers
  const startEditFavorite = (f: UserFavoriteSpot) => {
    setEditingFavId(f.id);
    setEditFavLabel(f.isExample ? f.label.replace(/\s*\(Example\)\s*$/i, '') : f.label);
    setEditFavNotes(f.isExample ? '' : f.notes || '');
  };

  const handleSaveFavoriteEdit = async (orig: UserFavoriteSpot) => {
    if (!editFavLabel.trim()) return;
    await saveOrReplaceFavorite(uid, orig, {
      label: editFavLabel,
      notes: editFavNotes,
    });
    setEditingFavId(null);
    await refreshData();
  };

  const handleDeleteFavorite = async (f: UserFavoriteSpot) => {
    if (f.isExample) {
      await dismissExamplesForUser(uid, [f.id]);
    } else {
      await deleteUserFavorite(uid, f.id);
    }
    await refreshData();
  };

  // Location handlers
  const startEditLocation = (loc: CustomLocation) => {
    setEditingLocId(loc.id);
    setEditLocName(loc.name);
    setEditLocAddress(loc.address);
  };

  const handleSaveLocationEdit = async (orig: CustomLocation) => {
    if (!editLocName.trim()) return;
    await saveOrReplaceLocation(uid, orig, {
      name: editLocName,
      address: editLocAddress,
      coordinates: orig.coordinates,
    });
    setEditingLocId(null);
    await refreshData();
  };

  const handleDeleteLocation = async (loc: CustomLocation) => {
    if (loc.isExample) {
      await dismissExamplesForUser(uid, [loc.id]);
    } else {
      await deleteUserLocation(uid, loc.id);
    }
    await refreshData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* New User Setup Checklist / Walkthrough Card */}
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-foreground">
                      Getting Started Setup Checklist
                    </h2>
                    <Badge variant={progress.allDone ? 'success' : 'secondary'} className="text-[11px]">
                      {progress.completedCount} / {progress.totalCount} Complete
                    </Badge>
                    {onboardingState.walkthroughCompleted && (
                      <Badge variant="success" className="text-[10px]">
                        Walkthrough Finished
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Replace pre-filled example data with your real vehicles, destinations, favorite zones, and parking expenses.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {progress.remainingExampleCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void clearAllExamples()}
                    className="text-xs gap-1.5 border-amber-500/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All Examples ({progress.remainingExampleCount})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="emerald"
                  size="sm"
                  onClick={() => openWalkthrough()}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {onboardingState.walkthroughCompleted ? 'Replay Setup Walkthrough' : 'Launch Setup Guide'}
                </Button>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(progress.completedCount / progress.totalCount) * 100}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STEP_LABELS.map((step) => {
                const done = progress.steps[step.id]?.completed;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => openWalkthrough(step.id)}
                    className={`px-3 py-2 rounded-xl border text-left text-xs font-medium transition-colors flex items-center gap-2 ${
                      done
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-border bg-background hover:border-primary/50 text-foreground'
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/50 shrink-0" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Profile Header Card */}
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-2xl shadow-md shrink-0">
                {currentDisplayName[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="Enter your real name"
                      className="h-8 w-56 text-sm"
                      autoFocus
                    />
                    <Button type="submit" variant="emerald" size="sm" disabled={nameSaving} className="h-8 text-xs gap-1">
                      <Check className="w-3.5 h-3.5" />
                      {nameSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingName(false)}
                      className="h-8 text-xs gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                    {nameError && <span className="text-[11px] text-destructive w-full">{nameError}</span>}
                  </form>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground truncate">
                      {currentDisplayName}
                    </h1>
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSm"
                      onClick={startEditingName}
                      title="Edit display name"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Badge variant={isPro ? 'warning' : 'secondary'} className="gap-1">
                      {isPro && <Crown className="w-3 h-3" />}
                      {isAdmin ? 'ADMIN' : isPro ? 'PRO PLAN' : 'FREE TIER'}
                    </Badge>
                    {nameNeedsSetup && (
                      <Badge variant="warning" className="text-[10px]">
                        Needs Setup
                      </Badge>
                    )}
                    {!user && !profile && (
                      <Badge variant="outline" className="text-[10px]">
                        Guest Preview
                      </Badge>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {profile?.email || user?.email || 'Local browser storage (sign in to sync across devices)'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!user && !profile && (
                <Button
                  type="button"
                  variant="emerald"
                  size="sm"
                  onClick={() => setShowAuthModal(true)}
                  className="text-xs gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Sign In / Register
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleDemoTier}
                className="text-xs font-semibold"
              >
                Toggle Demo Tier: {isPro ? 'Switch to Free' : 'Switch to Pro'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Management Box */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
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

        {/* Vehicles / License Plates (Editable Example + Real Persisted CRUD) */}
        <Card id="vehicles">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    Registered Vehicles ({vehicles.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Keep license plates handy for 1-tap entry into ParkPlus &amp; hangTag
                  </p>
                </div>
              </div>
              {vehicles.length === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void restoreExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.vehicles])}
                  className="text-xs gap-1 text-muted-foreground"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Load Example
                </Button>
              )}
            </div>

            <ExampleDataBanner
              sectionLabel="vehicle"
              exampleCount={exampleVehicleCount}
              onClearExamples={() => dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.vehicles])}
            />

            {vehicles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No vehicles added yet. Enter your license plate below to save your real vehicle.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {vehicles.map((v) => {
                  const isEditing = editingVehicleId === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 ${
                        v.isExample
                          ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                          : 'border-border bg-background'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              value={editVehiclePlate}
                              onChange={(e) => setEditVehiclePlate(e.target.value)}
                              placeholder="PLATE"
                              className="w-32 h-8 font-mono uppercase text-xs"
                            />
                            <Input
                              type="text"
                              value={editVehicleDesc}
                              onChange={(e) => setEditVehicleDesc(e.target.value)}
                              placeholder="Make, model & color"
                              className="flex-1 h-8 text-xs"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingVehicleId(null)}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="emerald"
                              size="sm"
                              onClick={() => void handleSaveVehicleEdit(v)}
                              className="h-7 text-xs"
                            >
                              {v.isExample ? 'Replace with Real' : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-sm tracking-widest text-foreground">
                                {v.plate}
                              </span>
                              {v.isPrimary && (
                                <Badge variant="success" className="text-[10px]">
                                  Primary
                                </Badge>
                              )}
                              {v.isExample && <ExampleBadge />}
                            </div>
                            <span className="text-[11px] text-muted-foreground block truncate mt-0.5">
                              {v.description}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!v.isPrimary && !v.isExample && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                onClick={() => void setPrimaryUserVehicle(uid, v.id)}
                                title="Set as primary vehicle"
                                className="text-muted-foreground hover:text-amber-500"
                              >
                                <Star className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => startEditVehicle(v)}
                              title={v.isExample ? 'Replace with real vehicle' : 'Edit vehicle'}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => void handleDeleteVehicle(v)}
                              title="Remove vehicle"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleAddVehicle} className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="PLATE (e.g. ABC-1234)"
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="sm:w-44 font-mono uppercase"
                />
                <Input
                  type="text"
                  placeholder="Vehicle description (e.g. Honda Civic Blue)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="emerald" size="sm" className="shrink-0">
                  Add Real Vehicle
                </Button>
              </div>
              {exampleVehicleCount > 0 && (
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={replaceExampleVehicle}
                    onChange={(e) => setReplaceExampleVehicle(e.target.checked)}
                    className="rounded border-border accent-emerald-600"
                  />
                  <span>Automatically clear example vehicle (BXY-8492) when adding my real vehicle</span>
                </label>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Saved Favorites List */}
        <Card id="favorites">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                <div>
                  <h2 className="font-bold text-base text-foreground">
                    Saved Favorites ({favorites.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Bookmarked parking stalls near your home, office, and downtown Calgary destinations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {favorites.length === 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void restoreExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.favorites])}
                    className="text-xs gap-1 text-muted-foreground"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Load Example
                  </Button>
                )}
                <Link href="/app" className="text-xs font-semibold text-primary hover:underline">
                  Explore Map →
                </Link>
              </div>
            </div>

            <ExampleDataBanner
              sectionLabel="favorite spot"
              exampleCount={exampleFavoriteCount}
              onClearExamples={() => dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.favorites])}
            />

            {favorites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No favorite parking zones saved yet. Open the{' '}
                <Link href="/app" className="text-primary font-semibold hover:underline">
                  Interactive Map
                </Link>{' '}
                and click &quot;Save Favorite&quot; on any zone sheet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {favorites.map((fav) => {
                  const isEditing = editingFavId === fav.id;
                  return (
                    <div
                      key={fav.id}
                      className={`p-3.5 rounded-2xl border ${
                        fav.isExample
                          ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                          : 'border-border bg-background'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              type="text"
                              value={editFavLabel}
                              onChange={(e) => setEditFavLabel(e.target.value)}
                              placeholder="Spot label (e.g. Work Office)"
                              className="h-8 text-xs"
                            />
                            <Input
                              type="text"
                              value={editFavNotes}
                              onChange={(e) => setEditFavNotes(e.target.value)}
                              placeholder="Personal notes (optional)"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingFavId(null)}
                              className="h-7 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              variant="emerald"
                              size="sm"
                              onClick={() => void handleSaveFavoriteEdit(fav)}
                              className="h-7 text-xs"
                            >
                              {fav.isExample ? 'Save as Real Favorite' : 'Save Changes'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-foreground">
                                {fav.label}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                Zone #{fav.zoneId}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                ${fav.hourlyRate.toFixed(2)}/hr
                              </Badge>
                              {fav.isExample && <ExampleBadge />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{fav.address}</p>
                            {fav.notes && (
                              <p className="text-[11px] text-muted-foreground/90 italic">{fav.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => startEditFavorite(fav)}
                              title="Edit favorite label & notes"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="iconSm"
                              onClick={() => void handleDeleteFavorite(fav)}
                              title="Delete favorite"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Custom Destinations & Expenses Summary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card id="locations">
            <CardContent className="p-6 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">
                    Custom Destinations ({locations.length})
                  </h3>
                </div>
                <Link href="/app" className="text-xs text-primary font-semibold hover:underline">
                  Manage on Map →
                </Link>
              </div>

              <ExampleDataBanner
                compact
                sectionLabel="destination"
                exampleCount={exampleLocationCount}
                onClearExamples={() => dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.locations])}
              />

              {locations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground space-y-2">
                  <p>No destinations saved yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openWalkthrough('locations')}
                    className="h-7 text-[11px]"
                  >
                    Add Destination in Walkthrough
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {locations.map((loc) => {
                    const isEditing = editingLocId === loc.id;
                    return (
                      <div
                        key={loc.id}
                        className={`p-3 rounded-xl border text-xs ${
                          loc.isExample
                            ? 'border-dashed border-amber-500/40 bg-amber-500/5'
                            : 'border-border bg-background'
                        }`}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              type="text"
                              value={editLocName}
                              onChange={(e) => setEditLocName(e.target.value)}
                              placeholder="Destination name"
                              className="h-8 text-xs"
                            />
                            <Input
                              type="text"
                              value={editLocAddress}
                              onChange={(e) => setEditLocAddress(e.target.value)}
                              placeholder="Calgary street address"
                              className="h-8 text-xs"
                            />
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingLocId(null)}
                                className="h-7 text-[11px]"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                variant="emerald"
                                size="sm"
                                onClick={() => void handleSaveLocationEdit(loc)}
                                className="h-7 text-[11px]"
                              >
                                {loc.isExample ? 'Replace Example' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-foreground truncate">{loc.name}</span>
                                {loc.isExample && <ExampleBadge label="Example" />}
                              </div>
                              <span className="text-[11px] text-muted-foreground block truncate">
                                {loc.address}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                onClick={() => startEditLocation(loc)}
                                title="Edit destination"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                onClick={() => void handleDeleteLocation(loc)}
                                title="Remove destination"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-sm text-foreground">
                    Parking Expenses ({realSessionCount} real)
                  </h3>
                  {realSessionCount === 0 && exampleSessionCount > 0 && (
                    <ExampleBadge label="Example Preview" />
                  )}
                </div>
                <Link href="/expenses" className="text-xs text-primary font-semibold hover:underline">
                  Manage &amp; Export CSV →
                </Link>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                View your Detailed Transaction History, replace preloaded example receipts with real parking logs, and export CRA-compliant CSV reports.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Button asChild variant="emerald" size="sm" className="text-xs gap-1.5">
                  <Link href="/expenses">
                    <Receipt className="w-3.5 h-3.5" />
                    Open Detailed Transaction History
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openWalkthrough('expenses')}
                  className="text-xs"
                >
                  Setup in Walkthrough
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
