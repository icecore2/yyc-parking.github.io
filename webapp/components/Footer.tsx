import React from 'react';
import Link from 'next/link';
import { Shield, ExternalLink, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card text-muted-foreground text-xs py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs">
                P
              </div>
              <span className="font-bold text-sm text-foreground">Calgary Parking Map</span>
            </div>
            <p className="leading-relaxed">
              Real-time on-street parking rates, enforceable hours, municipal parkades, and rush-hour anti-tow protection across Calgary, Alberta.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live ArcGIS Data Synced
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Explore</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/app" className="hover:text-foreground transition-colors">
                  Interactive Live Map
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing &amp; Pro Plan
                </Link>
              </li>
              <li>
                <Link href="/app?brz=Downtown" className="hover:text-foreground transition-colors">
                  Downtown Core Parking
                </Link>
              </li>
              <li>
                <Link href="/app?brz=17th+Ave" className="hover:text-foreground transition-colors">
                  17th Ave Entertainment District
                </Link>
              </li>
              <li>
                <Link href="/app?brz=Kensington" className="hover:text-foreground transition-colors">
                  Kensington Village
                </Link>
              </li>
            </ul>
          </div>

          {/* Operators & Partners */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Parking Providers</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.calgaryparking.com/parkplus"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  ParkPlus (MyParking) <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.calgaryparking.com/find-parking/lots.html"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  City Lots &amp; Parkades <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.calgarytransit.com/park-and-ride/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Calgary Transit Park &amp; Ride <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://hangtag.io"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Impark / hangTag <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Data & Legal */}
          <div>
            <h4 className="font-semibold text-foreground text-sm mb-3">Open Data &amp; Legal</h4>
            <p className="leading-relaxed mb-3">
              Powered by City of Calgary ArcGIS Open Data and Calgary Parking Authority. Not officially affiliated with or endorsed by the City of Calgary.
            </p>
            <div className="flex items-center gap-2 text-foreground font-medium text-[11px]">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Free to use • Pro features available</span>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© 2026 Calgary Parking Map. Built for Calgary commuters &amp; visitors.</p>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> in Calgary, AB
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
