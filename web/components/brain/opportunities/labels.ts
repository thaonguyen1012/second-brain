// Vocabulary of the Cơ hội pages (DECISIONS 9.2). Tones are the shared Badge variants of lib/labels.ts.
import type { ApiStance } from '@/lib/api/client';
import type { ApiEvidenceKind } from '@/lib/api/opportunities';
import { daysBetween, todayPrague } from '@/lib/dates';
import { fieldErrors as sharedFieldErrors } from '@/lib/labels';

export { decisions, decisionOf } from '@/lib/labels';

/** Stance is said in words (font-medium in rows), not with success/error badges: it is not a status. */
export const stances: { value: ApiStance; label: string }[] = [
  { value: 'supports', label: 'Ủng hộ' },
  { value: 'contradicts', label: 'Phản bác' },
];

export const stanceOf = (s: string) => stances.find((x) => x.value === s) ?? stances[0];

export const evidenceKinds: Record<ApiEvidenceKind, string> = {
  inbox: 'Từ inbox',
  item: 'Item thư viện',
  note: 'Ghi chú',
  conversation: 'Cuộc nói chuyện',
  link: 'Link',
};

/** The four self-scores, in the order of DECISIONS 9.2. */
export const scoreDims = [
  { key: 'opportunity', label: 'Cơ hội' },
  { key: 'pain', label: 'Nỗi đau' },
  { key: 'feasibility', label: 'Khả thi' },
  { key: 'timing', label: 'Thời điểm' },
] as const;

export type ScoreKey = (typeof scoreDims)[number]['key'];

/** Skill freshness (6.5): the same words and tones as the Kỹ năng matrix. */
export { freshness } from '../growth/labels';

export const STALE_LABEL = '4 tuần không có bằng chứng';

/** Today in Europe/Prague (the backend's day). */
export { todayPrague as todayIso, formatDay } from '@/lib/dates';

/** Days from today (Prague) to a YYYY-MM-DD (negative when past). */
export const daysUntil = (day: string): number => daysBetween(todayPrague(), day);

/** DRF 400 body `{ field: [messages] }` -> one line per field, with Vietnamese field names where known. */
const fieldNames: Record<string, string> = {
  title: 'Tiêu đề',
  hypothesis: 'Giả thuyết',
  whyNow: 'Vì sao bây giờ',
  nextAction: 'Hành động kế tiếp',
  decideBy: 'Hạn quyết định',
  decision: 'Quyết định',
  fit: 'Kỹ năng',
  url: 'Link',
  date: 'Ngày',
  note: 'Ghi chú',
  stance: 'Ủng hộ / phản bác',
  opportunity: 'Cơ hội',
  pain: 'Nỗi đau',
  feasibility: 'Khả thi',
  timing: 'Thời điểm',
};

export const fieldErrors = (body: unknown) => sharedFieldErrors(body, fieldNames);
