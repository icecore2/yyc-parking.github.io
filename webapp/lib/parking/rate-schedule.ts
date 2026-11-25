import type { RatePeriod, HourlyRatePoint } from './types';
import type { CalgaryTime } from './calgary-clock';

const DAY_SETS: Record<string, number[]> = {
  'Mon-Fri': [1, 2, 3, 4, 5],
  'Mon-Sat': [1, 2, 3, 4, 5, 6],
  'Mon-Thu': [1, 2, 3, 4],
  Fri: [5],
  Saturday: [6],
  Sunday: [0],
  Weekend: [0, 6],
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function endMinutes(hhmm: string): number {
  return hhmm === '23:59' ? 1440 : toMinutes(hhmm);
}

/** Whether a rate period is in force at the given Calgary weekday and time. */
export function periodAppliesAt(period: RatePeriod, t: CalgaryTime): boolean {
  const minutes = t.hour * 60 + t.minute;
  const start = toMinutes(period.startTime);
  const end = endMinutes(period.endTime);

  if (period.days === 'Evening & Weekend' && (t.day === 0 || t.day === 6)) return true;

  const days = DAY_SETS[period.days];
  if (days && !days.includes(t.day)) return false;

  return end <= start ? minutes >= start || minutes < end : minutes >= start && minutes < end;
}

const isPaid = (p: RatePeriod) => !p.isFree && p.ratePerHour > 0;

export function resolveRateAt(
  schedule: RatePeriod[] | undefined,
  t: CalgaryTime
): { rate: number; isFree: boolean; period: RatePeriod | null; statusText: string } {
  const applying = (schedule ?? []).filter((p) => periodAppliesAt(p, t));
  const paid = applying.find(isPaid);
  if (paid) {
    return { rate: paid.ratePerHour, isFree: false, period: paid, statusText: `$${paid.ratePerHour.toFixed(2)}/hr` };
  }
  if (applying.length > 0) {
    return { rate: 0, isFree: true, period: applying[0], statusText: 'Free parking' };
  }
  return { rate: 0, isFree: true, period: null, statusText: 'Free (outside paid hours)' };
}

export function buildDayProfile(schedule: RatePeriod[] | undefined, day: number): HourlyRatePoint[] {
  const points: HourlyRatePoint[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const { rate } = resolveRateAt(schedule, { day, hour, minute: 30 });
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    points.push({ hour, label: `${hour12} ${hour < 12 ? 'AM' : 'PM'}`, rate, isEnforced: rate > 0 });
  }
  return points;
}

export function summarizeSchedule(schedule: RatePeriod[] | undefined): { peakRate: number; minPaidRate: number } {
  const rates = (schedule ?? []).filter(isPaid).map((p) => p.ratePerHour);
  if (rates.length === 0) return { peakRate: 0, minPaidRate: 0 };
  return { peakRate: Math.max(...rates), minPaidRate: Math.min(...rates) };
}
