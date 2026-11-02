// Date-only helpers shared by the second-brain pages. The backend works in Europe/Prague and sends days as
// YYYY-MM-DD; arithmetic runs in UTC so it never depends on the browser's time zone.

const pragueDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' });

/** Today in Europe/Prague, YYYY-MM-DD. */
export function todayPrague(): string {
  return pragueDay.format(new Date());
}

const utc = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00Z`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number): string {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

/** Monday of the ISO week containing `day`. */
export function mondayOf(day: string): string {
  return addDays(day, -((utc(day).getUTCDay() + 6) % 7));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000);
}

/** "2/11/2026" from "2026-11-02", without a time-zone shift. */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '';
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return y && m && d ? `${d}/${m}/${y}` : day;
}
