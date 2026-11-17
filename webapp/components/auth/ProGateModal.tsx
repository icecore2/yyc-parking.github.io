'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Crown, ArrowRight, Zap } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ProGateModalProps {
  featureName: string;
  description: string;
  onClose: () => void;
}

export default function ProGateModal({ featureName, description, onClose }: ProGateModalProps) {
  const { upgradeToProDemo } = useAuth();

  const handleInstantUnlockDemo = () => {
    upgradeToProDemo();
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="warning" className="gap-1.5 px-3 py-1 text-xs">
              <Crown className="w-3.5 h-3.5" />
              PRO FEATURE
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            Unlock {featureName}
          </DialogTitle>
          <DialogDescription className="text-sm mt-2 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Benefits list */}
        <Card className="my-2 bg-muted/40">
          <CardContent className="p-4 space-y-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground font-medium">Smart Destination Cheapest-Spot Optimizer</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground font-medium">Rush-Hour Anti-Tow &amp; Meter Expiry Push Alarms</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground font-medium">Cloud Favorites Sync Across Unlimited Devices</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-foreground font-medium">Auto Expense Tracking &amp; CRA-Compliant CSV Reports</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button asChild variant="emerald" className="w-full h-11 text-xs font-bold shadow-md">
            <Link href="/pricing" onClick={onClose}>
              <span>View Pricing Plans (From $3.99/mo)</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>

          {/* Quick Demo Unlock Button */}
          <Button
            type="button"
            variant="ghost"
            onClick={handleInstantUnlockDemo}
            className="w-full text-xs text-amber-600 dark:text-amber-400 font-semibold gap-1.5 hover:bg-amber-500/10"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Instant Demo Unlock (No Payment Needed for Review)</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
