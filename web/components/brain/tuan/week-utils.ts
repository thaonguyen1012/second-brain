// Dates, labels and number formats of the Tuần page. A week runs Monday to Sunday in Europe/Prague and is
// named by its Monday as YYYY-MM-DD (API_CONTRACT.md, Weeks). Date-only strings are handled in UTC so the
// arithmetic never depends on the browser's time zone.
import type { ApiReviewField } from '@/lib/api/weeks';
import { addDays } from '@/lib/dates';

const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export { todayPrague, addDays, mondayOf } from '@/lib/dates';

export function isMonday(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const d = parse(value);
  return !Number.isNaN(d.getTime()) && format(d) === value && d.getUTCDay() === 1;
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  return (parse(iso).getUTCDay() + 6) % 7;
}

/** ISO 8601 week number. */
export function isoWeek(iso: string): number {
  const d = parse(iso);
  const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

const dayMonth = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;

/** "2–8/11/2026" or "28/12/2026 – 3/1/2027". */
export function weekRange(start: string): string {
  const a = parse(start);
  const b = parse(addDays(start, 6));
  if (a.getUTCFullYear() !== b.getUTCFullYear())
    return `${dayMonth(a)}/${a.getUTCFullYear()} – ${dayMonth(b)}/${b.getUTCFullYear()}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${dayMonth(a)} – ${dayMonth(b)}/${b.getUTCFullYear()}`;
  return `${a.getUTCDate()}–${dayMonth(b)}/${b.getUTCFullYear()}`;
}

export const weekdayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const weekdayLong = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

/** "Thứ Hai 2/11". */
export function dayLabel(iso: string): string {
  return `${weekdayLong[weekdayIndex(iso)]} ${dayMonth(parse(iso))}`;
}

export function shortDate(iso: string): string {
  return dayMonth(parse(iso));
}

/** Clock time of a timestamp in the browser, for "đã lưu lúc". */
export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'numeric',
  });
}

/** Compact duration for axes and labels: "45p", "2h", "1h30". */
export function minutesShort(m: number): string {
  if (m < 60) return `${m}p`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
}

/** Full duration for tooltips and screen readers: "1 giờ 30 phút". */
export function minutesLong(m: number): string {
  if (m === 0) return '0 phút';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return [h ? `${h} giờ` : '', rest ? `${rest} phút` : ''].filter(Boolean).join(' ');
}

/** The six review questions (DECISIONS 9.2): four fixed ones and two of Alex's own. */
export const reviewQuestions: { field: ApiReviewField; label: string; hint: string }[] = [
  { field: 'reviewWin', label: 'Thắng lớn nhất tuần này là gì?', hint: 'Một việc, có số nếu được.' },
  {
    field: 'reviewDistraction',
    label: 'Cái gì kéo thời gian khỏi ưu tiên?',
    hint: 'Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở phần Giờ.',
  },
  { field: 'reviewLearned', label: 'Học được gì?', hint: '' },
  { field: 'reviewSatisfied', label: 'Có hài lòng với tuần này không?', hint: 'Có, không, hay một nửa, và vì sao.' },
  { field: 'reviewChangedMind', label: 'Tuần này điều gì làm mình đổi ý?', hint: 'Một niềm tin, một kế hoạch, một tin.' },
  {
    field: 'reviewOpportunityEvidence',
    label: 'Cơ hội nào có thêm bằng chứng?',
    hint: 'Ủng hộ hay phản bác, và quyết định giữ, bỏ hay làm.',
  },
];

