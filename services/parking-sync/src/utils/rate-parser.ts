import type { RatePeriod } from '../types.ts';

const FACTOR = 180 / 20037508.342789244;
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const PI_OVER_2 = Math.PI / 2;

export function toWgs84(x: number, y: number): [number, number] {
  if (Math.abs(x) > 180 || Math.abs(y) > 90) {
    const lng = x * FACTOR;
    const lat = RAD2DEG * (2 * Math.atan(Math.exp(y * FACTOR * DEG2RAD)) - PI_OVER_2);
    return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
  }
  return [Number(x.toFixed(6)), Number(y.toFixed(6))];
}

const RE_TIME_RANGE = /(\d{1,2}):(\d{2})\s*(AM|PM)?\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
const RE_DOUBLE_BR = /<br\s*\/?>\s*<br\s*\/?>/gi;
const RE_SINGLE_BR = /<br\s*\/?>/gi;
const RE_BOLD_TAGS = /<\/?b>/gi;
const RE_PRICE = /\$([0-9]+(?:\.[0-9]{2})?)/;
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

export function parseHtmlRates(htmlRates: string | undefined | null): {
  activeRate: number;
  isCurrentlyFree: boolean;
  periods: RatePeriod[];
} {
  if (!htmlRates || !htmlRates.trim()) {
    return {
      activeRate: 0,
      isCurrentlyFree: true,
      periods: [{ days: 'Daily', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true }],
    };
  }

  const clean = htmlRates
    .replace(RE_DOUBLE_BR, '\n')
    .replace(RE_SINGLE_BR, '\n')
    .replace(RE_BOLD_TAGS, '')
    .trim();

  const lines = clean.split('\n');
  const periods: RatePeriod[] = [];
  let foundMaxRate = 0;

  for (let i = 0; i < lines.length; i += 2) {
    const header = lines[i]?.trim();
    if (!header) continue;
    const rateText = (lines[i + 1] || '').trim();

    const { days, startTime, endTime } = parseRateHeader(header);
    const priceMatch = rateText.match(RE_PRICE);
    const isFreeText = RE_FREE.test(rateText);

    if (startTime && endTime && priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price > foundMaxRate) foundMaxRate = price;
      periods.push({ days: days ?? 'Daily', startTime, endTime, ratePerHour: price, isFree: price === 0 });
    } else if (startTime && endTime && isFreeText) {
      periods.push({ days: days ?? 'Daily', startTime, endTime, ratePerHour: 0, isFree: true });
    } else if (days === 'Sunday' && !startTime && isFreeText) {
      periods.push({ days: 'Sunday', startTime: '00:00', endTime: '23:59', ratePerHour: 0, isFree: true });
    }
  }

  return {
    activeRate: foundMaxRate,
    isCurrentlyFree: foundMaxRate === 0,
    periods,
  };
}
