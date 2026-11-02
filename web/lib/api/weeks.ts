// Typed calls for the Tuần page: /api/weeks* (planning and review) and the quick brag-document line of the
// review (/api/achievements). Calls go through request() in client.ts.
import { ApiError, request as send, type ApiObjective, type ApiWeek } from './client';
import type { components } from './schema';

type Schemas = components['schemas'];
export type ApiPlanView = Schemas['PlanView'];
export type ApiCarryCandidate = Schemas['CarryCandidate'];
export type ApiReviewView = Schemas['ReviewView'];
export type ApiDayWork = Schemas['DayWork'];
export type ApiWeekTime = Schemas['WeekTime'];
export type ApiWeekOpportunities = Schemas['WeekOpportunities'];
export type ApiObjectiveStatus = Schemas['ObjectiveStatusEnum'];
export type ApiObjectivePatch = Schemas['PatchedObjectiveUpdateRequest'];
export type ApiReviewPatch = Schemas['PatchedReviewUpdateRequest'];
export type ApiReviewField = keyof ApiReviewPatch;
export type ApiAchievement = Schemas['Achievement'];
export type ApiAchievementCreate = Schemas['AchievementWriteRequest'];
export type ApiOpportunityDecision = Schemas['OpportunityDecisionEnum'];
/** Practice-rhythm counts of the review (DECISIONS 6.5); month / quarter only on the first review of one. */
export type ApiRhythm = Schemas['Rhythm'];

/** `start` is the week's Monday as YYYY-MM-DD. */
const base = (start: string) => `/api/weeks/${encodeURIComponent(start)}`;

export const weeksApi = {
  /** The week (created on first access) and the previous week's open objectives to carry over. */
  getPlan: (start: string) => send<ApiPlanView>('GET', `${base(start)}/plan`),
  /** Carries the chosen objectives over (idempotent) and/or saves the planning journal. */
  plan: (start: string, body: Schemas['PlanRequest']) => send<ApiWeek>('POST', `${base(start)}/plan`, body),

  /** Review data; null when the week was never opened (404 from Django). */
  getReview: async (start: string): Promise<ApiReviewView | null> => {
    try {
      return await send<ApiReviewView>('GET', `${base(start)}/review`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.reachable) return null;
      throw err;
    }
  },
  /** Saves any of the six journal answers and sets reviewedAt. */
  saveReview: (start: string, body: ApiReviewPatch) => send<ApiWeek>('PATCH', `${base(start)}/review`, body),

  addObjective: (start: string, title: string) =>
    send<ApiObjective>('POST', `${base(start)}/objectives`, { title } satisfies Schemas['ObjectiveCreateRequest']),
  updateObjective: (start: string, id: number, body: ApiObjectivePatch) =>
    send<ApiObjective>('PATCH', `${base(start)}/objectives/${id}`, body),
  /** Objectives carried from it stay (their carriedFrom becomes null). */
  deleteObjective: (start: string, id: number) => send<void>('DELETE', `${base(start)}/objectives/${id}`),

  /** One brag-document line (only `title` required; `date` defaults to today on the server). */
  addAchievement: (body: ApiAchievementCreate) => send<ApiAchievement>('POST', '/api/achievements', body),
};
