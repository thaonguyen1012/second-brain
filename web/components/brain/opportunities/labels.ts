// Vocabulary of the Cơ hội pages (DECISIONS 9.2). Tones are the shared Badge variants of lib/labels.ts.
import type { ApiStance } from '@/lib/api/client';
import type { ApiEvidenceKind } from '@/lib/api/opportunities';
import { daysBetween, todayPrague } from '@/lib/dates';
import { fieldErrors as sharedFieldErrors } from '@/lib/labels';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

export { decisions, decisionOf } from '@/lib/labels';

/** Stance is said in words (font-medium in rows), not with success/error badges: it is not a status. */
export const stances: { value: ApiStance; label: Msg }[] = [
  { value: 'supports', label: msg('Ủng hộ') },
  { value: 'contradicts', label: msg('Phản bác') },
];

export const stanceOf = (s: string) => stances.find((x) => x.value === s) ?? stances[0];

export const evidenceKinds: Record<ApiEvidenceKind, Msg> = {
  inbox: msg('Từ inbox'),
  item: msg('Item thư viện'),
  note: msg('Ghi chú'),
  conversation: msg('Cuộc nói chuyện'),
  link: msg('Link'),
};

/** The four self-scores, in the order of DECISIONS 9.2. */
export const scoreDims = [
  { key: 'opportunity', label: msg('Cơ hội') },
  { key: 'pain', label: msg('Nỗi đau') },
  { key: 'feasibility', label: msg('Khả thi') },
  { key: 'timing', label: msg('Thời điểm') },
] as const;

export type ScoreKey = (typeof scoreDims)[number]['key'];

/** Skill freshness (6.5): the same words and tones as the Kỹ năng matrix. */
export { freshness } from '../growth/labels';

export const STALE_LABEL = msg('4 tuần không có bằng chứng');

/** Today in Europe/Prague (the backend's day). */
export { todayPrague as todayIso, formatDay } from '@/lib/dates';

/** Days from today (Prague) to a YYYY-MM-DD (negative when past). */
export const daysUntil = (day: string): number => daysBetween(todayPrague(), day);

/** DRF 400 body `{ field: [messages] }` -> one line per field, with the field names where known. */
const fieldNames: Record<string, Msg> = {
  title: msg('Tiêu đề'),
  hypothesis: msg('Giả thuyết'),
  whyNow: msg('Vì sao bây giờ'),
  nextAction: msg('Hành động kế tiếp'),
  decideBy: msg('Hạn quyết định'),
  decision: msg('Quyết định'),
  fit: msg('Kỹ năng'),
  url: msg('Link'),
  date: msg('Ngày'),
  note: msg('Ghi chú'),
  stance: msg('Ủng hộ / phản bác'),
  opportunity: msg('Cơ hội'),
  pain: msg('Nỗi đau'),
  feasibility: msg('Khả thi'),
  timing: msg('Thời điểm'),
};

export const fieldErrors = (body: unknown, t: T) => sharedFieldErrors(body, t, fieldNames);
