import { api, type ApiError, type ApiItem, type ApiItemRequest, type ApiItemStatus } from '@/lib/api/client';
import { loadAllItems } from '@/lib/api/library';
import { toApiError } from '@/lib/api/use-api';
import { booksByTrack, bookUrl, tracks } from '@/lib/books';
import type { ProgressSnapshot } from '@/lib/progress';

// "Thêm 15 khóa học từ Sổ tay" on the empty Thư viện (DESIGN.md §9a: quick actions built from the owner's own
// content). Writes only when the owner clicks it; a source that is already in the library is skipped, so a second
// click (or another tab) never doubles a course. No backend endpoint: one POST /api/items per missing handbook.

/** The handbooks in Sổ tay order (Kinh doanh, IT, Kỹ năng). */
export const handbooks = tracks.flatMap((t) => booksByTrack(t.slug));

/** Sources compare without their trailing slash. */
const sourceKey = (s: string) => s.trim().replace(/\/+$/, '');

/**
 * The Items still missing, in creation order: the last one created is the newest and lists first, so the list
 * reads in Sổ tay order. A book with a lesson marked done starts as "Đang làm", the others as "Dự định".
 */
export function handbookItems(existingSources: Iterable<string>, done: ProgressSnapshot['done']): ApiItemRequest[] {
  const have = new Set([...existingSources].map(sourceKey));
  return handbooks
    .filter((b) => !have.has(sourceKey(bookUrl(b))))
    .map((b) => {
      const status: ApiItemStatus = Object.keys(done[b.slug] ?? {}).length > 0 ? 'active' : 'planned';
      return { type: 'course' as const, title: b.title, source: bookUrl(b), status };
    })
    .reverse();
}

export interface HandbookImport {
  /** Newest first, as the list shows them */
  created: ApiItem[];
  /** Handbooks that were already in the library */
  skipped: number;
  /** The POST that failed; the ones after it were not sent */
  error?: ApiError;
}

/** Reads every Item (one GET per 200), then creates the missing handbooks one by one. */
export async function importHandbooks(
  done: ProgressSnapshot['done'],
  onProgress?: (sent: number, total: number) => void,
): Promise<HandbookImport> {
  const existing = (await loadAllItems()).map((i) => i.source ?? '').filter(Boolean);
  const todo = handbookItems(existing, done);
  const skipped = handbooks.length - todo.length;
  const created: ApiItem[] = [];
  for (const body of todo) {
    onProgress?.(created.length, todo.length);
    try {
      created.unshift(await api.createItem(body));
    } catch (err) {
      return { created, skipped, error: toApiError(err) };
    }
  }
  return { created, skipped };
}
