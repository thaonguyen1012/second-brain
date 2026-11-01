// The only module that calls the Django backend. Types come from schema.ts (`make api-types`, OpenAPI).
// Same origin in every environment: nginx in production, scripts/dev-proxy.mjs in development.
import type { components } from './schema';

type Schemas = components['schemas'];
export type ApiMe = Schemas['Me'];
export type ApiProgressSnapshot = Schemas['ProgressSnapshot'];
export type ApiLastVisited = Schemas['LastVisited'];
export type ApiSetDoneResponse = Schemas['SetDoneResponse'];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The book's index page is '' in the app and '_index' in URLs; '/' inside the page path becomes %2F. */
export function pageSegment(pageSlug: string): string {
  return pageSlug === '' ? '_index' : encodeURIComponent(pageSlug);
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function request<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-CSRFToken'] = csrfToken();
  }
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, `${method} ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  getMe: () => request<ApiMe>('GET', '/api/me'),
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
};
