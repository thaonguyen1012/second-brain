// Typed calls for "Phát triển": skills matrix, market (job ads + monthly report), brag document, predictions.
// Calls go through request() in client.ts; browser only.
import type { components } from './schema';
import { api, request as send, withQuery, type Page, type Query } from './client';

type Schemas = components['schemas'];
export type ApiSkill = Schemas['Skill'];
export type ApiSkillDetail = Schemas['SkillDetail'];
export type ApiSkillWrite = Schemas['SkillWriteRequest'];
export type ApiSkillEvidence = Schemas['SkillEvidence'];
export type ApiSkillEvidenceCreate = Schemas['SkillEvidenceCreateRequest'];
export type ApiSkillEvidencePatch = Schemas['PatchedSkillEvidenceUpdateRequest'];
export type ApiEvidenceKind = Schemas['SkillEvidenceKindEnum'];
export type ApiFreshness = Schemas['SkillFreshnessEnum'];
export type ApiJobAd = Schemas['JobAd'];
export type ApiJobAdWrite = Schemas['JobAdWriteRequest'];
export type ApiJobAdPatch = Schemas['PatchedJobAdWriteRequest'];
export type ApiSeniority = Schemas['SeniorityEnum'];
export type ApiMarketReport = Schemas['MarketReport'];
export type ApiMarketSkill = Schemas['MarketSkill'];
export type ApiAchievement = Schemas['Achievement'];
export type ApiAchievementWrite = Schemas['AchievementWriteRequest'];
export type ApiAchievementPatch = Schemas['PatchedAchievementWriteRequest'];
export type ApiPrediction = Schemas['Prediction'];
export type ApiPredictionWrite = Schemas['PredictionWriteRequest'];
export type ApiPredictionPatch = Schemas['PatchedPredictionWriteRequest'];
export type ApiOutcome = Schemas['PredictionOutcomeEnum'];
export type ApiNote = Schemas['Note'];

/** First page of a cursor list (api.page does the GET and keeps `next` same-origin). */
const list = <T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<Page<T>> =>
  api.page<T>(withQuery(path, query));

/** Every page of a list, for short owner lists (the skills matrix, pickers). Stops after `max` rows. */
export async function listAll<T>(first: Promise<Page<T>>, max = 1000): Promise<T[]> {
  let page = await first;
  const rows = [...page.results];
  while (page.next && rows.length < max) {
    page = await api.page<T>(page.next);
    rows.push(...page.results);
  }
  return rows;
}

const skillPath = (id: number) => `/api/skills/${id}`;

export const growthApi = {
  listSkills: (query?: Query<'listSkills'>) => list<ApiSkill>('/api/skills', query),
  getSkill: (id: number) => send<ApiSkillDetail>('GET', skillPath(id)),
  createSkill: (body: ApiSkillWrite) => send<ApiSkillDetail>('POST', '/api/skills', body),
  updateSkill: (id: number, body: Partial<ApiSkillWrite>) => send<ApiSkillDetail>('PATCH', skillPath(id), body),
  addSkillEvidence: (id: number, body: ApiSkillEvidenceCreate) =>
    send<ApiSkillEvidence>('POST', `${skillPath(id)}/evidence`, body),
  updateSkillEvidence: (id: number, evidenceId: number, body: ApiSkillEvidencePatch) =>
    send<ApiSkillEvidence>('PATCH', `${skillPath(id)}/evidence/${evidenceId}`, body),
  deleteSkillEvidence: (id: number, evidenceId: number) =>
    send<void>('DELETE', `${skillPath(id)}/evidence/${evidenceId}`),

  listJobAds: (query?: Query<'listJobAds'>) => list<ApiJobAd>('/api/market/job-ads', query),
  getJobAd: (id: number) => send<ApiJobAd>('GET', `/api/market/job-ads/${id}`),
  createJobAd: (body: ApiJobAdWrite) => send<ApiJobAd>('POST', '/api/market/job-ads', body),
  updateJobAd: (id: number, body: ApiJobAdPatch) => send<ApiJobAd>('PATCH', `/api/market/job-ads/${id}`, body),
  deleteJobAd: (id: number) => send<void>('DELETE', `/api/market/job-ads/${id}`),
  getMarketReport: (month?: string) => send<ApiMarketReport>('GET', withQuery('/api/market/report', { month })),

  listAchievements: (query?: Query<'listAchievements'>) => list<ApiAchievement>('/api/achievements', query),
  getAchievement: (id: number) => send<ApiAchievement>('GET', `/api/achievements/${id}`),
  createAchievement: (body: ApiAchievementWrite) => send<ApiAchievement>('POST', '/api/achievements', body),
  updateAchievement: (id: number, body: ApiAchievementPatch) =>
    send<ApiAchievement>('PATCH', `/api/achievements/${id}`, body),
  deleteAchievement: (id: number) => send<void>('DELETE', `/api/achievements/${id}`),

  listPredictions: (query?: Query<'listPredictions'>) => list<ApiPrediction>('/api/predictions', query),
  getPrediction: (id: number) => send<ApiPrediction>('GET', `/api/predictions/${id}`),
  createPrediction: (body: ApiPredictionWrite) => send<ApiPrediction>('POST', '/api/predictions', body),
  updatePrediction: (id: number, body: ApiPredictionPatch) =>
    send<ApiPrediction>('PATCH', `/api/predictions/${id}`, body),
  deletePrediction: (id: number) => send<void>('DELETE', `/api/predictions/${id}`),

  /** Library notes, for the "ghi chú" evidence picker. */
  listNotes: (query?: Query<'listNotes'>) => list<ApiNote>('/api/notes', query),
};
