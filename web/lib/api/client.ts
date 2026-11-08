// The only module that calls the Django backend. Types come from schema.ts (`make api-types`, OpenAPI).
// Same origin in every environment: nginx in production, scripts/dev-proxy.mjs in development.
// Browser only: pages that use it render on the client, so `next build` never calls Django.
import type { components, operations } from './schema';

type Schemas = components['schemas'];
export type ApiMe = Schemas['Me'];
export type ApiProgressSnapshot = Schemas['ProgressSnapshot'];
export type ApiLastVisited = Schemas['LastVisited'];
export type ApiSetDoneResponse = Schemas['SetDoneResponse'];
export type ApiWeek = Schemas['Week'];
export type ApiObjective = Schemas['Objective'];
export type ApiDailyBrief = Schemas['DailyBrief'];
export type ApiNewsItem = Schemas['NewsItem'];
export type ApiInboxEntry = Schemas['InboxEntry'];
export type ApiInboxStatus = Schemas['InboxStatusEnum'];
export type ApiItem = Schemas['Item'];
export type ApiItemRequest = Schemas['ItemRequest'];
export type ApiItemPatch = Schemas['PatchedItemRequest'];
export type ApiItemType = Schemas['TypeEnum'];
export type ApiItemStatus = Schemas['ItemStatusEnum'];
export type ApiOpportunity = Schemas['Opportunity'];
export type ApiStance = Schemas['EvidenceStanceEnum'];
export type ApiAttachResult = Schemas['AttachResult'];
export type ApiAttachNewsResult = Schemas['AttachNewsResult'];
export type ApiNewsFeedback = Schemas['NewsFeedbackEnum'];
export type ApiStatus = Schemas['Status'];
export type ApiCounts = Schemas['Counts'];

/** Query parameters of an OpenAPI operation. */
export type Query<Op extends keyof operations> = operations[Op]['parameters'] extends { query?: infer Q }
  ? NonNullable<Q>
  : never;

/**
 * `status` 0 = network error. `reachable` is false when the answer did not come from Django (network error,
 * proxy 502/503/504, or a non-JSON page such as Next's 404 when no proxy routes /api/ to Django).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reachable = true,
    /** Parsed JSON error body (DRF: `{ detail }` or `{ field: [messages] }`). */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/** One page of a cursor-paginated list; `next` is a same-origin path to pass to `api.page()`, or null. */
export interface Page<T> {
  results: T[];
  next: string | null;
}

/** The book's index page is '' in the app and '_index' in URLs; '/' inside the page path becomes %2F. */
export function pageSegment(pageSlug: string): string {
  return pageSlug === '' ? '_index' : encodeURIComponent(pageSlug);
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Fired on window after every successful write, so shared numbers (the sidebar counts) can refresh. */
export const API_WRITE_EVENT = 'brain:api-write';

/**
 * The one sender for every backend call (lib/api/* modules use it): same origin, CSRF header on writes,
 * ApiError on failure, undefined for 204; a successful write fires API_WRITE_EVENT. An aborted `signal` rejects
 * with the fetch AbortError (not an ApiError), so callers can tell "cancelled" from "offline" (isAbort).
 */
/**
 * Browsers refuse a `keepalive` request once the bodies of all keepalive requests in flight from the page pass 64 KiB
 * (UTF-8 bytes): a body that would pass it goes as a normal request.
 */
const KEEPALIVE_BUDGET = 64 * 1024;
let keepaliveInFlight = 0;

export async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  /**
   * `keepalive`: the request may outlive the page (a note saved while the tab closes); dropped when its body would
   * pass the page's keepalive budget, and it then goes as a normal request.
   */
  init?: { keepalive?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // The page's language (<html lang>, app/[lang]/layout.tsx): Django answers in it before the cookie, so a page
  // opened at /en/... gets English messages whatever the cookie says (backend/core/middleware.py)
  const lang = document.documentElement?.lang;
  if (lang) headers['X-UI-Lang'] = lang;
  if (method !== 'GET') headers['X-CSRFToken'] = csrfToken();
  // A FormData body (a file upload) goes as it is: the browser writes multipart/form-data with its boundary.
  const form = body instanceof FormData;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  const payload = body === undefined ? undefined : form ? body : JSON.stringify(body);
  const size = init?.keepalive && typeof payload === 'string' ? new TextEncoder().encode(payload).length : Infinity;
  const keepalive = keepaliveInFlight + size <= KEEPALIVE_BUDGET;
  if (keepalive) keepaliveInFlight += size;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: payload,
      signal,
      ...(keepalive && { keepalive: true }),
    }).finally(() => {
      if (keepalive) keepaliveInFlight -= size;
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, `${method} ${path}: network error`, false);
  }
  const json = (res.headers.get('content-type') ?? '').includes('application/json');
  if (!res.ok) {
    // 413 is nginx's own HTML page for a body over its limit: an answer about the request, not "offline"
    const reachable = (json || res.status === 413) && ![502, 503, 504].includes(res.status);
    const errBody: unknown = json ? await res.json().catch(() => undefined) : undefined;
    throw new ApiError(res.status, `${method} ${path}: ${res.status}`, reachable, errBody);
  }
  if (method !== 'GET') window.dispatchEvent(new Event(API_WRITE_EVENT));
  if (res.status === 204) return undefined as T;
  if (!json) throw new ApiError(res.status, `${method} ${path}: not JSON`, false);
  return (await res.json()) as T;
}

