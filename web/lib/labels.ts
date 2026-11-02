// One vocabulary for every second-brain page (DECISIONS 4.4: same card, same status colours, same tags).
// Colours are Badge variants, so they follow the Space UI tokens in app/global.css.
import type { ApiInboxStatus, ApiItemStatus, ApiItemType, ApiOpportunity } from '@/lib/api/client';

export type Tone = 'secondary' | 'info' | 'success' | 'warning' | 'error' | 'outline';

export const itemTypes: { value: ApiItemType; label: string }[] = [
  { value: 'course', label: 'Khóa học' },
  { value: 'book', label: 'Sách' },
  { value: 'film', label: 'Phim' },
  { value: 'article', label: 'Bài viết' },
  { value: 'project', label: 'Dự án' },
];

export const itemStatuses: { value: ApiItemStatus; label: string; tone: Tone }[] = [
  { value: 'planned', label: 'Dự định', tone: 'secondary' },
  { value: 'active', label: 'Đang làm', tone: 'info' },
  { value: 'done', label: 'Xong', tone: 'success' },
  { value: 'dropped', label: 'Bỏ', tone: 'outline' },
];

export const inboxStatuses: { value: ApiInboxStatus; label: string; tone: Tone }[] = [
  { value: 'inbox', label: 'Inbox', tone: 'warning' },
  { value: 'later', label: 'Đọc sau', tone: 'info' },
  { value: 'archived', label: 'Lưu trữ', tone: 'outline' },
];

export const objectiveStatuses: Record<string, { label: string; tone: Tone }> = {
  open: { label: 'Đang làm', tone: 'info' },
  done: { label: 'Xong', tone: 'success' },
  dropped: { label: 'Bỏ', tone: 'outline' },
};

/** `suggestedDestination` of an inbox entry (API_CONTRACT.md). */
export const destinations: Record<string, string> = {
  read_later: 'Đọc sau',
  book: 'Sách',
  opportunity: 'Bằng chứng cho cơ hội',
  note: 'Ghi chú',
};

export const itemTypeLabel = (t: string) => itemTypes.find((x) => x.value === t)?.label ?? t;
export const itemStatusOf = (s: string | undefined) => itemStatuses.find((x) => x.value === s) ?? itemStatuses[0];
export const inboxStatusOf = (s: string) => inboxStatuses.find((x) => x.value === s) ?? inboxStatuses[0];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
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
export const decisions: { value: ApiOpportunity['decision']; label: string; tone: Tone }[] = [
  { value: 'open', label: 'Chưa quyết', tone: 'secondary' },
  { value: 'keep', label: 'Giữ', tone: 'info' },
  { value: 'build', label: 'Làm', tone: 'success' },
  { value: 'drop', label: 'Bỏ', tone: 'outline' },
];

export const decisionOf = (d: string) => decisions.find((x) => x.value === d) ?? decisions[0];

/** Detail view of one opportunity on the Cơ hội page. */
export const opportunityHref = (id: number) => `/co-hoi/?id=${id}`;

/**
 * DRF messages that its Vietnamese catalog leaves in English (the backend runs with LANGUAGE_CODE "vi", so
 * Django's own messages already arrive in Vietnamese). Unknown messages pass through unchanged.
 */
