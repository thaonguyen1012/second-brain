// Labels and formatting for Công việc (projects and time). Dates are YYYY-MM-DD strings in Europe/Prague,
// the backend's timezone, so "today" and week boundaries match /api/time-entries/summary.
import type { ApiBilling } from '@/lib/api/work';
import { addDays } from '@/lib/dates';
import { fieldErrors as sharedFieldErrors, unpadded } from '@/lib/labels';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

export const billingChoices: { value: ApiBilling; label: Msg }[] = [
  { value: 'hourly', label: msg('Theo giờ') },
  { value: 'fixed', label: msg('Trọn gói') },
];
export const billingLabel = (b: string): Msg => billingChoices.find((c) => c.value === b)?.label ?? msg(b);

/** 90 -> "1 giờ 30 phút" / "1 h 30 min", 45 -> "45 phút", 120 -> "2 giờ". */
export function formatMinutes(minutes: number | null | undefined, t: T): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return t('{m} phút', { m: r });
  return r ? t('{h} giờ {m} phút', { h, m: r }) : t('{h} giờ', { h });
}

/**
 * Exact compact hours for totals and chart labels: 91 -> "1 giờ 31" / "1:31 h", 60 -> "1 giờ", 45 -> "45 phút".
 * Never rounded, so tiles, the entry list ("1 giờ 31 phút") and the Tuần review ("1h31") agree.
 */
export function formatHours(minutes: number | null | undefined, t: T): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return t('{m} phút', { m: r });
  return r ? t('{h} giờ {mm}', { h, mm: String(r).padStart(2, '0') }) : t('{h} giờ', { h });
}

/** Decimal string from the API ("4800.00") in its currency, e.g. "4.800 CZK" / "CZK 4,800"; empty for null. */
export function formatMoney(amount: string | null | undefined, currency: string, t: T): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(t.intl, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${t.num(n, { maximumFractionDigits: 1 })} ${currency}`;
  }
}

/** Running timer clock, H:MM:SS. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Typed duration -> minutes: "90", "1:30", "1h30", "1h 30m", "1g30", "1,5h", "1.5 giờ", "45m", "45p", "45 min",
 * "2 hrs". Null when it does not parse or is outside 1-1440 (the API's limit).
 */
export function parseDuration(input: string): number | null {
  const v = input.trim().toLowerCase().replace(',', '.').replace(/\s+/g, ' ');
  if (!v) return null;
  let minutes: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d+)$/))) minutes = Number(m[1]);
  else if ((m = v.match(/^(\d+):(\d{1,2})$/))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = v.match(/^(\d+(?:\.\d+)?) ?(?:h|hrs?|hours?|g|giờ|gio)$/))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = v.match(/^(\d+) ?(?:h|hrs?|hours?|g|giờ|gio) ?(\d{1,2}) ?(?:m|mins?|minutes?|p|ph|phút|phut)?$/)))
    minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = v.match(/^(\d+) ?(?:m|mins?|minutes?|p|ph|phút|phut)$/))) minutes = Number(m[1]);
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return null;
  return minutes;
}

export { todayPrague, addDays, mondayOf } from '@/lib/dates';

const utc = (day: string) => new Date(`${day}T00:00:00Z`);

/** "Thứ Hai, 2/11" / "Monday 2/11" (capitalised weekday). */
export function formatDay(day: string, t: T): string {
  const s = unpadded(
    new Intl.DateTimeFormat(t.intl, { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' }),
    utc(day),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2/11 – 8/11" for the week starting `monday`. */
export function formatWeekRange(monday: string, t: T): string {
  const short = new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  return `${unpadded(short, utc(monday))} – ${unpadded(short, utc(addDays(monday, 6)))}`;
}

/** DRF 400 body `{ field: [messages] }` -> one line per field, with the field names where known. */
const fieldNames: Record<string, Msg> = {
  title: msg('Tên'),
  client: msg('Khách'),
  billing: msg('Tính tiền', 'field'),
  price: msg('Giá trọn gói'),
  hourlyRate: msg('Giá giờ'),
  currency: msg('Tiền tệ'),
  project: msg('Dự án'),
  objective: msg('Mục tiêu'),
  date: msg('Ngày'),
  minutes: msg('Số phút'),
  note: msg('Ghi chú'),
};
export const fieldErrors = (body: unknown, t: T) => sharedFieldErrors(body, t, fieldNames);

export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
