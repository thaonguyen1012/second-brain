// Công việc: typed calls for projects and time entries (API_CONTRACT.md "Projects and time").
// Calls go through request() in client.ts (DELETE included).
import type { components } from './schema';
import { ApiError, api, request as send, withQuery, type Page, type Query } from './client';

type Schemas = components['schemas'];
export type ApiProject = Schemas['Project'];
export type ApiProjectWrite = Schemas['ProjectWriteRequest'];
export type ApiProjectPatch = Schemas['PatchedProjectWriteRequest'];
export type ApiBilling = Schemas['BillingEnum'];
export type ApiTimeEntry = Schemas['TimeEntry'];
export type ApiTimeEntryCreate = Schemas['TimeEntryCreateRequest'];
export type ApiTimeEntryPatch = Schemas['PatchedTimeEntryUpdateRequest'];
export type ApiTimerStart = Schemas['TimerStartRequest'];
export type ApiTimer = Schemas['Timer'];
export type ApiWeekSummary = Schemas['WeekSummary'];
export type ApiProjectWeek = Schemas['ProjectWeek'];

export const workApi = {
  /** Newest first, cursor pagination; `status` optional. */
  listProjects: (query?: Query<'listProjects'>): Promise<Page<ApiProject>> =>
    api.page<ApiProject>(withQuery('/api/projects', query)),
  getProject: (id: number) => send<ApiProject>('GET', `/api/projects/${id}`),
  createProject: (body: ApiProjectWrite) => send<ApiProject>('POST', '/api/projects', body),
  updateProject: (id: number, body: ApiProjectPatch) => send<ApiProject>('PATCH', `/api/projects/${id}`, body),

  /** Newest `date` first; `project`, `from`, `to` optional (dates inclusive). */
  listTimeEntries: (query?: Query<'listTimeEntries'>): Promise<Page<ApiTimeEntry>> =>
    api.page<ApiTimeEntry>(withQuery('/api/time-entries', query)),
  createTimeEntry: (body: ApiTimeEntryCreate) => send<ApiTimeEntry>('POST', '/api/time-entries', body),
  updateTimeEntry: (id: number, body: ApiTimeEntryPatch) =>
    send<ApiTimeEntry>('PATCH', `/api/time-entries/${id}`, body),
  /** 204; a running timer is discarded without recording minutes. */
  deleteTimeEntry: (id: number) => send<void>('DELETE', `/api/time-entries/${id}`),

  getTimer: () => send<ApiTimer>('GET', '/api/time-entries/timer'),
  /** Stops any running timer and starts a new entry dated today. */
  startTimer: (body: ApiTimerStart) => send<ApiTimeEntry>('POST', '/api/time-entries/timer/start', body),
  /** The stopped entry, or null when nothing was running (404). */
  stopTimer: async (): Promise<ApiTimeEntry | null> => {
    try {
      return await send<ApiTimeEntry>('POST', '/api/time-entries/timer/stop');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.reachable) return null;
      throw err;
    }
  },

  /** `week` is a Monday (YYYY-MM-DD); default this week. */
  getTimeSummary: (week?: string) =>
    send<ApiWeekSummary>('GET', withQuery('/api/time-entries/summary', { week })),
};
