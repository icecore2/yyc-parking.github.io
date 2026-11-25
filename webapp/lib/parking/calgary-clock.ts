/**
 * Calgary wall-clock helpers for the landing page's live statement.
 *
 * The verdict is a city-wide summary of typical downtown ParkPlus rules
 * (paid 9 AM–6 PM Mon–Sat, free Sundays, weekday rush-hour no-stopping
 * windows 7–9 AM and 3:30–6 PM). It is deliberately phrased as "most"
 * street parking; individual zones are resolved by the rate parser on the map.
 *
 * Kept dependency-free and type-strippable so test/test_calgary_clock.js
 * can import it directly with `node --experimental-strip-types`.
 */

export type CalgaryTime = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  hour: number;
  minute: number;
};

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const calgaryFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Edmonton',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

export function getCalgaryTime(date: Date = new Date()): CalgaryTime {
  const parts = calgaryFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  return {
    day: WEEKDAYS[get('weekday')] ?? 1,
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

function formatHour(hour: number, minute = 0): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${h12}:${String(minute).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export function formatClock(t: CalgaryTime): string {
  const suffix = t.hour >= 12 ? 'PM' : 'AM';
  const h12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  return `${h12}:${String(t.minute).padStart(2, '0')} ${suffix}`;
}

export function skyPhase(t: CalgaryTime): SkyPhase {
  if (t.hour >= 5 && t.hour < 8) return 'dawn';
  if (t.hour >= 8 && t.hour < 17) return 'day';
  if (t.hour >= 17 && t.hour < 20) return 'dusk';
  return 'night';
}

const PAID_START = 9;
const PAID_END = 18;
const RUSH_WINDOWS = [
  { start: 7, end: 9 },
  { start: 15.5, end: 18 },
];

export function downtownVerdict(t: CalgaryTime): string {
  const time = t.hour + t.minute / 60;
  const isWeekday = t.day >= 1 && t.day <= 5;
  const isPaidDay = t.day >= 1 && t.day <= 6;

  if (isWeekday) {
    const rush = RUSH_WINDOWS.find((w) => time >= w.start && time < w.end);
    if (rush) {
      return `Rush-hour tow zones are in effect downtown until ${formatHour(Math.floor(rush.end), (rush.end % 1) * 60)}.`;
    }
  }

  if (isPaidDay && time >= PAID_START && time < PAID_END) {
    return t.day === 6
      ? `Downtown street parking is paid until ${formatHour(PAID_END)}, at lower Saturday rates.`
      : `Downtown street parking is paid until ${formatHour(PAID_END)}. Rates drop to free after that.`;
  }

  if (isPaidDay && time < PAID_START) {
    return isWeekday
      ? `Most street parking downtown is free until ${formatHour(PAID_START)}. Rush-hour tow zones start at 7 AM.`
      : `Most street parking downtown is free until ${formatHour(PAID_START)}.`;
  }

  // Evenings and Sundays: find the next paid morning.
  const nextPaid = t.day === 6 || t.day === 0 ? 'Monday' : 'tomorrow';
  return `Most street parking downtown is free until ${nextPaid} at ${formatHour(PAID_START)}.`;
}
