'use client';

import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Sparkles, User as UserIcon, LogOut, Crown, Compass } from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { useWalkthrough } from '@/components/onboarding/WalkthroughProvider';
import AuthModal from './auth/AuthModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const emptySubscribe = () => () => {};

export default function Navbar() {
  const pathname = usePathname();
  const { user, profile, isPro, isAdmin, signOutUser, toggleDemoTier } = useAuth();
  const { onboardingState, progress, openWalkthrough } = useWalkthrough();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-base shadow-sm group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-foreground">Calgary Parking</span>
                <Badge variant="success" className="hidden sm:inline-flex text-[10px]">
                  Live Rates
                </Badge>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/' ? 'text-primary font-semibold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Home
            </Link>
            <Link
              href="/app"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/app' ? 'text-primary font-semibold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Interactive Map
            </Link>
            <Link
              href="/expenses"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/expenses' ? 'text-primary font-semibold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Expense Tracker
            </Link>
            <Link
              href="/pricing"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                pathname === '/pricing' ? 'text-primary font-semibold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pricing &amp; Pro
            </Link>
          </nav>

          {/* User Controls & Plan Pill */}
          <div className="flex items-center gap-2.5">
            {/* Setup Guide Progress Pill */}
            {mounted && (profile || user) && !onboardingState.walkthroughCompleted && !onboardingState.walkthroughDismissed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openWalkthrough()}
                title="Open New User Setup Guide"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 h-8 text-xs font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Setup {progress.completedCount}/{progress.totalCount}</span>
              </Button>
            )}

            {/* Quick Demo Tier Switcher Pill */}
            {mounted && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleDemoTier}
                title="Click to toggle between Free and Pro mode for testing"
                className={`hidden sm:flex items-center gap-1.5 rounded-full px-2.5 h-8 text-xs font-semibold ${
                  isPro
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'text-muted-foreground'
                }`}
              >
                {isPro ? (
                  <>
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>PRO Plan</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                    <span>Free Plan</span>
                  </>
                )}
                <span className="text-[10px] opacity-70 underline ml-0.5">switch</span>
              </Button>
            )}

            {/* Launch App Button (when on landing or pricing) */}
            {pathname !== '/app' && (
              <Button asChild variant="emerald" size="sm" className="hidden sm:inline-flex">
                <Link href="/app">
                  Launch Map
                </Link>
              </Button>
            )}

            {/* Auth Button or User Menu */}
            {mounted && (profile || user) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 h-8 px-2 rounded-lg">
                    <div className="w-5.5 h-5.5 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                      {(profile?.displayName || user?.displayName || user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-medium max-w-[100px] truncate hidden sm:inline">
                      {profile?.displayName || user?.displayName || user?.email?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="font-semibold text-foreground truncate">{profile?.displayName || user?.email}</p>
                    <p className="text-muted-foreground text-[11px] truncate">{profile?.email || user?.email}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge variant={isPro ? 'warning' : 'secondary'} className="text-[10px] font-bold">
                        {isAdmin ? 'ADMIN' : isPro ? '👑 PRO SUBSCRIBER' : 'FREE TIER'}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Account Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account#favorites" className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Saved Favorites</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openWalkthrough()} className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Setup Walkthrough ({progress.completedCount}/{progress.totalCount})</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/pricing" className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isPro ? 'Manage Subscription' : 'Upgrade to Pro'}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOutUser()}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuthModal(true)}
                className="gap-1.5 h-8 rounded-lg"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
