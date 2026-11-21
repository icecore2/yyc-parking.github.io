import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/firebase/auth-context';
import { WalkthroughProvider } from '@/components/onboarding/WalkthroughProvider';

export const metadata: Metadata = {
  title: 'Calgary Parking Map — On-Street Parking Zones, Live Rates & Anti-Tow Alerts',
  description:
    'Find the cheapest on-street parking spots in Calgary, avoid rush-hour towing traps, and compare ParkPlus, municipal parkades, and transit lots with live rate curves.',
  keywords: [
    'Calgary parking',
    'ParkPlus rates',
    'Calgary parking map',
    'downtown Calgary parking',
    'free parking Calgary',
    'cheap parking Calgary',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <WalkthroughProvider>
            {children}
          </WalkthroughProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
