// Cmd+K "find everything" (DECISIONS 4.4, 4.8), second-brain half: the `?q=` filters of the list endpoints
// (notes through /api/notes/search, which sends an excerpt instead of the body), a few rows of each kind.
// Handbook search stays on /api/search (SQLite FTS, Next) and never waits for this.
import {
  api,
  withQuery,
  type ApiInboxEntry,
  type ApiItem,
  type ApiNewsItem,
  type ApiOpportunity,
  type Page,
} from './client';
import type { ApiAchievement, ApiJobAd, ApiPrediction, ApiSkill } from './growth';
import { notesApi, type ApiNoteSearchHit } from './library';
import { toApiError } from './use-api';
import type { LinkTarget } from '@/lib/note-links';

export interface BrainSearchResults {
  items: ApiItem[];
  notes: ApiNoteSearchHit[];
  inbox: ApiInboxEntry[];
  opportunities: ApiOpportunity[];
  skills: ApiSkill[];
  achievements: ApiAchievement[];
  predictions: ApiPrediction[];
  jobAds: ApiJobAd[];
  news: ApiNewsItem[];
}

/**
 * At most `limit` rows per kind, newest first (the lists' own order). A kind that fails is left empty so one
 * broken area never hides the others; only when every kind fails the first error is thrown (backend absent,
 * signed out), and the caller decides whether to say so. `signal` cancels every request of a superseded query
 * (the rejection is then the fetch AbortError, see isAbort).
 */
export async function searchBrain(q: string, limit = 5, signal?: AbortSignal): Promise<BrainSearchResults> {
  const first = <T>(path: string) => api.page<T>(withQuery(path, { q, limit }), signal);
  const calls = [
    first<ApiItem>('/api/items'),
    notesApi.search(q, limit, signal).then((r): Page<ApiNoteSearchHit> => ({ results: r.results, next: null })),
    first<ApiInboxEntry>('/api/inbox'),
    first<ApiOpportunity>('/api/opportunities'),
    first<ApiSkill>('/api/skills'),
    first<ApiAchievement>('/api/achievements'),
    first<ApiPrediction>('/api/predictions'),
    first<ApiJobAd>('/api/market/job-ads'),
    first<ApiNewsItem>('/api/news'),
  ] as const;
  const settled = await Promise.allSettled(calls);
  if (signal?.aborted) throw signal.reason;
  const failed = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed.length === settled.length) throw toApiError(failed[0].reason);
  const rows = <T>(s: PromiseSettledResult<Page<T>>): T[] =>
    s.status === 'fulfilled' ? s.value.results.slice(0, limit) : [];
  const [items, notes, inbox, opportunities, skills, achievements, predictions, jobAds, news] = settled;
  return {
    items: rows(items),
    notes: rows(notes),
    inbox: rows(inbox),
    opportunities: rows(opportunities),
    skills: rows(skills),
    achievements: rows(achievements),
    predictions: rows(predictions),
    jobAds: rows(jobAds),
    news: rows(news),
  };
}

/**
 * The `[[` picker of the note editor (DECISIONS 9.8): Items, notes, opportunities and skills whose title (or name)
 * matches `q`, at most `limit` of each, through the same `?q=` filters as Cmd+K. A kind that fails is left out; only
 * when every kind fails the first error is thrown. `except` drops one note (the note being edited).
 */
export async function searchLinkTargets(
  q: string,
  limit = 5,
  signal?: AbortSignal,
  except?: number,
): Promise<LinkTarget[]> {
  const first = <T>(path: string) => api.page<T>(withQuery(path, { q, limit }), signal);
  const settled = await Promise.allSettled([
    first<ApiItem>('/api/items').then((p) => p.results.map((i): LinkTarget => ({ kind: 'item', id: i.id, title: i.title }))),
    notesApi
      .search(q, limit, signal)
      .then((r) => r.results.filter((n) => n.id !== except).map((n): LinkTarget => ({ kind: 'note', id: n.id, title: n.title }))),
    first<ApiOpportunity>('/api/opportunities').then((p) =>
      p.results.map((o): LinkTarget => ({ kind: 'opportunity', id: o.id, title: o.title })),
    ),
    first<ApiSkill>('/api/skills').then((p) => p.results.map((s): LinkTarget => ({ kind: 'skill', id: s.id, title: s.name }))),
  ]);
  if (signal?.aborted) throw signal.reason;
  const failed = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed.length === settled.length) throw toApiError(failed[0].reason);
  return settled.flatMap((s) => (s.status === 'fulfilled' ? s.value.slice(0, limit) : []));
}
