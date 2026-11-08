// Dates, labels and number formats of the Tuần page. A week runs Monday to Sunday in Europe/Prague and is
// named by its Monday as YYYY-MM-DD (API_CONTRACT.md, Weeks). Date-only strings are handled in UTC so the
// arithmetic never depends on the browser's time zone.
import type { ApiReviewField } from '@/lib/api/weeks';
import { addDays } from '@/lib/dates';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

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

/** Monday first; shown through t(). */
export const weekdayShort: readonly Msg[] = [
  msg('T2', 'weekday'),
  msg('T3', 'weekday'),
  msg('T4', 'weekday'),
  msg('T5', 'weekday'),
  msg('T6', 'weekday'),
  msg('T7', 'weekday'),
  msg('CN', 'weekday'),
];
export const weekdayLong: readonly Msg[] = [
  msg('Thứ Hai'),
  msg('Thứ Ba'),
  msg('Thứ Tư'),
  msg('Thứ Năm'),
  msg('Thứ Sáu'),
  msg('Thứ Bảy'),
  msg('Chủ nhật'),
];

/** "Thứ Hai 2/11" / "Monday 2/11". */
export function dayLabel(iso: string, t: T): string {
  return `${t(weekdayLong[weekdayIndex(iso)])} ${dayMonth(parse(iso))}`;
}

export function shortDate(iso: string): string {
  return dayMonth(parse(iso));
}

/** Clock time of a timestamp in the browser, for "đã lưu lúc". */
export function clockTime(iso: string | null | undefined, t: T): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(t.intl, {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'numeric',
  });
}

/** Compact duration for axes and labels: "45p" / "45m", "2h", "1h30". */
export function minutesShort(m: number, t: T): string {
  if (m < 60) return t('{m}p', { m });
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`;
}

/** Full duration for tooltips and screen readers: "1 giờ 30 phút" / "1 h 30 min". */
export function minutesLong(m: number, t: T): string {
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return t('{m} phút', { m: rest });
  return rest ? t('{h} giờ {m} phút', { h, m: rest }) : t('{h} giờ', { h });
}

/** The six review questions (DECISIONS 9.2): four fixed ones and two of Alex's own. */
export const reviewQuestions: { field: ApiReviewField; label: Msg; hint: Msg | null }[] = [
  { field: 'reviewWin', label: msg('Thắng lớn nhất tuần này là gì?'), hint: msg('Một việc, có số nếu được.') },
  {
    field: 'reviewDistraction',
    label: msg('Cái gì kéo thời gian khỏi ưu tiên?'),
    hint: msg('Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở phần Giờ.'),
  },
  { field: 'reviewLearned', label: msg('Học được gì?'), hint: null },
  {
    field: 'reviewSatisfied',
    label: msg('Có hài lòng với tuần này không?'),
    hint: msg('Có, không, hay một nửa, và vì sao.'),
  },
  {
    field: 'reviewChangedMind',
    label: msg('Tuần này điều gì làm mình đổi ý?'),
    hint: msg('Một niềm tin, một kế hoạch, một tin.'),
  },
  {
    field: 'reviewOpportunityEvidence',
    label: msg('Cơ hội nào có thêm bằng chứng?'),
    hint: msg('Ủng hộ hay phản bác, và quyết định giữ, bỏ hay làm.'),
  },
];

