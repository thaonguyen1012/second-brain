// Labels and date helpers for the "Phát triển" pages (skills, market, brag document, predictions).
import type { ApiEvidenceKind, ApiFreshness, ApiOutcome, ApiSeniority } from '@/lib/api/growth';
import { addDays, formatDay, todayPrague } from '@/lib/dates';
import type { Tone } from '@/lib/labels';

/**
 * Freshness is shown by colour and fading, never by a number (DECISIONS 9.1, 9.2 Skill). `dot` is the small swatch
 * next to a skill name, `tone` the StatusBadge colour; `label` is the word beside it, so the state is never colour
 * alone; `hint` says what the word means (skill sheet).
 */
export const freshness: Record<ApiFreshness, { label: string; hint: string; tone: Tone; dot: string }> = {
  fresh: { label: 'Còn mới', hint: 'có bằng chứng trong 3 tháng', tone: 'success', dot: 'bg-bw-green' },
  aging: {
    label: 'Đang cũ dần',
    hint: 'bằng chứng mới nhất 3 đến 6 tháng trước',
    tone: 'warning',
    dot: 'bg-bw-yellow',
  },
  faded: {
    label: 'Đã mờ',
    hint: '6 tháng không có bằng chứng mới, hoặc chưa có',
    tone: 'outline',
    dot: 'bg-muted-foreground/40',
  },
};

export const freshnessOrder: ApiFreshness[] = ['fresh', 'aging', 'faded'];

export const evidenceKinds: { value: ApiEvidenceKind; label: string }[] = [
  { value: 'link', label: 'Link (bài viết, repo, case study)' },
  { value: 'item', label: 'Item trong thư viện (dự án đã ship)' },
  { value: 'note', label: 'Ghi chú trong thư viện' },
];

export const evidenceKindLabel: Record<ApiEvidenceKind, string> = { link: 'Link', item: 'Item', note: 'Ghi chú' };

export const seniority: Record<ApiSeniority, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
  unknown: 'Không rõ',
};

export const outcomes: { value: ApiOutcome; label: string; tone: Tone }[] = [
  { value: 'open', label: 'Chưa chấm', tone: 'secondary' },
  { value: 'right', label: 'Đúng', tone: 'success' },
  { value: 'partial', label: 'Đúng một phần', tone: 'secondary' },
  { value: 'wrong', label: 'Sai', tone: 'error' },
];
export const outcomeOf = (o: ApiOutcome) => outcomes.find((x) => x.value === o) ?? outcomes[0];

/** The two questions of DECISIONS 6.1, asked next to every new tool or skill. */
export const twoQuestions = [
  'Nếu AI dừng tiến bộ năm sau, cái này còn đáng học không?',
  'Nếu AI tiến nhanh gấp đôi, cái này còn đáng học không?',
];

// --- Dates: the backend works in Europe/Prague and sends dates as YYYY-MM-DD, months as YYYY-MM. ---

const pad = (n: number) => String(n).padStart(2, '0');

export { todayPrague as today, addDays, mondayOf, formatDay } from '@/lib/dates';

/** "2/11 – 8/11/2026" for the week starting on `monday`. */
export function weekLabel(monday: string): string {
  const end = addDays(monday, 6);
  const [, m1, d1] = monday.split('-').map(Number);
  return `${d1}/${m1} – ${formatDay(end)}`;
}

export const thisMonth = () => todayPrague().slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** "Tháng 11/2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `Tháng ${m}/${y}`;
}

export { fieldErrors } from '@/lib/labels';

/** "a, b , c" -> ["a", "b", "c"] (empty parts dropped). */
export const splitList = (s: string) =>
  s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
