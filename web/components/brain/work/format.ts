// Labels and formatting for Công việc (projects and time). Dates are YYYY-MM-DD strings in Europe/Prague,
// the backend's timezone, so "today" and week boundaries match /api/time-entries/summary.
import type { ApiBilling } from '@/lib/api/work';
import { addDays } from '@/lib/dates';
import { fieldErrors as sharedFieldErrors } from '@/lib/labels';

export const billingChoices: { value: ApiBilling; label: string }[] = [
  { value: 'hourly', label: 'Theo giờ' },
  { value: 'fixed', label: 'Trọn gói' },
];
export const billingLabel = (b: string) => billingChoices.find((c) => c.value === b)?.label ?? b;

const numberVi = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

/** 90 -> "1 giờ 30 phút", 45 -> "45 phút", 120 -> "2 giờ". */
export function formatMinutes(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}

/** 90 -> "1,5 giờ" (compact, for totals and chart labels). */
export function formatHours(minutes: number | null | undefined): string {
  return `${numberVi.format((minutes ?? 0) / 60)} giờ`;
}

/** Decimal string from the API ("4800.00") in its currency, e.g. "4.800 CZK"; empty for null. */
export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${numberVi.format(n)} ${currency}`;
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
 * Typed duration -> minutes: "90", "1:30", "1h30", "1h 30m", "1g30", "1,5h", "1.5 giờ", "45m", "45p".
 * Null when it does not parse or is outside 1-1440 (the API's limit).
 */
export function parseDuration(input: string): number | null {
  const v = input.trim().toLowerCase().replace(',', '.').replace(/\s+/g, ' ');
  if (!v) return null;
  let minutes: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d+)$/))) minutes = Number(m[1]);
  else if ((m = v.match(/^(\d+):(\d{1,2})$/))) minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = v.match(/^(\d+(?:\.\d+)?) ?(?:h|g|giờ|gio)$/))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = v.match(/^(\d+) ?(?:h|g|giờ|gio) ?(\d{1,2}) ?(?:m|p|ph|phút|phut)?$/)))
    minutes = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = v.match(/^(\d+) ?(?:m|p|ph|phút|phut)$/))) minutes = Number(m[1]);
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return null;
  return minutes;
}

export { todayPrague, addDays, mondayOf } from '@/lib/dates';

const utc = (day: string) => new Date(`${day}T00:00:00Z`);

const dayVi = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' });
const shortVi = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/** "Thứ Hai, 2/11" (capitalised weekday). */
export function formatDay(day: string): string {
  const s = dayVi.format(utc(day));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2/11 – 8/11" for the week starting `monday`. */
export function formatWeekRange(monday: string): string {
  return `${shortVi.format(utc(monday))} – ${shortVi.format(utc(addDays(monday, 6)))}`;
}

/** DRF 400 body `{ field: [messages] }` -> one line per field, with Vietnamese field names where known. */
const fieldNames: Record<string, string> = {
  title: 'Tên',
  client: 'Khách',
  billing: 'Tính tiền',
  price: 'Giá trọn gói',
  hourlyRate: 'Giá giờ',
  currency: 'Tiền tệ',
  project: 'Dự án',
  objective: 'Mục tiêu',
  date: 'Ngày',
  minutes: 'Số phút',
  note: 'Ghi chú',
  non_field_errors: 'Lỗi',
  detail: 'Lỗi',
};
export const fieldErrors = (body: unknown) => sharedFieldErrors(body, fieldNames);

export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
