// Cmd+K "find everything" (DECISIONS 4.4), second-brain half: the `?q=` filters of five list endpoints, a few
// rows of each kind. Handbook search stays on /api/search (SQLite FTS, Next) and never waits for this.
import { api, type ApiInboxEntry, type ApiItem, type ApiOpportunity, type Page } from './client';
import { growthApi, type ApiSkill } from './growth';
import { notesApi, type ApiNote } from './library';
import { toApiError } from './use-api';

export interface BrainSearchResults {
  items: ApiItem[];
  notes: ApiNote[];
  inbox: ApiInboxEntry[];
  opportunities: ApiOpportunity[];
  skills: ApiSkill[];
}

/**
 * At most `limit` rows per kind, newest first (the lists' own order). A kind that fails is left empty so one
 * broken area never hides the others; only when every kind fails the first error is thrown (backend absent,
 * signed out), and the caller decides whether to say so.
 */
export async function searchBrain(q: string, limit = 5): Promise<BrainSearchResults> {
  const query = { q, limit };
  const calls = [
    api.listItems(query),
    notesApi.list(query),
    api.listInbox(query),
    api.listOpportunities(query),
    growthApi.listSkills(query),
  ] as const;
  const settled = await Promise.allSettled(calls);
  const failed = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failed.length === settled.length) throw toApiError(failed[0].reason);
  const rows = <T>(s: PromiseSettledResult<Page<T>>): T[] =>
    s.status === 'fulfilled' ? s.value.results.slice(0, limit) : [];
  const [items, notes, inbox, opportunities, skills] = settled;
  return {
    items: rows(items),
    notes: rows(notes),
    inbox: rows(inbox),
    opportunities: rows(opportunities),
    skills: rows(skills),
  };
}
