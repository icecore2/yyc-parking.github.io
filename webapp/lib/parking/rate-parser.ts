import type { RatePeriod } from './types';

// Webapp copy of services/parking-sync/src/utils/rate-parser.ts (parseRateHeader +
// keep/drop rules). Keep the two in step, as CLAUDE.md's per-platform rule requires.

const RE_TIME_RANGE = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
const RE_DOUBLE_BR = /<br\s*\/?>\s*<br\s*\/?>/gi;
const RE_SINGLE_BR = /<br\s*\/?>/gi;
const RE_BOLD_TAGS = /<\/?b>/gi;
// "$1.00", "$.50", "$$1.00", or a bare "1.00" when followed by "per"/"each".
const RE_PRICE = /\$(\d+(?:\.\d{2})?|\d*\.\d+)/;
const RE_BARE_PRICE = /(?:^|[^\d.$])(\d+(?:\.\d{2})?|\d*\.\d+)(?=\s*(?:per|each)\b)/i;
// Unit right after the price: "per 30 Min", "each 15 Min", "per 1/2 hour", "per half hour".
const RE_PER_MINUTES = /^\s*(?:per|each)\s+(\d+)\s*min(?:s|utes?)?\b/i;
const RE_PER_HALF_HOUR = /^\s*(?:per|each)\s+(?:1\/2|half)\s*(?:an?\s+)?h(?:ou)?r/i;
const RE_FREE = /free/i;

// First matching rule wins. Daily is checked before Saturday/Sunday so that
// "Mon-Sun" is not read as Sunday.
const DAY_RULES: Array<[RegExp, string]> = [
  [/\bmon(?:-|\s+to\s+)sat\b/i, 'Mon-Sat'],
  [/\bmon(?:-|\s+to\s+)thu\b/i, 'Mon-Thu'],
  [/\b(?:mon(?:-|\s+to\s+)fri|weekdays?)\b/i, 'Mon-Fri'],
  [/\b(?:daily|mon-sun|everyday)\b/i, 'Daily'],
  [/\b(?:sat|saturday)\b/i, 'Saturday'],
  [/\b(?:sun|sunday|holiday)/i, 'Sunday'],
  [/\b(?:fri|friday)\b/i, 'Fri'],
];

function to24h(hour: string, minute: string, meridiem: string | undefined): string {
  let h = parseInt(hour, 10);
  const mer = meridiem?.toUpperCase();
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

/**
 * Hourly price in a rate value, or null when it carries no price.
 * Per-sub-hour prices ("$2.00 each 30 Min", "$0.50 per 1/2 hour") are scaled to per-hour.
 */
export function extractHourlyPrice(rateText: string): number | null {
  let m = rateText.match(RE_PRICE);
  let priceEnd: number;
  if (m && m.index !== undefined) {
    priceEnd = m.index + m[0].length;
  } else {
    m = rateText.match(RE_BARE_PRICE);
    if (!m || m.index === undefined) return null;
    priceEnd = m.index + m[0].length;
  }
  let price = parseFloat(m[1]);
  if (!Number.isFinite(price)) return null;
  const rest = rateText.slice(priceEnd);
  const perMin = rest.match(RE_PER_MINUTES);
  if (perMin && parseInt(perMin[1], 10) > 0) {
    price = price * (60 / parseInt(perMin[1], 10));
  } else if (RE_PER_HALF_HOUR.test(rest)) {
    price = price * 2;
  }
  return Math.round(price * 100) / 100;
}

const WEEKDAY_TOKENS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Weekdays (0 = Sunday) covered by each parsed `days` label.
const DAY_LABEL_SETS: Record<string, number[]> = {
  'Mon-Fri': [1, 2, 3, 4, 5],
  'Mon-Sat': [1, 2, 3, 4, 5, 6],
  'Mon-Thu': [1, 2, 3, 4],
  Fri: [5],
  Saturday: [6],
  Sunday: [0],
  Daily: [0, 1, 2, 3, 4, 5, 6],
};

function tokenDays(from: string, to: string | undefined): number[] {
  const a = WEEKDAY_TOKENS.indexOf(from.toUpperCase());
  const b = to ? WEEKDAY_TOKENS.indexOf(to.toUpperCase()) : a;
  if (a < 0 || b < 0) return [];
  const out: number[] = [];
  for (let d = a; ; d = (d + 1) % 7) {
    out.push(d);
    if (d === b || out.length > 7) break;
  }
  return out;
}

const RE_ENFORCE_SEGMENT = /(\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})\s+([A-Za-z]{3})(?:\s*-\s*([A-Za-z]{3}))?/;

