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
} from 'lucide-react';
import { CustomLocation } from '@/lib/parking/types';
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
  onAddLocation: (loc: CustomLocation) => void;
  onDeleteLocation: (id: string) => void;
  onSelectLocation: (id: string) => void;
  onStartMapPick: () => void;
}

export default function LocationsDialog({
  isOpen,
  onClose,
  locations,
  onAddLocation,
  onDeleteLocation,
  onSelectLocation,
  onStartMapPick,
}: LocationsDialogProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Simple geocoding using Calgary Open Addresses / Nominatim / Coordinate parsing
  const handleGeocode = async () => {
    if (!address.trim()) {
      setStatusMsg({ text: 'Please enter an address or coordinates', isError: true });
      return;
    }

    // Check if user entered coordinates directly: "lat, lng" or "lng, lat"
    const coordMatch = address.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const v1 = parseFloat(coordMatch[1]);
      const v2 = parseFloat(coordMatch[3]);
      const lat = v1 > 40 && v1 < 60 ? v1 : v2;
      const lng = v1 < -100 && v1 > -130 ? v1 : v2;
      setStatusMsg({ text: `Recognized coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      return;
    }

    try {
      setIsGeocoding(true);
      setStatusMsg({ text: 'Searching address via Calgary Geocoding...' });

      const query = encodeURIComponent(`${address.trim()}, Calgary, AB, Canada`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' },
      });
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        setStatusMsg({ text: `Found: ${item.display_name.split(',')[0]} (${lat.toFixed(4)}, ${lon.toFixed(4)})` });
      } else {
        setStatusMsg({
          text: 'Address not found in Calgary. Using Calgary Downtown Core as fallback.',
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

  const handleSave = () => {
    if (!name.trim()) {
      setStatusMsg({ text: 'Please enter a name for this custom location', isError: true });
      return;
    }

    let lat = 51.0447;
    let lng = -114.0719;

    const coordMatch = address.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const v1 = parseFloat(coordMatch[1]);
      const v2 = parseFloat(coordMatch[3]);
      lat = v1 > 40 && v1 < 60 ? v1 : v2;
      lng = v1 < -100 && v1 > -130 ? v1 : v2;
    }

    const newLoc: CustomLocation = {
      id: `loc_${Date.now()}`,
      name: name.trim(),
      address: address.trim() || 'Calgary, AB',
      coordinates: [lng, lat],
      createdAt: Date.now(),
    };

    onAddLocation(newLoc);
    setName('');
    setAddress('');
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

        {/* Saved Locations Table */}
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Saved Locations</span>
            <Badge variant="secondary" className="text-[11px]">
              {locations.length} saved
            </Badge>
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
                    <TableRow key={loc.id}>
                      <TableCell className="font-semibold text-foreground py-2 px-3">
                        {loc.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs py-2 px-3 truncate max-w-xs">
                        {loc.address} ({loc.coordinates[1].toFixed(4)}, {loc.coordinates[0].toFixed(4)})
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right space-x-1.5">
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
                          onClick={() => onDeleteLocation(loc.id)}
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

        {/* Add New Location Form Row */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PlusCircle className="h-4 w-4 text-primary" />
              <span>Add New Location</span>
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
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 530 8 Ave SW or lat, lng"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGeocode}
                    disabled={isGeocoding}
                    className="shrink-0"
                    title="Geocode Calgary Address"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Find</span>
                  </Button>
                </div>
              </div>
            </div>

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
                variant="default"
                size="sm"
                onClick={handleSave}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Location</span>
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