/** Appends the defined, non-empty query values. */
export function withQuery(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** DRF builds `next` as an absolute URL with the host it saw; keep only path and query (same origin). */
function samePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = new URL(url, 'http://local');
  return u.pathname + u.search;
}

/** True for the rejection of a request whose AbortSignal fired (a superseded search, not an error). */
export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function list<T>(path: string, signal?: AbortSignal): Promise<Page<T>> {
  const page = await request<{ results: T[]; next?: string | null }>('GET', path, undefined, signal);
  return { results: page.results, next: samePath(page.next) };
}

/**
 * GET /api/export: a zip of all the owner's data (notes as markdown, the rest as JSON), streamed by Django as an
 * attachment. Used as a plain download link (no fetch), so the browser saves it without holding it in memory.
 */
export const EXPORT_URL = '/api/export';

export const api = {
  getMe: () => request<ApiMe>('GET', '/api/me'),
  /** LLM cost this month vs the budget, last brief date, pending / failed jobs by kind. */
  getStatus: () => request<ApiStatus>('GET', '/api/status'),
  /** Sidebar row numbers: each list's row count with its page's default filters, and whether a timer runs. */
  getCounts: () => request<Schemas['Counts']>('GET', '/api/counts'),
  getProgress: () => request<ApiProgressSnapshot>('GET', '/api/progress'),
  setPageDone: (book: string, page: string, done: boolean) =>
    request<ApiSetDoneResponse>('PUT', `/api/progress/${encodeURIComponent(book)}/${pageSegment(page)}`, {
      done,
    } satisfies Schemas['SetDoneRequest']),
  setLastVisited: (book: string, page: string, title?: string) =>
    request<ApiLastVisited>('PUT', '/api/progress/last-visited', {
      book,
      page,
      ...(title ? { title } : {}),
    } satisfies Schemas['SetLastVisitedRequest']),

  /** Next page of any list (the `next` of a previous Page), or a first page from a path with its query. */
  page: <T>(next: string, signal?: AbortSignal) => list<T>(next, signal),

  /** This week (Europe/Prague), created empty on first access. */
  getCurrentWeek: () => request<ApiWeek>('GET', '/api/weeks/current'),

  /** Today's brief, or null before the 06:30 job has built it. */
  getTodayBrief: async (): Promise<ApiDailyBrief | null> => {
    try {
      return await request<ApiDailyBrief>('GET', '/api/brief/today');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.reachable) return null;
      throw err;
    }
  },
  /** The "hữu ích / không" button; null clears the rating. */
  rateNewsItem: (id: number, feedback: ApiNewsFeedback | null) =>
    request<ApiNewsItem>('PATCH', `/api/news/${id}`, { feedback } satisfies Schemas['PatchedNewsFeedbackRequest']),

  listInbox: (query?: Query<'listInbox'>) => list<ApiInboxEntry>(withQuery('/api/inbox', query)),
  /** One COUNT query on the server (the Inbox badge), never the rows. */
  countInbox: (query?: Query<'countInbox'>) =>
    request<Schemas['InboxCount']>('GET', withQuery('/api/inbox/count', query)),
  createInboxEntry: (body: Schemas['InboxEntryRequest']) => request<ApiInboxEntry>('POST', '/api/inbox', body),
  triageInboxEntry: (id: number, body: Schemas['PatchedInboxTriageRequest']) =>
    request<ApiInboxEntry>('PATCH', `/api/inbox/${id}`, body),
  deleteInboxEntry: (id: number) => request<void>('DELETE', `/api/inbox/${id}`),

  listItems: (query?: Query<'listItems'>) => list<ApiItem>(withQuery('/api/items', query)),
  getItem: (id: number) => request<ApiItem>('GET', `/api/items/${id}`),
  createItem: (body: ApiItemRequest) => request<ApiItem>('POST', '/api/items', body),
  updateItem: (id: number, body: ApiItemPatch) => request<ApiItem>('PATCH', `/api/items/${id}`, body),
  /** 409 (ApiError) for a project that has time entries. */
  deleteItem: (id: number) => request<void>('DELETE', `/api/items/${id}`),

  listOpportunities: (query?: Query<'listOpportunities'>) =>
    list<ApiOpportunity>(withQuery('/api/opportunities', query)),
  /** Weekly triage: the inbox entry becomes evidence and is archived (API_CONTRACT.md). */
  attachInboxEvidence: (opportunity: number, body: Schemas['AttachInboxRequest']) =>
    request<ApiAttachResult>('POST', `/api/opportunities/${opportunity}/evidence/inbox`, body),
  /** Morning-brief button: a news item becomes link evidence. */
  attachNewsEvidence: (opportunity: number, body: Schemas['AttachNewsRequest']) =>
    request<ApiAttachNewsResult>('POST', `/api/opportunities/${opportunity}/evidence/news`, body),
};
