'use client';

import React, { useState } from 'react';
import {
  MapPin,
  PlusCircle,
  Search,
  Crosshair,
  Navigation,
  Plus,
  Trash2,
  Pencil,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';
import { CustomLocation } from '@/lib/parking/types';
import ExampleDataBanner, { ExampleBadge } from '@/components/onboarding/ExampleDataBanner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface LocationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  locations: CustomLocation[];
  onAddLocation: (loc: CustomLocation) => void | Promise<void>;
  onUpdateLocation: (
    orig: CustomLocation,
    updated: { name: string; address: string; coordinates: [number, number] }
  ) => void | Promise<void>;
  onDeleteLocation: (loc: CustomLocation) => void | Promise<void>;
  onClearExamples: () => void | Promise<void>;
  onRestoreExamples: () => void | Promise<void>;
  onSelectLocation: (id: string) => void;
  onStartMapPick: () => void;
}

export default function LocationsDialog({
  isOpen,
  onClose,
  locations,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  onClearExamples,
  onRestoreExamples,
  onSelectLocation,
  onStartMapPick,
}: LocationsDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [resolvedCoords, setResolvedCoords] = useState<[number, number] | null>(null);
  const [editingLocation, setEditingLocation] = useState<CustomLocation | null>(null);
  const [clearRemainingExamples, setClearRemainingExamples] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const exampleCount = locations.filter((l) => Boolean(l.isExample)).length;

  const parseCoordinateString = (raw: string): [number, number] | null => {
    const coordMatch = raw.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (!coordMatch) return null;
    const v1 = parseFloat(coordMatch[1]);
    const v2 = parseFloat(coordMatch[3]);
    const lat = v1 > 40 && v1 < 60 ? v1 : v2;
    const lng = v1 < -100 && v1 > -130 ? v1 : v2;
    return [lng, lat];
  };

  const resetForm = () => {
    setEditingLocation(null);
    setName('');
    setAddress('');
    setResolvedCoords(null);
  };

  const startEdit = (loc: CustomLocation) => {
    setEditingLocation(loc);
    setName(loc.name);
    setAddress(loc.address);
    setResolvedCoords(loc.coordinates);
    setStatusMsg({
      text: loc.isExample
        ? `Replacing example "${loc.name}" — customize and save as your real destination.`
        : `Editing "${loc.name}".`,
    });
  };

  const handleGeocode = async () => {
    if (!address.trim()) {
      setStatusMsg({ text: 'Please enter an address or coordinates', isError: true });
      return;
    }

    const parsedCoords = parseCoordinateString(address.trim());
    if (parsedCoords) {
      setResolvedCoords(parsedCoords);
      setStatusMsg({
        text: `Recognized coordinates: ${parsedCoords[1].toFixed(4)}, ${parsedCoords[0].toFixed(4)}`,
      });
      return;
    }

    try {
      setIsGeocoding(true);
      setStatusMsg({ text: 'Searching address via Calgary Geocoding...' });

      const query = encodeURIComponent(`${address.trim()}, Calgary, AB, Canada`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        setResolvedCoords([lon, lat]);
        setStatusMsg({
          text: `Found & locked: ${item.display_name.split(',')[0]} (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
        });
      } else {
        setResolvedCoords(null);
        setStatusMsg({
          text: 'Address not found in Calgary. Using Calgary Downtown Core as fallback unless you pick on the map.',
          isError: true,
        });
      }
    } catch {
      setStatusMsg({ text: 'Geocoding request failed. Please check network connection.', isError: true });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setStatusMsg({ text: 'Geolocation is not supported by your browser', isError: true });
      return;
    }

    setStatusMsg({ text: 'Locating via device GPS...' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setResolvedCoords([lng, lat]);
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        if (!name.trim()) setName('My GPS Location');
        setStatusMsg({ text: `GPS coordinates locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      },
      (err) => {
        setStatusMsg({ text: `GPS error: ${err.message}`, isError: true });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setStatusMsg({ text: 'Please enter a name for this custom location', isError: true });
      return;
    }

    const parsedFromAddress = parseCoordinateString(address.trim());
    const coords: [number, number] =
      parsedFromAddress ||
      resolvedCoords ||
      (editingLocation ? editingLocation.coordinates : [-114.0719, 51.0447]);

    const cleanAddress = address.trim() || 'Calgary, AB';

    if (editingLocation) {
      await onUpdateLocation(editingLocation, {
        name: name.trim(),
        address: cleanAddress,
        coordinates: coords,
      });
      if (editingLocation.isExample && clearRemainingExamples && exampleCount > 1) {
        await onClearExamples();
      }
      setStatusMsg({ text: `Saved "${name.trim()}"!` });
      resetForm();
      return;
    }

    const newLoc: CustomLocation = {
      id: `loc_${Date.now()}`,
      name: name.trim(),
      address: cleanAddress,
      coordinates: coords,
      createdAt: Date.now(),
      isExample: false,
    };

    await onAddLocation(newLoc);
    if (clearRemainingExamples && exampleCount > 0) {
      await onClearExamples();
    }
    resetForm();
    setStatusMsg({ text: `Added "${newLoc.name}" to custom locations!` });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Custom Locations
          </DialogTitle>
          <DialogDescription>
            Save your office, home, or frequent destinations to discover the closest and cheapest parking.
          </DialogDescription>
        </DialogHeader>

        <ExampleDataBanner
          compact
          sectionLabel="destination"
          exampleCount={exampleCount}
          onClearExamples={onClearExamples}
        />

        {/* Saved Locations Table */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Saved Locations</span>
            <div className="flex items-center gap-2">
              {locations.length === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void onRestoreExamples()}
                  className="h-6 text-[11px] gap-1 text-muted-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  Load Examples
                </Button>
              )}
              <Badge variant="secondary" className="text-[11px]">
                {locations.length} saved
              </Badge>
            </div>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-2 px-3">Name</TableHead>
                  <TableHead className="py-2 px-3">Location / Coordinates</TableHead>
                  <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground text-xs">
                      No custom locations saved yet. Add your first destination below!
                    </TableCell>
                  </TableRow>
                ) : (
                  locations.map((loc) => (
                    <TableRow
                      key={loc.id}
                      className={loc.isExample ? 'bg-amber-500/5 hover:bg-amber-500/10' : undefined}
                    >
                      <TableCell className="font-semibold text-foreground py-2 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{loc.name}</span>
                          {loc.isExample && <ExampleBadge label="Example" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs py-2 px-3 truncate max-w-xs">
                        {loc.address} ({loc.coordinates[1].toFixed(4)}, {loc.coordinates[0].toFixed(4)})
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right whitespace-nowrap space-x-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-2.5"
                          onClick={() => {
                            onSelectLocation(loc.id);
                            onClose();
                          }}
                        >
                          Select
                        </Button>
                        <Button
                          type="button"
                          size="iconSm"
                          variant="ghost"
                          onClick={() => startEdit(loc)}
                          title={loc.isExample ? 'Replace with real destination' : 'Edit destination'}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="iconSm"
                          variant="ghost"
                          onClick={() => void onDeleteLocation(loc)}
                          title={loc.isExample ? 'Remove example' : 'Delete destination'}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Add / Edit Location Form */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4 text-primary" />
                <span>
                  {editingLocation
                    ? editingLocation.isExample
                      ? `Replace Example: ${editingLocation.name}`
                      : `Edit Location: ${editingLocation.name}`
                    : 'Add New Location'}
                </span>
              </div>
              {editingLocation && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-6 text-[11px] gap-1"
                >
                  <X className="h-3 w-3" />
                  Cancel Edit
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loc-name">Location Name</Label>
                <Input
                  id="loc-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Office, Gym, Client Site..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="loc-address">Address or Coordinates</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="loc-address"
                    type="text"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (!editingLocation) setResolvedCoords(null);
                    }}
                    placeholder="e.g. 530 8 Ave SW or lat, lng"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeocode}
                    disabled={isGeocoding}
                    className="shrink-0 h-9 px-3 text-xs rounded-lg"
                    title="Geocode Calgary Address"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Find</span>
                  </Button>
                </div>
              </div>
            </div>

            {exampleCount > 0 && (!editingLocation || editingLocation.isExample) && (
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={clearRemainingExamples}
                  onChange={(e) => setClearRemainingExamples(e.target.checked)}
                  className="rounded border-border accent-emerald-600"
                />
                <span>Clear remaining example landmarks when saving my real destination</span>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onStartMapPick();
                  }}
                  title="Click on the Map to pick coordinates"
                >
                  <Crosshair className="h-3.5 w-3.5 text-primary" />
                  <span>Pick Point on Map</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseGps}
                  title="Use current device geolocation"
                >
                  <Navigation className="h-3.5 w-3.5 text-primary" />
                  <span>Use My GPS</span>
                </Button>
              </div>

              <Button
                type="button"
                variant="emerald"
                size="sm"
                onClick={() => void handleSave()}
              >
                {editingLocation ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>
                  {editingLocation
                    ? editingLocation.isExample
                      ? 'Save as Real Location'
                      : 'Save Changes'
                    : 'Add Location'}
                </span>
              </Button>
            </div>

            {statusMsg && (
              <div
                className={`text-[11px] ${
                  statusMsg.isError ? 'text-destructive font-semibold' : 'text-emerald-600 font-medium'
                }`}
              >
                {statusMsg.text}
              </div>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
