'use client';

import React, { useState } from 'react';
import { ParkingSession } from '@/lib/parking/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Receipt } from 'lucide-react';

interface TransactionFormDialogProps {
  isOpen: boolean;
  initialSession: ParkingSession | null;
  defaultStartTime: number;
  hasRemainingExamples: boolean;
  onClose: () => void;
  onSave: (payload: {
    session: ParkingSession;
    replaceExampleId?: string;
    clearAllExamples?: boolean;
  }) => Promise<void>;
}

function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(ts: number): string {
  const d = new Date(ts);
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${hrs}:${mins}`;
}

export default function TransactionFormDialog({
  isOpen,
  initialSession,
  defaultStartTime,
  hasRemainingExamples,
  onClose,
  onSave,
}: TransactionFormDialogProps) {
  const seedTs = initialSession ? initialSession.startTime : defaultStartTime;
  const isReplacingExample = Boolean(initialSession?.isExample);
  const isEditingExisting = Boolean(initialSession && !initialSession.isExample);

  const [dateStr, setDateStr] = useState(() => toDateInputValue(seedTs));
  const [timeStr, setTimeStr] = useState(() => toTimeInputValue(seedTs));
  const [zoneId, setZoneId] = useState(() => initialSession?.zoneId || '');
  const [address, setAddress] = useState(() => initialSession?.address || '');
  const [durationHours, setDurationHours] = useState(() =>
    initialSession ? String(initialSession.durationHours) : '2'
  );
  const [hourlyRate, setHourlyRate] = useState(() =>
    initialSession ? initialSession.hourlyRate.toFixed(2) : '3.50'
  );
  const [autoCalcTotal, setAutoCalcTotal] = useState(true);
  const [manualTotal, setManualTotal] = useState(() =>
    initialSession ? initialSession.totalCostDollars.toFixed(2) : '7.00'
  );
  const [notes, setNotes] = useState(() => initialSession?.notes || '');
  const [clearAllExamples, setClearAllExamples] = useState(() => !initialSession);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedHours = parseFloat(durationHours);
  const parsedRate = parseFloat(hourlyRate);
  const computedTotal =
    Number.isFinite(parsedHours) && Number.isFinite(parsedRate)
      ? Math.max(0, parsedHours * parsedRate)
      : 0;
  const effectiveTotal = autoCalcTotal ? computedTotal : parseFloat(manualTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedZone = zoneId.trim();
    if (!trimmedZone) {
      setError('Zone # or lot identifier is required.');
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 720) {
      setError('Duration must be between 0.1 and 720 hours.');
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 1000) {
      setError('Hourly rate must be between $0.00 and $1,000.00.');
      return;
    }
    if (!Number.isFinite(effectiveTotal) || effectiveTotal < 0 || effectiveTotal > 10000) {
      setError('Total paid must be between $0.00 and $10,000.00.');
      return;
    }

    const combinedTs = new Date(`${dateStr}T${timeStr || '12:00'}:00`).getTime();
    const startTime = Number.isFinite(combinedTs) && combinedTs > 0 ? combinedTs : Date.now();
    const now = Date.now();

    const session: ParkingSession = {
      id: isEditingExisting && initialSession ? initialSession.id : `session_${now}`,
      zoneId: trimmedZone.slice(0, 100),
      address: (address.trim() || `Calgary Zone #${trimmedZone}`).slice(0, 250),
      startTime,
      durationHours: Number(parsedHours.toFixed(2)),
      hourlyRate: Number(parsedRate.toFixed(2)),
      totalCostDollars: Number(effectiveTotal.toFixed(2)),
      expiryTime: startTime + Math.round(parsedHours * 3600 * 1000),
      alertLeadMinutes: initialSession?.alertLeadMinutes ?? 15,
      active: initialSession?.active ?? false,
      notes: notes.trim() ? notes.trim().slice(0, 1000) : undefined,
      createdAt: isEditingExisting && initialSession ? initialSession.createdAt : now,
      updatedAt: isEditingExisting ? now : undefined,
    };

    setSaving(true);
    try {
      await onSave({
        session,
        replaceExampleId: isReplacingExample && initialSession ? initialSession.id : undefined,
        clearAllExamples: hasRemainingExamples && clearAllExamples,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save parking transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>
                {isReplacingExample
                  ? 'Replace Example Transaction'
                  : isEditingExisting
                  ? 'Edit Parking Transaction'
                  : 'Log Real Parking Transaction'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isReplacingExample
                  ? 'Customize these fields to convert this example entry into a real CRA-exportable record.'
                  : 'Record a real Calgary parking receipt for expense tracking and tax export.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs py-1">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-2.5 text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-date">Date</Label>
              <Input
                id="tx-date"
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-time">Start Time</Label>
              <Input
                id="tx-time"
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-zone">Zone # / Lot</Label>
              <Input
                id="tx-zone"
                type="text"
                required
                placeholder="e.g. 1008"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tx-addr">Street / Address</Label>
              <Input
                id="tx-addr"
                type="text"
                placeholder="e.g. 8 Ave SW, Fr 5 St To 6 St"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="tx-hours">Duration (hrs)</Label>
              <Input
                id="tx-hours"
                type="number"
                step="0.25"
                min="0.1"
                max="720"
                required
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-rate">Hourly Rate ($)</Label>
              <Input
                id="tx-rate"
                type="number"
                step="0.25"
                min="0"
                max="1000"
                required
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-total">Total Paid ($)</Label>
              <Input
                id="tx-total"
                type="number"
                step="0.01"
                min="0"
                max="10000"
                disabled={autoCalcTotal}
                value={autoCalcTotal ? computedTotal.toFixed(2) : manualTotal}
                onChange={(e) => setManualTotal(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCalcTotal}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoCalcTotal(next);
                if (!next) {
                  setManualTotal(computedTotal.toFixed(2));
                }
              }}
              className="rounded border-border accent-emerald-600"
            />
            <span>Auto-calculate Total Paid (Duration × Hourly Rate)</span>
          </label>

          <div className="space-y-1">
            <Label htmlFor="tx-notes">Business / Trip Notes</Label>
            <Input
              id="tx-notes"
              type="text"
              placeholder="e.g. Client meeting downtown"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {hasRemainingExamples && !isEditingExisting && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={clearAllExamples}
                onChange={(e) => setClearAllExamples(e.target.checked)}
                className="rounded border-border accent-emerald-600"
              />
              <span>
                {isReplacingExample
                  ? 'Also clear all other example entries'
                  : 'Clear remaining example entries when saving this real transaction'}
              </span>
            </label>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" size="sm" disabled={saving}>
              {saving
                ? 'Saving...'
                : isReplacingExample
                ? 'Save as Real Transaction'
                : isEditingExisting
                ? 'Update Transaction'
                : 'Log Transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
