'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import OriginalHeader from '@/components/map/OriginalHeader';
import SecondaryToolbar from '@/components/map/SecondaryToolbar';
import ProviderToolbar from '@/components/map/ProviderToolbar';
import MapOverlays from '@/components/map/MapOverlays';
import ZoneDetailSheet from '@/components/map/ZoneDetailSheet';
import LocationsDialog from '@/components/map/LocationsDialog';
import SettingsDialog from '@/components/map/SettingsDialog';
import ParkingAlarmDialog from '@/components/map/ParkingAlarmDialog';
import ProGateModal from '@/components/auth/ProGateModal';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWalkthrough } from '@/components/onboarding/WalkthroughProvider';
import {
  deleteUserLocation,
  dismissExamplesForUser,
  restoreExamplesForUser,
  saveOrReplaceLocation,
  saveUserLocation,
} from '@/lib/firebase/firestore';
import { EXAMPLE_IDS_BY_SECTION } from '@/lib/parking/example-data';
import {
  ParkingZone,
  ProviderId,
  CustomLocation,
  BasemapId,
} from '@/lib/parking/types';
import {
  fetchCalgaryParkingZones,
  getLastDataFetchTime,
  SAMPLE_CALGARY_ZONES,
} from '@/lib/parking/data-service';

const MapLibreView = dynamic(() => import('@/components/map/MapLibreView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
      Loading Calgary Parking Map...
    </div>
  ),
});

function calculateHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapAppPage() {
  const { user, profile, isAdmin } = useAuth();
  const {
    locations: customLocations,
    isOpen: isWalkthroughOpen,
    isMinimized: isWalkthroughMinimized,
    refreshData,
  } = useWalkthrough();
  const uid = user?.uid || profile?.uid || 'demo_user';
  // Initial state must be identical on server and client to avoid hydration mismatches.
  // Cached zones (sessionStorage) arrive right after mount via fetchCalgaryParkingZones,
  // which serves its cache before touching the network.
  const [allZones, setAllZones] = useState<ParkingZone[]>(SAMPLE_CALGARY_ZONES);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrz, setSelectedBrz] = useState('ALL');
  const [selectedProviders, setSelectedProviders] = useState<ProviderId[]>([
    'parkplus_on_street',
    'cpa_off_street',
    'calgary_transit',
    'impark',
    'indigo',
    'precise_parklink',
  ]);
  const [priceFilter, setPriceFilter] = useState('ALL');
  const [rateMode, setRateMode] = useState<'max' | 'live'>('max');
  const [basemap, setBasemap] = useState<BasemapId>('osm');

  // Map layer toggles
  const [showPins, setShowPins] = useState(true);
  const [showShapes, setShowShapes] = useState(true);
  const [showCluster, setShowCluster] = useState(true);

  // Proximity & Custom Locations
  const [activeLocationId, setActiveLocationId] = useState<string>('NONE');
  const [maxRadius, setMaxRadius] = useState<number | 'ALL'>(500);
  const [sortMode, setSortMode] = useState<'closest_cheapest' | 'cheapest' | 'closest'>('closest_cheapest');
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [showBestValuePanel, setShowBestValuePanel] = useState(true);

  // Modals & Panels
  const deepLinkZoneHandledRef = useRef(false);
  // ?zone= deep links are resolved once zones load (see the data-loading effect below)
  const [selectedZone, setSelectedZone] = useState<ParkingZone | null>(null);
  const [previewZone, setPreviewZone] = useState<ParkingZone | null>(null);
  const [showLocationsDialog, setShowLocationsDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [alarmZone, setAlarmZone] = useState<ParkingZone | null>(null);
  const [proGateInfo, setProGateInfo] = useState<{ name: string; desc: string } | null>(null);

  // Active target location object
  const activeLocation = useMemo(() => {
    if (activeLocationId === 'NONE') return null;
    return customLocations.find((loc) => loc.id === activeLocationId) || null;
  }, [customLocations, activeLocationId]);

  // Load Parking Data
  useEffect(() => {
    let mounted = true;
    fetchCalgaryParkingZones()
      .then((data) => {
        if (mounted) {
          setAllZones(data);
          setLastUpdated(getLastDataFetchTime());
          if (!deepLinkZoneHandledRef.current && typeof window !== 'undefined') {
            deepLinkZoneHandledRef.current = true;
            const zoneId = new URLSearchParams(window.location.search).get('zone');
            if (zoneId) {
              const match = data.find((z) => z.id === zoneId || z.zoneNumber === zoneId);
              if (match) {
                setSelectedZone((prev) => prev ?? match);
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching parking data:', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Dismiss zone preview card on Escape when details sheet is closed
  useEffect(() => {
    if (!previewZone || selectedZone) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewZone(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewZone, selectedZone]);

  // Theme synchronization
  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof document !== 'undefined') {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const [freshData] = await Promise.all([
        fetchCalgaryParkingZones(true),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
      setAllZones(freshData);
      setLastUpdated(getLastDataFetchTime());
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Provider Toggles
  const handleToggleProvider = (pid: ProviderId) => {
    setSelectedProviders((prev) =>
      prev.includes(pid) ? prev.filter((p) => p !== pid) : [...prev, pid]
    );
  };

  const handleSelectAllProviders = () => {
    setSelectedProviders([
      'parkplus_on_street',
      'cpa_off_street',
      'calgary_transit',
      'impark',
      'indigo',
      'precise_parklink',
    ]);
  };

  const handleClearProviders = () => {
    setSelectedProviders([]);
  };

  // Provider Counts
  const providerCounts = useMemo(() => {
    const counts: Record<ProviderId, number> = {
      parkplus_on_street: 0,
      cpa_off_street: 0,
      calgary_transit: 0,
      impark: 0,
      indigo: 0,
      precise_parklink: 0,
    };
    allZones.forEach((z) => {
      if (counts[z.provider] !== undefined) {
        counts[z.provider]++;
      }
    });
    return counts;
  }, [allZones]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedBrz('ALL');
    setPriceFilter('ALL');
    setRateMode('max');
    setActiveLocationId('NONE');
    setMaxRadius(500);
    setSortMode('closest_cheapest');
    setPreviewZone(null);
    handleSelectAllProviders();
  };

  // Custom Locations Helpers
  const handleAddLocation = async (loc: CustomLocation) => {
    await saveUserLocation(uid, loc);
    await refreshData();
    setActiveLocationId(loc.id);
  };

  const handleUpdateLocation = async (
    orig: CustomLocation,
    updated: { name: string; address: string; coordinates: [number, number] }
  ) => {
    const saved = await saveOrReplaceLocation(uid, orig, updated);
    await refreshData();
    if (orig.isExample && activeLocationId === orig.id) {
      setActiveLocationId(saved.id);
    }
  };

  const handleDeleteLocation = async (loc: CustomLocation) => {
    if (loc.isExample) {
      await dismissExamplesForUser(uid, [loc.id]);
    } else {
      await deleteUserLocation(uid, loc.id);
    }
    await refreshData();
    if (activeLocationId === loc.id) setActiveLocationId('NONE');
  };

  const handleClearExampleLocations = async () => {
    const exampleIds = customLocations.filter((l) => l.isExample).map((l) => l.id);
    await dismissExamplesForUser(
      uid,
      exampleIds.length > 0 ? exampleIds : [...EXAMPLE_IDS_BY_SECTION.locations]
    );
    await refreshData();
    setActiveLocationId((prev) => (exampleIds.includes(prev) ? 'NONE' : prev));
  };

  const handleRestoreExampleLocations = async () => {
    await restoreExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.locations]);
    await refreshData();
  };

  // Map Point Clicked in Picker Mode
  const handlePickMapPoint = (coords: [number, number]) => {
    if (!isPickingLocation) return;
    setIsPickingLocation(false);
    const newLoc: CustomLocation = {
      id: `loc_${Date.now()}`,
      name: `Picked Location (${coords[1].toFixed(4)}, ${coords[0].toFixed(4)})`,
      address: `Custom Map Point`,
      coordinates: coords,
      createdAt: Date.now(),
    };
    void handleAddLocation(newLoc);
  };

  // Filtered & Sorted Parking Zones
  const filteredZones = useMemo(() => {
    const targetCoords = activeLocation ? activeLocation.coordinates : null;

    let result = allZones.map((zone) => {
      let distanceToTarget: number | null = null;
      let walkingMinutes: number | null = null;

      if (targetCoords) {
        distanceToTarget = calculateHaversineMeters(
          targetCoords[1],
          targetCoords[0],
          zone.coordinates[1],
          zone.coordinates[0]
        );
        walkingMinutes = Math.max(1, Math.round(distanceToTarget / 80));
      }

      return {
        ...zone,
        distanceToTarget,
        walkingMinutes,
      };
    });

    // 1. Provider Filter
    result = result.filter((zone) => selectedProviders.includes(zone.provider));

    // 2. BRZ Filter
    if (selectedBrz !== 'ALL') {
      const target = selectedBrz.toLowerCase();
      result = result.filter((zone) => (zone.brz || '').toLowerCase().includes(target));
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (zone) =>
          zone.id.toLowerCase().includes(q) ||
          (zone.zoneNumber || '').toLowerCase().includes(q) ||
          zone.title.toLowerCase().includes(q) ||
          zone.address.toLowerCase().includes(q)
      );
    }

    // 4. Price Threshold Filter
    if (priceFilter !== 'ALL') {
      if (priceFilter === 'free') {
        result = result.filter((zone) => zone.isCurrentlyFree || zone.activeRate === 0);
      } else {
        const maxThreshold = parseFloat(priceFilter);
        result = result.filter((zone) => zone.activeRate <= maxThreshold);
      }
    }

    // 5. Proximity Radius Filter (when target active)
    if (targetCoords && maxRadius !== 'ALL') {
      const limit = Number(maxRadius);
      result = result.filter(
        (zone) => zone.distanceToTarget !== null && zone.distanceToTarget <= limit
      );
    }

    // 6. Proximity / Price Sorting
    if (targetCoords) {
      result.sort((a, b) => {
        const distA = a.distanceToTarget || 0;
        const distB = b.distanceToTarget || 0;
        const rateA = rateMode === 'live' && a.isCurrentlyFree ? 0 : a.activeRate;
        const rateB = rateMode === 'live' && b.isCurrentlyFree ? 0 : b.activeRate;

        if (sortMode === 'cheapest') {
          return rateA - rateB || distA - distB;
        }
        if (sortMode === 'closest') {
          return distA - distB || rateA - rateB;
        }
        // closest_cheapest (Best Value combined rank)
        const scoreA = rateA * 2 + distA / 100;
        const scoreB = rateB * 2 + distB / 100;
        return scoreA - scoreB;
      });
    }

    return result;
  }, [
    allZones,
    selectedProviders,
    selectedBrz,
    searchQuery,
    priceFilter,
    rateMode,
    activeLocation,
    maxRadius,
    sortMode,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* 1. Authentic Header / Navbar */}
      <OriginalHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedBrz={selectedBrz}
        onBrzChange={setSelectedBrz}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenSettings={() => {
          if (isAdmin) setShowSettingsDialog(true);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Secondary Toolbar (Target Location, Radius, Price, Sort) */}
      <SecondaryToolbar
        customLocations={customLocations}
        activeLocationId={activeLocationId}
        onSelectLocation={setActiveLocationId}
        onOpenManageLocations={() => setShowLocationsDialog(true)}
        maxRadius={maxRadius}
        onRadiusChange={setMaxRadius}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        priceFilter={priceFilter}
        onPriceFilterChange={setPriceFilter}
        rateMode={rateMode}
        onRateModeChange={setRateMode}
        showBestValuePanel={showBestValuePanel}
        onToggleBestValuePanel={() => setShowBestValuePanel(!showBestValuePanel)}
        onResetFilters={handleResetFilters}
        bestValueCount={filteredZones.length}
      />

      {/* 3. Provider Toolbar (Colored Pills & Select All / Clear) */}
      <ProviderToolbar
        selectedProviders={selectedProviders}
        onToggleProvider={handleToggleProvider}
        onSelectAllProviders={handleSelectAllProviders}
        onClearProviders={handleClearProviders}
        providerCounts={providerCounts}
      />

      {/* 4. Main Interactive Map Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* MapLibre 60fps WebGL Canvas with Authentic Teardrop Branded Pins */}
        <MapLibreView
          zones={filteredZones}
          selectedZone={selectedZone}
          onSelectZone={(z) => {
            setPreviewZone(null);
            setSelectedZone(z);
          }}
          previewZone={selectedZone ? null : previewZone}
          onPreviewZone={(z) => setPreviewZone(z)}
          basemap={basemap}
          showPins={showPins}
          clusterPins={showCluster}
          showShapes={showShapes}
          rateMode={rateMode}
          activeLocation={activeLocation}
          maxRadius={maxRadius}
          isPickingLocation={isPickingLocation}
          onPickMapPoint={handlePickMapPoint}
          hasOpenModal={
            showLocationsDialog ||
            showSettingsDialog ||
            Boolean(alarmZone) ||
            Boolean(proGateInfo) ||
            (isWalkthroughOpen && !isWalkthroughMinimized)
          }
        />

        {/* Map Overlays (Status, Zone Count, Legend, Best Value, Preview Card, Controls) */}
        <MapOverlays
          totalZonesCount={allZones.length}
          filteredZonesCount={filteredZones.length}
          showPins={showPins}
          onTogglePins={() => setShowPins(!showPins)}
          showShapes={showShapes}
          onToggleShapes={() => setShowShapes(!showShapes)}
          showCluster={showCluster}
          onToggleCluster={() => setShowCluster(!showCluster)}
          basemap={basemap}
          onBasemapChange={setBasemap}
          isPickingLocation={isPickingLocation}
          onCancelPickLocation={() => setIsPickingLocation(false)}
          activeLocation={activeLocation}
          showBestValuePanel={showBestValuePanel}
          onCloseBestValuePanel={() => setShowBestValuePanel(false)}
          bestValueZones={filteredZones}
          onSelectZone={(z) => {
            setPreviewZone(null);
            setSelectedZone(z);
          }}
          previewZone={
            selectedZone || !previewZone
              ? null
              : filteredZones.find((z) => z.id === previewZone.id) || previewZone
          }
          onInspectZone={(z) => {
            setPreviewZone(null);
            setSelectedZone(z);
          }}
          onClosePreviewZone={() => setPreviewZone(null)}
          isRefreshing={isRefreshing}
        />

        {/* Authentic 4-Tab Slide-Out Details Sheet */}
        {selectedZone && (
          <ZoneDetailSheet
            key={selectedZone.id}
            zone={selectedZone}
            onClose={() => setSelectedZone(null)}
            onTriggerProGate={(name, desc) => setProGateInfo({ name, desc })}
            onOpenAlarm={(z) => setAlarmZone(z)}
            onZoomToZone={(z) => setSelectedZone(z)}
          />
        )}

        {/* Custom Locations Management Modal */}
        <LocationsDialog
          isOpen={showLocationsDialog}
          onClose={() => setShowLocationsDialog(false)}
          locations={customLocations}
          onAddLocation={handleAddLocation}
          onUpdateLocation={handleUpdateLocation}
          onDeleteLocation={handleDeleteLocation}
          onClearExamples={handleClearExampleLocations}
          onRestoreExamples={handleRestoreExampleLocations}
          onSelectLocation={setActiveLocationId}
          onStartMapPick={() => setIsPickingLocation(true)}
        />

        {/* API Status & Data Feeds Modal */}
        <SettingsDialog
          isOpen={isAdmin && showSettingsDialog}
          onClose={() => setShowSettingsDialog(false)}
          lastUpdatedTimestamp={lastUpdated}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Parking Alarm Dialog */}
        {alarmZone && (
          <ParkingAlarmDialog zone={alarmZone} onClose={() => setAlarmZone(null)} />
        )}

        {/* Pro Gate Modal */}
        {proGateInfo && (
          <ProGateModal
            featureName={proGateInfo.name}
            description={proGateInfo.desc}
            onClose={() => setProGateInfo(null)}
          />
        )}
      </div>
    </div>
  );
}
