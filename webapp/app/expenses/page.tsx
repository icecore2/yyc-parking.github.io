'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/firebase/auth-context';
import { getUserParkingSessions } from '@/lib/firebase/firestore';
import { ParkingSession } from '@/lib/parking/types';
import { Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SAMPLE_EXPENSES: ParkingSession[] = [
  {
    id: 'exp_1',
    zoneId: '1008',
    address: 'Eau Claire Ave SW, Fr 4 St SW To 5 St SW',
    startTime: 1730700000000,
    durationHours: 2.5,
    hourlyRate: 3.5,
    totalCostDollars: 8.75,
    expiryTime: 1730709000000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Client meeting at Eau Claire',
  },
  {
    id: 'exp_2',
    zoneId: '1042',
    address: '8 Avenue SW (Stephen Ave), Fr 5 St SW To 6 St SW',
    startTime: 1730440800000,
    durationHours: 1.5,
    hourlyRate: 4.5,
    totalCostDollars: 6.75,
    expiryTime: 1730446200000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Lunch at Stephen Ave Walkway',
  },
  {
    id: 'exp_3',
    zoneId: '1210',
    address: '10 Avenue SW, Fr 1 St SW To 2 St SW',
    startTime: 1730181600000,
    durationHours: 3.0,
    hourlyRate: 2.5,
    totalCostDollars: 7.5,
    expiryTime: 1730192400000,
    alertLeadMinutes: 15,
    active: false,
    notes: 'Office day Beltline',
  },
];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ParkingSession[]>(SAMPLE_EXPENSES);

  useEffect(() => {
    const uid = user ? user.uid : 'demo_user';
    getUserParkingSessions(uid).then((items) => {
      if (items.length > 0) setSessions(items);
    });
  }, [user]);

  const totalSpent = sessions.reduce((acc, s) => acc + s.totalCostDollars, 0);
  const avgCost = sessions.length > 0 ? totalSpent / sessions.length : 0;

  const handleExportCSV = () => {
    const headers = ['Date', 'Zone ID', 'Address', 'Duration (Hours)', 'Hourly Rate ($)', 'Total Paid ($)', 'Notes'];
    const rows = sessions.map((s) => [
      new Date(s.startTime).toLocaleDateString(),
      s.zoneId,
      `"${s.address.replace(/"/g, '""')}"`,
      s.durationHours,
      s.hourlyRate.toFixed(2),
      s.totalCostDollars.toFixed(2),
      `"${(s.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `calgary_parking_expenses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2 p-0 h-auto text-xs gap-1.5 text-muted-foreground hover:text-foreground">
              <Link href="/account">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Account
              </Link>
            </Button>
            <div className="flex items-center gap-2">
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

          <Button
            onClick={handleExportCSV}
            variant="emerald"
            className="gap-2 shrink-0"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription className="text-xs font-medium">Total Parking Recorded</CardDescription>
              <CardTitle className="text-2xl font-black mt-1">
                ${totalSpent.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <span className="text-[11px] text-primary font-semibold">Eligible for business deduction</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription className="text-xs font-medium">Logged Sessions</CardDescription>
              <CardTitle className="text-2xl font-black mt-1">
                {sessions.length} Trips
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <span className="text-[11px] text-muted-foreground">Across Calgary Zones</span>
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
          <CardHeader className="p-4 bg-muted/30 border-b border-border flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold">Detailed Transaction History</CardTitle>
            <Badge variant="secondary" className="text-[11px]">
              Showing {sessions.length} entries
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 px-4">Date</TableHead>
                  <TableHead className="py-3 px-4">Zone / Address</TableHead>
                  <TableHead className="py-3 px-4">Duration</TableHead>
                  <TableHead className="py-3 px-4">Rate</TableHead>
                  <TableHead className="py-3 px-4 text-right">Total Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap py-3 px-4">
                      {new Date(s.startTime).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="font-semibold text-foreground">Zone #{s.zoneId}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-sm">
                        {s.address}
                      </div>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
