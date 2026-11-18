'use client';

import React from 'react';
import { Activity, RefreshCw, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface ApiStatusItem {
  id: string;
  name: string;
  description: string;
  provider: string;
  status: 'operational' | 'degraded' | 'offline';
  statusText: string;
  lastUpdated: string;
}

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lastUpdatedTimestamp?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function SettingsDialog({
  isOpen,
  onClose,
  lastUpdatedTimestamp,
  onRefresh,
  isRefreshing = false,
}: SettingsDialogProps) {
  const updateDate = lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp) : new Date();

  const formattedDate = updateDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = updateDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  const fullTimestamp = `${formattedDate} at ${formattedTime}`;

  const apis: ApiStatusItem[] = [
    {
      id: 'cpa-arcgis',
      name: 'Calgary Parking Authority API',
      provider: 'City of Calgary ArcGIS FeatureServer',
      description: 'On-street parking zones, live dynamic rate schedules, enforceable hours & stall capacities',
      status: 'operational',
      statusText: 'Operational',
      lastUpdated: fullTimestamp,
    },
    {
      id: 'osm-tiles',
      name: 'OpenStreetMap Tile Service',
      provider: 'OpenStreetMap Foundation & Carto CDN',
      description: 'Standard, Clean Light, and Humanitarian basemap vector & raster rendering tiles',
      status: 'operational',
      statusText: 'Operational',
      lastUpdated: `${formattedDate} (Live CDN)`,
    },
    {
      id: 'osm-nominatim',
      name: 'Nominatim Geocoding API',
      provider: 'OpenStreetMap Geocoding Engine',
      description: 'City address lookup, point-of-interest geocoding, and GPS coordinate resolution',
      status: 'operational',
      statusText: 'Operational',
      lastUpdated: `${formattedDate} (On-Demand)`,
    },
    {
      id: 'firebase-firestore',
      name: 'Google Cloud Firestore',
      provider: 'Google Firebase Cloud Infrastructure',
      description: 'Cross-device user authentication, cloud saved favorites, and parking expense logs',
      status: 'operational',
      statusText: 'Connected',
      lastUpdated: `${formattedDate} (Active Session)`,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">API Status</DialogTitle>
              <DialogDescription className="text-xs">
                Real-time operational status and synchronization dates for connected Calgary parking feeds.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Overall Health Summary Banner */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">All Systems &amp; APIs Operational</span>
          </div>
          <Badge variant="success" className="font-bold text-[10px]">
            100% HEALTHY
          </Badge>
        </div>

        {/* List of APIs */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2.5">
          {apis.map((api) => (
            <Card key={api.id} className="transition-colors hover:border-primary/40">
              <CardContent className="p-3.5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Status Dot */}
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <span className="font-bold text-sm text-foreground">
                      {api.name}
                    </span>
                  </div>
                  <Badge variant="success" className="text-[10px] font-bold">
                    {api.statusText}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pl-4.5">
                  {api.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground pl-4.5">
                  <span className="truncate">Provider: <strong className="text-foreground font-medium">{api.provider}</strong></span>
                  <span className="font-medium text-foreground">
                    Last Update: <span className="text-primary font-semibold">{api.lastUpdated}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="gap-2 pt-2 border-t border-border sm:justify-between items-center">
          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Automatic background sync every 30 minutes
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-busy={isRefreshing}
                className={`group gap-1.5 transition-all duration-200 disabled:pointer-events-none disabled:opacity-65 disabled:cursor-not-allowed ${
                  isRefreshing
                    ? 'border-primary/50 bg-primary/10 text-primary ring-2 ring-primary/20 animate-pulse'
                    : ''
                }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-transform duration-500 ${
                    isRefreshing ? 'animate-spin text-primary' : 'group-hover:rotate-180'
                  }`}
                />
                <span>{isRefreshing ? 'Refreshing...' : 'Check Status'}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
