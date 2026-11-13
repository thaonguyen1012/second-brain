// One vocabulary for every second-brain page (DECISIONS 4.4: same card, same status colours, same tags).
// Colours are Badge variants, so they follow the Space UI tokens in app/global.css.
import type { ApiInboxStatus, ApiItemStatus, ApiItemType, ApiOpportunity } from '@/lib/api/client';
import { drfMessageVi } from '@/lib/drf-messages-vi';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

export type Tone = 'secondary' | 'info' | 'success' | 'warning' | 'error' | 'outline';

export const itemTypes: { value: ApiItemType; label: Msg }[] = [
  { value: 'course', label: msg('Khóa học') },
  { value: 'book', label: msg('Sách') },
  { value: 'film', label: msg('Phim') },
  { value: 'article', label: msg('Bài viết') },
  { value: 'project', label: msg('Dự án') },
  { value: 'tool', label: msg('Công cụ') },
];

export const itemStatuses: { value: ApiItemStatus; label: Msg; tone: Tone }[] = [
  { value: 'planned', label: msg('Dự định'), tone: 'secondary' },
  { value: 'active', label: msg('Đang làm'), tone: 'info' },
  { value: 'done', label: msg('Xong'), tone: 'success' },
  { value: 'dropped', label: msg('Bỏ'), tone: 'outline' },
];

/**
 * The same four statuses and colours, read as a tool's use (owner 13/11/2026): Muốn thử, Đang dùng, Đã thành thạo,
 * Bỏ. Wherever one tool's status shows; the board's lanes, which hold every type, keep the shared words.
 */
const toolStatuses: typeof itemStatuses = itemStatuses.map((s) => ({
  ...s,
  label: { planned: msg('Muốn thử'), active: msg('Đang dùng'), done: msg('Đã thành thạo'), dropped: s.label }[s.value],
}));

/** The statuses as an Item of `type` names them (a tool's own words, else the shared ones). */
export const itemStatusesFor = (type?: string) => (type === 'tool' ? toolStatuses : itemStatuses);

/** The one-click next step of the lifecycle on a row and the Item page (DECISIONS 4.2: "done" still needs a note). */
const nextSteps: Partial<Record<ApiItemStatus, { to: ApiItemStatus; label: Msg }>> = {
  planned: { to: 'active', label: msg('Bắt đầu') },
  active: { to: 'done', label: msg('Xong') },
};
const toolNextSteps: typeof nextSteps = {
  planned: { to: 'active', label: msg('Bắt đầu dùng') },
  active: { to: 'done', label: msg('Đã thành thạo', 'step') },
};

/** The next step from `status` for an Item of `type`, or undefined (done, dropped). */
export const itemNextStep = (status: ApiItemStatus | undefined, type?: string) =>
  (type === 'tool' ? toolNextSteps : nextSteps)[status ?? 'planned'];

export const inboxStatuses: { value: ApiInboxStatus; label: Msg; tone: Tone }[] = [
  { value: 'inbox', label: msg('Inbox'), tone: 'warning' },
  { value: 'later', label: msg('Đọc sau'), tone: 'info' },
  { value: 'archived', label: msg('Lưu trữ'), tone: 'outline' },
];

export const objectiveStatuses: Record<string, { label: Msg; tone: Tone }> = {
  open: { label: msg('Đang làm'), tone: 'info' },
  done: { label: msg('Xong'), tone: 'success' },
  dropped: { label: msg('Bỏ'), tone: 'outline' },
};

/** `suggestedDestination` of an inbox entry (API_CONTRACT.md). */
export const destinations: Record<string, Msg> = {
  read_later: msg('Đọc sau'),
  book: msg('Sách'),
  opportunity: msg('Bằng chứng cho cơ hội'),
  note: msg('Ghi chú'),
};

/** An Item type's label; an unknown type (a newer backend) shows its raw value. */
export const itemTypeLabel = (type: string): Msg => itemTypes.find((x) => x.value === type)?.label ?? msg(type);
/** A status's label and colour; with `type`, in that type's words (a tool's "Đang dùng"). */
export const itemStatusOf = (s: string | undefined, type?: string) => {
  const list = itemStatusesFor(type);
  return list.find((x) => x.value === s) ?? list[0];
};
export const inboxStatusOf = (s: string) => inboxStatuses.find((x) => x.value === s) ?? inboxStatuses[0];

/** Intl output with the day and month unpadded, so en-GB matches vi-VN and lib/dates formatDay ("8/11/2026"). */
export function unpadded(f: Intl.DateTimeFormat, date: Date | number): string {
  if (Number.isNaN(Number(date))) return 'Invalid Date'; // as toLocaleString shows it; formatToParts would throw
  return f
    .formatToParts(date)
    .map((p) => (p.type === 'day' || p.type === 'month' ? p.value.replace(/^0(?=\d)/, '') : p.value))
    .join('');
}

