'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  X,
  RefreshCw,
  Moon,
  Sun,
  Activity,
  Crown,
  User as UserIcon,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import AuthModal from '@/components/auth/AuthModal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OriginalHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBrz: string;
  onBrzChange: (brz: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSettings: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const BRZ_OPTIONS = [
  { value: 'ALL', label: 'All Areas (BRZs)' },
  { value: 'Downtown', label: 'Downtown Core' },
  { value: 'Beltline', label: 'Beltline' },
  { value: '17th Ave', label: '17th Avenue SW' },
  { value: 'Kensington', label: 'Kensington' },
  { value: 'Inglewood', label: 'Inglewood' },
  { value: 'East Village', label: 'East Village' },
  { value: 'Chinatown', label: 'Chinatown' },
  { value: '4th Street', label: '4th Street SW' },
  { value: 'Bridgeland', label: 'Bridgeland' },
];

export default function OriginalHeader({
  searchQuery,
  onSearchChange,
  selectedBrz,
  onBrzChange,
  onRefresh,
  isRefreshing,
  onOpenSettings,
  theme,
  onToggleTheme,
}: OriginalHeaderProps) {
  const { user, profile, isPro, signOutUser, toggleDemoTier } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-3">
        {/* Brand Title (Authentic P badge + Calgary Parking Map + Live Rates) */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-sm group-hover:scale-105 transition-transform">
            P
          </div>
          <div className="hidden sm:flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Calgary Parking Map
              </span>
              <Badge variant="secondary" className="text-[10px]">
                Live Rates
              </Badge>
            </div>
          </div>
        </Link>

        {/* Search Bar & Area Select */}
        <div className="flex flex-1 items-center gap-2 max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search zone # or street (e.g. 1008, 10 St)..."
              className="pl-8 pr-12 h-9"
              autoComplete="off"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => onSearchChange('')}
                className="absolute right-7 top-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <kbd className="pointer-events-none absolute right-2.5 top-2.5 hidden h-4 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </div>

          {/* Area (BRZ) Filter Select */}
          <div className="hidden md:block w-44">
            <Select value={selectedBrz} onValueChange={onBrzChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select Area" />
              </SelectTrigger>
              <SelectContent>
                {BRZ_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Demo Tier Switcher Pill */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDemoTier}
            title="Click to toggle between Free and Pro mode for testing"
            className={`hidden lg:flex items-center gap-1.5 rounded-full px-2.5 h-8 text-xs font-semibold ${
              isPro
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                : 'text-muted-foreground'
            }`}
          >
            {isPro ? (
              <>
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>PRO</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Free</span>
              </>
            )}
          </Button>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className={`group h-8 sm:h-9 px-2.5 sm:px-3 text-xs transition-all duration-200 disabled:pointer-events-none disabled:opacity-65 disabled:cursor-not-allowed ${
              isRefreshing ? 'ring-2 ring-primary/40 animate-pulse' : ''
            }`}
            title="Fetch latest information from Calgary Parking Authority"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 transition-transform duration-500 ${
                isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'
              }`}
            />
            <span className="hidden sm:inline">
              {isRefreshing ? 'Refreshing...' : 'Get Latest Info'}
            </span>
          </Button>

          {/* Dark / Light Mode Toggle */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 sm:h-9 sm:w-9"
            title="Toggle Dark / Light Mode"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* API & Data Feed Status Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenSettings}
            className="relative h-8 w-8 sm:h-9 sm:w-9"
            title="Data Feeds & API Status"
          >
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </Button>

          {/* User Account / Pro Dropdown Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="iconSm" className="h-8 w-8 rounded-xl p-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-[10px]">
                    {profile?.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="font-semibold text-foreground truncate">
                    {profile?.displayName || 'Calgary Commuter'}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
                  <div className="mt-1 flex items-center gap-1">
                    <Badge variant={isPro ? 'warning' : 'secondary'} className="text-[9px] font-bold">
                      {isPro ? 'PRO SUBSCRIBER' : 'FREE TIER'}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5" />
                    <span>My Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/expenses" className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Parking Tracker</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/pricing" className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Pricing Plans</span>
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
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowAuthModal(true)}
              className="h-8 w-8 sm:h-9 sm:w-9"
              title="Sign in / Account"
            >
              <UserIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