/**
 * Paid window for a day-only rate header, taken from ENFORCEABLE_TIME
 * (e.g. "1110-1520 MON-FRI, 0910-1750 SAT"). Uses the first segment whose day token
 * covers `days`, else the first segment, else 09:00-18:00.
 */
export function enforceableWindowFor(
  enforceableTime: string | undefined | null,
  days: string
): { startTime: string; endTime: string } {
  const segments = String(enforceableTime ?? '')
    .split(',')
    .map((seg) => seg.trim().match(RE_ENFORCE_SEGMENT))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      startTime: `${m[1]}:${m[2]}`,
      endTime: `${m[3]}:${m[4]}`,
      covered: tokenDays(m[5], m[6]),
    }));
  if (segments.length === 0) return { startTime: '09:00', endTime: '18:00' };
  const wanted = DAY_LABEL_SETS[days] ?? [];
  const match = segments.find((seg) => wanted.length > 0 && wanted.every((d) => seg.covered.includes(d))) ?? segments[0];
  return { startTime: match.startTime, endTime: match.endTime };
}

export function parseRateHeader(header: string): {
  days: string | null;
  startTime: string | null;
  endTime: string | null;
} {
  const days = DAY_RULES.find(([re]) => re.test(header))?.[1] ?? null;
  const m = header.match(RE_TIME_RANGE);
  return {
    days,
    startTime: m ? to24h(m[1], m[2], m[3]) : null,
    endTime: m ? to24h(m[4], m[5], m[6]) : null,
  };
}

/**
 * Parse a ParkPlus HTML_ZONE_RATE string into rate periods.
 * Headers without a time range are dropped, except a free "Sunday/Holidays" header,
 * which becomes an all-day free Sunday period, and a priced day-only header, whose
 * window comes from `enforceableTime` (the zone's ENFORCEABLE_TIME).
 */
export function parseRateSchedule(
  htmlRates: string | undefined | null,
  enforceableTime?: string
): {
  minRate: number;
  maxRate: number;
  periods: RatePeriod[];
} {
  if (!htmlRates || !htmlRates.trim()) {
    return { minRate: 0, maxRate: 0, periods: [] };
  }

  const clean = htmlRates
    .replace(RE_DOUBLE_BR, '\n')
    .replace(RE_SINGLE_BR, '\n')
    .replace(RE_BOLD_TAGS, '')
    .trim();

  const lines = clean.split('\n');
  const periods: RatePeriod[] = [];
  const prices: number[] = [];

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i]?.trim();
    if (!header) continue;
    const rateText = (lines[i + 1] || '').trim();

    const { days, startTime, endTime } = parseRateHeader(header);
    const price = extractHourlyPrice(rateText);
    const isFreeText = RE_FREE.test(rateText);

    if (startTime && endTime && price !== null) {
      prices.push(price);
      periods.push({ days: days ?? 'Daily', startTime, endTime, ratePerHour: price, isFree: price === 0 });
    } else if (startTime && endTime && isFreeText) {
      periods.push({ days: days ?? 'Daily', startTime, endTime, ratePerHour: 0, isFree: true });
    } else if (days !== null && !startTime && price !== null) {
      // Day-only header with a price ("Weekdays: Max 9 Hours" -> "$1.25 per hour"):
      // the paid window comes from the zone's ENFORCEABLE_TIME.
      const paidWindow = enforceableWindowFor(enforceableTime, days);
      prices.push(price);
      periods.push({ days, ...paidWindow, ratePerHour: price, isFree: price === 0 });
    } else if (days === 'Sunday' && !startTime && isFreeText) {
      periods.push({ days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true });
    }
  }

  const minRate = prices.length > 0 ? Math.min(...prices) : 0;
  const maxRate = prices.length > 0 ? Math.max(...prices) : 0;

  return { minRate, maxRate, periods };
}