const drfMessages: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^This field is required\.$/, () => 'Trường này là bắt buộc.'],
  [/^This field may not be null\.$/, () => 'Trường này không được để trống.'],
  [/^This field may not be blank\.$/, () => 'Trường này không được bỏ trống.'],
  [/^This list may not be empty\.$/, () => 'Danh sách này không được rỗng.'],
  [/^Ensure this field has no more than (\d+) characters\.$/, (m) => `Tối đa ${m[1]} ký tự.`],
  [/^Ensure this field has at least (\d+) characters\.$/, (m) => `Ít nhất ${m[1]} ký tự.`],
  [/^Ensure this value is less than or equal to (-?[\d.]+)\.$/, (m) => `Giá trị phải nhỏ hơn hoặc bằng ${m[1]}.`],
  [/^Ensure this value is greater than or equal to (-?[\d.]+)\.$/, (m) => `Giá trị phải lớn hơn hoặc bằng ${m[1]}.`],
  [/^Ensure that there are no more than (\d+) digits in total\.$/, (m) => `Tối đa ${m[1]} chữ số.`],
  [/^Ensure that there are no more than (\d+) decimal places\.$/, (m) => `Tối đa ${m[1]} chữ số thập phân.`],
  [/^Ensure that there are no more than (\d+) digits before the decimal point\.$/, (m) => `Tối đa ${m[1]} chữ số phần nguyên.`],
  [/^A valid integer is required\.$/, () => 'Cần một số nguyên.'],
  [/^A valid number is required\.$/, () => 'Cần một số.'],
  [/^Must be a valid boolean\.$/, () => 'Cần giá trị đúng hoặc sai.'],
  [/^Enter a valid URL\.$/, () => 'Nhập một URL hợp lệ.'],
  [/^Enter a valid email address\.$/, () => 'Nhập một địa chỉ email hợp lệ.'],
  [/^"(.*)" is not a valid choice\.$/, (m) => `"${m[1]}" không phải lựa chọn hợp lệ.`],
  [/^Invalid pk "(.*)" - object does not exist\.$/, (m) => `Không tìm thấy mục #${m[1]}.`],
  [/^Expected a list of items but got type "(.*)"\.$/, () => 'Cần một danh sách.'],
  [/^Date has wrong format\..*$/, () => 'Ngày sai định dạng, dùng YYYY-MM-DD.'],
  [/^Datetime has wrong format\..*$/, () => 'Thời điểm sai định dạng.'],
  [/^.* with this .* already exists\.$/, () => 'Đã có một mục như vậy.'],
];

function translateMessage(text: string): string {
  for (const [re, to] of drfMessages) {
    const m = text.match(re);
    if (m) return to(m);
  }
  return text;
}

/** Field names every form shares: `validate()` errors and plain DRF errors. */
const defaultFieldNames: Record<string, string> = { non_field_errors: 'Lỗi', detail: 'Lỗi' };

/**
 * Messages of one DRF error value, flattened: a list joins its messages, a nested object (a ListField child,
 * `{ "0": ["..."] }`, or a nested serializer) adds its key ("#1" for list positions), anything else is String().
 */
function flattenErrors(value: unknown, path: string[] = []): { path: string[]; text: string }[] {
  if (Array.isArray(value)) {
    const plain = value.filter((v) => typeof v !== 'object' || v === null).map((v) => translateMessage(String(v)));
    const nested = value.flatMap((v, i) =>
      v && typeof v === 'object' && Object.keys(v).length ? flattenErrors(v, [...path, `#${i + 1}`]) : [],
    );
    return [...(plain.length ? [{ path, text: plain.join(' ') }] : []), ...nested];
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flattenErrors(v, [...path, /^\d+$/.test(k) ? `#${Number(k) + 1}` : k]),
    );
  }
  return value === undefined || value === null || value === '' ? [] : [{ path, text: translateMessage(String(value)) }];
}

/** DRF 400 body `{ field: [messages] }` -> one line per field, with Vietnamese field names where given. */
export function fieldErrors(body: unknown, names: Record<string, string> = {}): string | null {
  if (!body || typeof body !== 'object') return null;
  const all = { ...defaultFieldNames, ...names };
  const lines = flattenErrors(body).map(({ path, text }) => {
    if (!path.length) return text;
    const [field, ...rest] = path;
    const label = [all[field] ?? field, ...rest.map((p) => all[p] ?? p)].join(' ');
    return `${label}: ${text}`;
  });
  return lines.length ? lines.join('\n') : null;
}

/** The first message of a DRF 400 body (translated like fieldErrors), for one-line error boxes. */
export function firstFieldError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  return flattenErrors(body)[0]?.text ?? null;
}
