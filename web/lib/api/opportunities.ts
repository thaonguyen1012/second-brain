// Typed calls for the Cơ hội pages: /api/opportunities*, /api/skills (fit picker) and /api/news/topics.
// Reads and writes go through request() in client.ts.
import { api, request as send, withQuery, type Query } from './client';
import type { components } from './schema';

type Schemas = components['schemas'];
export type ApiOpportunityDetail = Schemas['OpportunityDetail'];
export type ApiOpportunityCreate = Schemas['OpportunityCreateRequest'];
export type ApiOpportunityPatch = Schemas['PatchedOpportunityWriteRequest'];
export type ApiDecision = Schemas['OpportunityDecisionEnum'];
export type ApiEvidence = Schemas['Evidence'];
export type ApiEvidenceKind = Schemas['EvidenceKindEnum'];
export type ApiEvidenceCreate = Schemas['EvidenceCreateRequest'];
export type ApiEvidencePatch = Schemas['PatchedEvidenceUpdateRequest'];
export type ApiScores = Schemas['ScoresWriteRequest'];
export type ApiScoreSnapshot = Schemas['ScoreSnapshot'];
export type ApiFitSkill = Schemas['FitSkill'];
export type ApiSkill = Schemas['Skill'];
export type ApiSkillFreshness = Schemas['SkillFreshnessEnum'];
export type ApiTopicCounts = Schemas['TopicCounts'];
export type ApiTopicWeek = Schemas['TopicWeek'];

const base = (id: number) => `/api/opportunities/${id}`;

export const opportunitiesApi = {
  /** The list itself is `api.listOpportunities` (client.ts). */
  get: (id: number) => send<ApiOpportunityDetail>('GET', base(id)),
  create: (body: ApiOpportunityCreate) => send<ApiOpportunityDetail>('POST', '/api/opportunities', body),
  update: (id: number, body: ApiOpportunityPatch) => send<ApiOpportunityDetail>('PATCH', base(id), body),

  /** A new snapshot (all four 1-10); older ones never change. */
  recordScores: (id: number, body: ApiScores) => send<ApiScoreSnapshot>('POST', `${base(id)}/scores`, body),

  addEvidence: (id: number, body: ApiEvidenceCreate) => send<ApiEvidence>('POST', `${base(id)}/evidence`, body),
  updateEvidence: (id: number, evidenceId: number, body: ApiEvidencePatch) =>
    send<ApiEvidence>('PATCH', `${base(id)}/evidence/${evidenceId}`, body),
  deleteEvidence: (id: number, evidenceId: number) => send<void>('DELETE', `${base(id)}/evidence/${evidenceId}`),

  /** Skills by name for the "hợp với mình" picker (one page, up to 200). */
  listSkills: (query: Query<'listSkills'> = { limit: 200 }) => api.page<ApiSkill>(withQuery('/api/skills', query)),

  /** Topic tag counts of the morning-brief news per ISO week, oldest first (1-52 weeks). */
  topicCounts: (weeks = 8) => send<ApiTopicCounts>('GET', `/api/news/topics?weeks=${weeks}`),
};
