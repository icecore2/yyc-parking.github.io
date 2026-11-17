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

const RE_TIME_RANGE = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*to\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;
const RE_DOUBLE_BR = /<br\s*\/?>\s*<br\s*\/?>/gi;
const RE_SINGLE_BR = /<br\s*\/?>/gi;
const RE_BOLD_TAGS = /<\/?b>/gi;
const RE_PRICE = /\$([0-9]+(?:\.[0-9]{2})?)/;
const RE_FREE = /free/i;

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

    const priceMatch = rateText.match(RE_PRICE);
    const isFree = RE_FREE.test(rateText) || RE_FREE.test(header);

    let price = 0;
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
      if (price > foundMaxRate) foundMaxRate = price;
    }

    let days = 'Mon-Fri';
    const hLower = header.toLowerCase();
    if (hLower.includes('saturday')) {
      days = 'Saturday';
    } else if (hLower.includes('sunday') || hLower.includes('holiday')) {
      days = 'Sunday';
    }

    const m = header.match(RE_TIME_RANGE);
    let startTime = '09:00';
    let endTime = '18:00';
    if (m) {
      let h1 = parseInt(m[1], 10);
      const min1 = m[2];
      if (m[3].toUpperCase() === 'PM' && h1 !== 12) h1 += 12;
      if (m[3].toUpperCase() === 'AM' && h1 === 12) h1 = 0;
      startTime = `${String(h1).padStart(2, '0')}:${min1}`;

      let h2 = parseInt(m[4], 10);
      const min2 = m[5];
      if (m[6].toUpperCase() === 'PM' && h2 !== 12) h2 += 12;
      if (m[6].toUpperCase() === 'AM' && h2 === 12) h2 = 0;
      endTime = `${String(h2).padStart(2, '0')}:${min2}`;
    }

    periods.push({
      days,
      startTime,
      endTime,
      ratePerHour: price,
      isFree: isFree || price === 0,
    });
  }

  return {
    activeRate: foundMaxRate,
    isCurrentlyFree: foundMaxRate === 0,
    periods: periods.length > 0 ? periods : [
      { days: 'Mon-Sat', startTime: '09:00', endTime: '18:00', ratePerHour: foundMaxRate }
    ],
  };
}
