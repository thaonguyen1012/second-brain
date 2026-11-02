// One vocabulary for every second-brain page (DECISIONS 4.4: same card, same status colours, same tags).
// Colours are Badge variants, so they follow the Space UI tokens in app/global.css.
import type { ApiInboxStatus, ApiItemStatus, ApiItemType } from '@/lib/api/client';

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
