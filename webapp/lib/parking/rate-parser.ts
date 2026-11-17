import { HourlyRatePoint, RatePeriod } from './types';

export interface ParsedInterval {
  header: string;
  rateText: string;
  price: number | null;
  isFree: boolean;
  isNoParking: boolean;
  appliesDays: 'all' | 'weekday' | 'saturday' | 'sunday';
  timeRange: { start: number; end: number } | null;
}

// Pre-compiled regular expressions for maximum parsing throughput
const RE_TIME_RANGE = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const RE_DOUBLE_BR = /<br\s*\/?>\s*<br\s*\/?>/gi;
const RE_SINGLE_BR = /<br\s*\/?>/gi;
const RE_BOLD_TAGS = /<\/?b>/gi;
const RE_PRICE = /\$([0-9]+(?:\.[0-9]{2})?)/;
const RE_FREE = /free/i;
const RE_NO_PARKING = /no parking/i;

export function parseTimeRangeToMinutes(timeStr: string): { start: number; end: number } | null {
  const m = timeStr.match(RE_TIME_RANGE);
  if (!m) return null;

  let h1 = parseInt(m[1], 10);
  const min1 = parseInt(m[2], 10);
  const p1 = m[3].toUpperCase();
  if (p1 === 'PM' && h1 !== 12) h1 += 12;
  if (p1 === 'AM' && h1 === 12) h1 = 0;

  let h2 = parseInt(m[4], 10);
  const min2 = parseInt(m[5], 10);
  const p2 = m[6].toUpperCase();
  if (p2 === 'PM' && h2 !== 12) h2 += 12;
  if (p2 === 'AM' && h2 === 12) h2 = 0;

  return {
    start: h1 * 60 + min1,
    end: h2 * 60 + min2,
  };
}

export function parseRateSchedule(htmlRates: string | undefined | null): {
  minRate: number;
  maxRate: number;
  intervals: ParsedInterval[];
  periods: RatePeriod[];
} {
  if (!htmlRates || !htmlRates.trim()) {
    return { minRate: 0, maxRate: 0, intervals: [], periods: [] };
  }

  const clean = htmlRates
    .replace(RE_DOUBLE_BR, '\n')
    .replace(RE_SINGLE_BR, '\n')
    .replace(RE_BOLD_TAGS, '')
    .trim();

  const lines = clean.split('\n');
  const intervals: ParsedInterval[] = [];
  const periods: RatePeriod[] = [];
  const prices: number[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i]?.trim();
    if (!header) continue;
    const rateText = (lines[i + 1] || '').trim();

    const priceMatch = rateText.match(RE_PRICE);
    const isFree = RE_FREE.test(rateText) || RE_FREE.test(header);
    const isNoParking = RE_NO_PARKING.test(rateText) || RE_NO_PARKING.test(header);

    let price: number | null = null;
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      prices.push(price);
    } else if (isFree) {
      price = 0;
    }

    let appliesDays: 'all' | 'weekday' | 'saturday' | 'sunday' = 'all';
    const hLower = header.toLowerCase();
    if (hLower.includes('mon-fri') || hLower.includes('mon to fri')) {
      appliesDays = 'weekday';
    } else if (hLower.includes('saturday')) {
      appliesDays = 'saturday';
    } else if (hLower.includes('sunday') || hLower.includes('holiday')) {
      appliesDays = 'sunday';
    }

    const timeRange = parseTimeRangeToMinutes(header);

    intervals.push({
      header,
      rateText,
      price,
      isFree,
      isNoParking,
      appliesDays,
      timeRange,
    });

    if (price !== null || isFree) {
      periods.push({
        days: appliesDays === 'weekday' ? 'Mon-Fri' : appliesDays === 'saturday' ? 'Saturday' : appliesDays === 'sunday' ? 'Sunday' : 'Daily',
        startTime: timeRange ? `${String(Math.floor(timeRange.start / 60)).padStart(2, '0')}:${String(timeRange.start % 60).padStart(2, '0')}` : '09:00',
        endTime: timeRange ? `${String(Math.floor(timeRange.end / 60)).padStart(2, '0')}:${String(timeRange.end % 60).padStart(2, '0')}` : '18:00',
        ratePerHour: price || 0,
        isFree: isFree || price === 0,
      });
    }
  }

  const minRate = prices.length > 0 ? Math.min(...prices) : 0;
  const maxRate = prices.length > 0 ? Math.max(...prices) : 0;

  return { minRate, maxRate, intervals, periods };
}

export function getCurrentRate(intervals: ParsedInterval[], customDate = new Date()): {
  rate: number;
  isFree: boolean;
  statusText: string;
} {
  const day = customDate.getDay(); // 0 is Sun, 6 is Sat
  const minutes = customDate.getHours() * 60 + customDate.getMinutes();

  if (day === 0) {
    return { rate: 0, isFree: true, statusText: 'Free Parking (Sunday)' };
  }

  const dayType = day === 6 ? 'saturday' : 'weekday';

  for (const inv of intervals) {
    let dayMatch = false;
    if (inv.appliesDays === dayType || inv.appliesDays === 'all') {
      dayMatch = true;
    }

    if (dayMatch && inv.timeRange) {
      if (minutes >= inv.timeRange.start && minutes < inv.timeRange.end) {
        if (inv.isNoParking) {
          return { rate: 0, isFree: false, statusText: 'No Parking (Enforced Restriction)' };
        }
        if (inv.isFree || inv.price === 0) {
          return { rate: 0, isFree: true, statusText: 'Free Parking' };
        }
        if (inv.price !== null) {
          return { rate: inv.price, isFree: false, statusText: `$${inv.price.toFixed(2)}/hr` };
        }
      }
    }
  }

  return { rate: 0, isFree: true, statusText: 'Free Parking (Outside Enforced Hours)' };
}

export function generate24HourProfile(intervals: ParsedInterval[], dayType: 'weekday' | 'saturday' | 'sunday' = 'weekday'): HourlyRatePoint[] {
  const points: HourlyRatePoint[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const currentMin = hour * 60 + 30; // check mid-hour
    let rate = 0;
    let isEnforced = false;

    if (dayType !== 'sunday') {
      for (const inv of intervals) {
        let match = false;
        if (inv.appliesDays === dayType || inv.appliesDays === 'all') match = true;

        if (match && inv.timeRange && currentMin >= inv.timeRange.start && currentMin < inv.timeRange.end) {
          if (inv.price !== null && !inv.isFree) {
            rate = inv.price;
            isEnforced = true;
          }
          break;
        }
      }
    }

    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const label = `${hour12} ${ampm}`;

    points.push({
      hour,
      label,
      rate,
      isEnforced,
    });
  }

  return points;
}