/** A timestamp's day in the browser: "8/11/2026" in both languages. */
export function formatDate(iso: string | null | undefined, t: T): string {
  if (!iso) return '';
  return unpadded(
    new Intl.DateTimeFormat(t.intl, { day: 'numeric', month: 'numeric', year: 'numeric' }),
    new Date(iso),
  );
}

/** Host of a URL without "www.", for cards whose page has no og:site_name. */
export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Opportunity decisions (DECISIONS 9.2), shared by Cơ hội and the week review. */
export const decisions: { value: ApiOpportunity['decision']; label: Msg; tone: Tone }[] = [
  { value: 'open', label: msg('Chưa quyết'), tone: 'secondary' },
  { value: 'keep', label: msg('Giữ'), tone: 'info' },
  { value: 'build', label: msg('Làm'), tone: 'success' },
  { value: 'drop', label: msg('Bỏ', 'decision'), tone: 'outline' },
];

export const decisionOf = (d: string) => decisions.find((x) => x.value === d) ?? decisions[0];

/** Detail view of one opportunity on the Cơ hội page. */
export const opportunityHref = (id: number) => `/co-hoi/?id=${id}`;

/** Field names every form shares: `validate()` errors and plain DRF errors. */
const defaultFieldNames: Record<string, Msg> = { non_field_errors: msg('Lỗi'), detail: msg('Lỗi') };

/**
 * One DRF message in the page's language. Django answers in the page's language (the X-UI-Lang header
 * lib/api/client.ts sends, else the `lang` cookie; its own and DRF's messages, and the app's,
 * backend/core/middleware.py); in Vietnamese, DRF's catalog leaves some in English, which
 * lib/drf-messages-vi.ts translates. English needs nothing.
 */
const translateMessage = (text: string, t: T) => (t.locale === 'vi' ? drfMessageVi(text) : text);

/**
 * Messages of one DRF error value, flattened: a list joins its messages, a nested object (a ListField child,
 * `{ "0": ["..."] }`, or a nested serializer) adds its key ("#1" for list positions), anything else is String().
 */
function flattenErrors(value: unknown, t: T, path: string[] = []): { path: string[]; text: string }[] {
  if (Array.isArray(value)) {
    const plain = value.filter((v) => typeof v !== 'object' || v === null).map((v) => translateMessage(String(v), t));
    const nested = value.flatMap((v, i) =>
      v && typeof v === 'object' && Object.keys(v).length ? flattenErrors(v, t, [...path, `#${i + 1}`]) : [],
    );
    return [...(plain.length ? [{ path, text: plain.join(' ') }] : []), ...nested];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flattenErrors(v, t, [...path, /^\d+$/.test(k) ? `#${Number(k) + 1}` : k]),
    );
  }
  return value === undefined || value === null || value === '' ? [] : [{ path, text: translateMessage(String(value), t) }];
}

/** DRF 400 body `{ field: [messages] }` -> one line per field, with the field names where given. */
export function fieldErrors(body: unknown, t: T, names: Record<string, Msg> = {}): string | null {
  if (!body || typeof body !== 'object') return null;
  const all: Record<string, Msg> = { ...defaultFieldNames, ...names };
  const name = (key: string) => (all[key] ? t(all[key]) : key);
  const lines = flattenErrors(body, t).map(({ path, text }) => {
    if (!path.length) return text;
    const [field, ...rest] = path;
    const label = [name(field), ...rest.map(name)].join(' ');
    return `${label}: ${text}`;
  });
  return lines.length ? lines.join('\n') : null;
}

/**
 * DRF 400 body -> each field's own messages, keyed by the body's top-level field (the API name the form sends), for
 * that field's description (DESIGN.md §6 "Form errors"). Translated like fieldErrors but without the field's own
 * name, which its label already says; list positions and nested fields keep theirs ("#2: ..."). Empty for anything that
 * is not a DRF error object.
 */
export function errorsByField(body: unknown, t: T, names: Record<string, Msg> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body || typeof body !== 'object') return out;
  const all: Record<string, Msg> = { ...defaultFieldNames, ...names };
  const name = (key: string) => (all[key] ? t(all[key]) : key);
  for (const { path, text } of flattenErrors(body, t)) {
    const [field, ...rest] = path;
    if (field === undefined) continue;
    const line = rest.length ? `${rest.map(name).join(' ')}: ${text}` : text;
    out[field] = out[field] ? `${out[field]} ${line}` : line;
  }
  return out;
}

/** The first message of a DRF 400 body (translated like fieldErrors), for one-line error boxes. */
export function firstFieldError(body: unknown, t: T): string | null {
  if (!body || typeof body !== 'object') return null;
  return flattenErrors(body, t)[0]?.text ?? null;
}
