'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ExampleDataBanner, { ExampleBadge } from '@/components/onboarding/ExampleDataBanner';
import TransactionFormDialog from '@/components/expenses/TransactionFormDialog';
import { useWalkthrough } from '@/components/onboarding/WalkthroughProvider';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  deleteParkingSession,
  dismissExamplesForUser,
  restoreExamplesForUser,
  saveParkingSession,
  updateParkingSession,
} from '@/lib/firebase/firestore';
import {
  EXAMPLE_IDS_BY_SECTION,
  buildExpenseCsvContent,
  getRealItems,
} from '@/lib/parking/example-data';
import { ParkingSession } from '@/lib/parking/types';
import {
  ArrowLeft,
  Compass,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ExpensesPage() {
  const { user, profile } = useAuth();
  const { sessions, openWalkthrough, refreshData } = useWalkthrough();
  const uid = user?.uid || profile?.uid || 'demo_user';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ParkingSession | null>(null);
  const [dialogDefaultTs, setDialogDefaultTs] = useState<number>(1730700000000);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const realSessions = getRealItems(sessions);
  const exampleSessions = sessions.filter((s) => Boolean(s.isExample));
  const showingExamplePreviewOnly = realSessions.length === 0 && exampleSessions.length > 0;

  const metricSource = realSessions.length > 0 ? realSessions : exampleSessions;
  const totalSpent = metricSource.reduce((acc, s) => acc + s.totalCostDollars, 0);
  const avgCost = metricSource.length > 0 ? totalSpent / metricSource.length : 0;

  const openAddDialog = () => {
    setExportNotice(null);
    setEditingSession(null);
    setDialogDefaultTs(Date.now());
    setDialogOpen(true);
  };

  const openEditDialog = (session: ParkingSession) => {
    setExportNotice(null);
    setEditingSession(session);
    setDialogDefaultTs(session.startTime);
    setDialogOpen(true);
  };

  const handleSaveTransaction = async (payload: {
    session: ParkingSession;
    replaceExampleId?: string;
    clearAllExamples?: boolean;
  }) => {
    if (editingSession && !editingSession.isExample) {
      await updateParkingSession(uid, payload.session);
    } else {
      await saveParkingSession(uid, payload.session);
    }

    if (payload.clearAllExamples) {
      await dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.sessions]);
    } else if (payload.replaceExampleId) {
      await dismissExamplesForUser(uid, [payload.replaceExampleId]);
    }

    await refreshData();
  };

  const handleDeleteRow = async (s: ParkingSession) => {
    setExportNotice(null);
    if (s.isExample) {
      await dismissExamplesForUser(uid, [s.id]);
    } else {
      await deleteParkingSession(uid, s.id);
    }
    await refreshData();
  };

  const downloadCsv = (csvBody: string, suffix: string) => {
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvBody);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `calgary_parking_expenses_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSV = () => {
    const result = buildExpenseCsvContent(sessions, { includeExamples: false });
    if (result.exportedCount === 0) {
      setExportNotice(
        'No real parking transactions recorded yet — example rows are excluded from CRA tax CSV exports. Log a real transaction or click "Replace" on an example row first.'
      );
      return;
    }
    setExportNotice(
      result.skippedExampleCount > 0
        ? `Exported ${result.exportedCount} real transaction${result.skippedExampleCount > 0 ? ` (${result.skippedExampleCount} example row(s) excluded)` : ''}.`
        : null
    );
    downloadCsv(result.csv, 'real');
  };

  const handleExportPreviewCSV = () => {
    const result = buildExpenseCsvContent(sessions, { includeExamples: true });
    setExportNotice('Downloaded CSV preview including example entries (not for official tax filing).');
    downloadCsv(result.csv, 'example_preview');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mb-2 p-0 h-auto text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Link href="/account">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Account
              </Link>
            </Button>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Parking Expense Log &amp; Tax Export
              </h1>
              <Badge variant="warning" className="text-[10px] font-bold">
                PRO FEATURE
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Track business parking expenditures and generate compliant CSV receipts for CRA tax deductions or employer reimbursement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openWalkthrough('expenses')}
              className="gap-1.5 text-xs h-8"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-500" />
              Setup Guide
            </Button>
            <Button
              type="button"
              onClick={openAddDialog}
              variant="default"
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              <Plus className="w-4 h-4" />
              Log Transaction
            </Button>
            <Button
              type="button"
              onClick={handleExportCSV}
              variant="emerald"
              size="sm"
              className="gap-2 text-xs h-8"
            >
              <Download className="w-4 h-4" />
              Export to CSV
            </Button>
          </div>
        </div>

        {/* Example Data Banner */}
        <ExampleDataBanner
          sectionLabel="transaction"
          exampleCount={exampleSessions.length}
          primaryActionLabel="Log Real Transaction"
          onPrimaryAction={openAddDialog}
          onClearExamples={() => dismissExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.sessions])}
        />

        {exportNotice && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-foreground font-medium">{exportNotice}</span>
            {realSessions.length === 0 && exampleSessions.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="outline" size="sm" onClick={handleExportPreviewCSV} className="h-7 text-[11px]">
                  Download Example Preview CSV
                </Button>
                <Button type="button" variant="emerald" size="sm" onClick={openAddDialog} className="h-7 text-[11px]">
                  Log Real Transaction
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-5 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium">
                  {showingExamplePreviewOnly ? 'Example Total Recorded' : 'Total Parking Recorded'}
                </CardDescription>
                {showingExamplePreviewOnly && <ExampleBadge label="Example Preview" />}
              </div>
              <CardTitle className="text-2xl font-black mt-1">
                ${totalSpent.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <span className="text-[11px] text-primary font-semibold">
                {showingExamplePreviewOnly
                  ? 'Replace or log real trips for CRA deduction totals'
                  : 'Eligible for business deduction'}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription className="text-xs font-medium">
                {showingExamplePreviewOnly ? 'Example Preview Trips' : 'Logged Real Sessions'}
              </CardDescription>
              <CardTitle className="text-2xl font-black mt-1">
                {metricSource.length} {metricSource.length === 1 ? 'Trip' : 'Trips'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <span className="text-[11px] text-muted-foreground">
                {realSessions.length > 0 && exampleSessions.length > 0
                  ? `${exampleSessions.length} example row(s) excluded from metrics & CSV`
                  : 'Across Calgary Zones'}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription className="text-xs font-medium">Average Trip Cost</CardDescription>
              <CardTitle className="text-2xl font-black mt-1">
                ${avgCost.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <span className="text-[11px] text-muted-foreground">Per parking session</span>
            </CardContent>
          </Card>
        </div>

        {/* Table of Sessions */}
        <Card className="overflow-hidden">
          <CardHeader className="p-4 bg-muted/30 border-b border-border flex flex-row items-center justify-between space-y-0 gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xs font-bold">Detailed Transaction History</CardTitle>
              {exampleSessions.length > 0 && (
                <ExampleBadge label={`${exampleSessions.length} Example`} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {sessions.length === 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void restoreExamplesForUser(uid, [...EXAMPLE_IDS_BY_SECTION.sessions])}
                  className="h-7 text-[11px] gap-1 text-muted-foreground"
                >
                  <RotateCcw className="w-3 h-3" />
                  Load Examples
                </Button>
              )}
              <Badge variant="secondary" className="text-[11px]">
                Showing {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sessions.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm font-semibold text-foreground">No parking transactions recorded yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Start tracking your Calgary parking receipts by logging a transaction manually or setting a parking alarm on the map.
                </p>
                <Button type="button" variant="emerald" size="sm" onClick={openAddDialog} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Log First Transaction
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-3 px-4">Date</TableHead>
                    <TableHead className="py-3 px-4">Zone / Address</TableHead>
                    <TableHead className="py-3 px-4">Duration</TableHead>
                    <TableHead className="py-3 px-4">Rate</TableHead>
                    <TableHead className="py-3 px-4 text-right">Total Paid</TableHead>
                    <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow
                      key={s.id}
                      className={s.isExample ? 'bg-amber-500/5 hover:bg-amber-500/10' : undefined}
                    >
                      <TableCell className="text-muted-foreground whitespace-nowrap py-3 px-4">
                        <div>{new Date(s.startTime).toLocaleDateString()}</div>
                        {s.isExample && (
                          <div className="mt-1">
                            <ExampleBadge label="Example" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <div className="font-semibold text-foreground">Zone #{s.zoneId}</div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-sm">
                          {s.address}
                        </div>
                        {s.notes && (
                          <div className="text-[11px] text-muted-foreground/80 italic truncate max-w-sm">
                            {s.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap py-3 px-4">
                        {s.durationHours} hrs
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap py-3 px-4">
                        ${s.hourlyRate.toFixed(2)}/hr
                      </TableCell>
                      <TableCell className="font-bold text-primary text-right whitespace-nowrap py-3 px-4">
                        ${s.totalCostDollars.toFixed(2)}
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(s)}
                            className="h-7 px-2 text-xs gap-1"
                            title={s.isExample ? 'Replace with real transaction' : 'Edit transaction'}
                          >
                            <Pencil className="w-3 h-3" />
                            <span>{s.isExample ? 'Replace' : 'Edit'}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="iconSm"
                            onClick={() => void handleDeleteRow(s)}
                            title={s.isExample ? 'Dismiss example row' : 'Delete transaction'}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />

      {dialogOpen && (
        <TransactionFormDialog
          key={editingSession ? editingSession.id : 'new'}
          isOpen={dialogOpen}
          initialSession={editingSession}
          defaultStartTime={dialogDefaultTs}
          hasRemainingExamples={exampleSessions.length > 0}
          onClose={() => setDialogOpen(false)}
          onSave={handleSaveTransaction}
        />
      )}
    </div>
  );
}
