'use client';
import { useCallback, useMemo } from 'react';
import { api, type ApiObjective, type Page } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { workApi, type ApiProject, type ApiTimeEntry, type ApiTimer, type ApiTimerStart } from '@/lib/api/work';

/** Picker order: open projects first (active, then planned), then by title. */
export function sortProjectChoices(list: ApiProject[]): ApiProject[] {
  const rank = (p: ApiProject) => (p.status === 'active' ? 0 : p.status === 'planned' ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'vi'));
}

/**
 * Projects for the pickers (timer, manual entry, filter): up to 200, open ones first, then by title.
 * `enabled` false skips the request (a page that already has the full list builds the choices itself).
 */
export function useProjectChoices(enabled = true) {
  const res = useApi<Page<ApiProject>>(enabled ? 'work:project-choices' : null, () =>
    workApi.listProjects({ limit: 200 }),
  );
  const projects = useMemo(() => sortProjectChoices(res.data?.results ?? []), [res.data]);
  return { ...res, projects };
}

/** Objectives of the current week (Week planning), for the optional "objective" of a time entry. */
export function useWeekObjectives() {
  const res = useApi('work:current-week', () => api.getCurrentWeek());
  const objectives: ApiObjective[] = res.data?.objectives ?? [];
  return { ...res, objectives, weekStart: res.data?.startDate };
}

/** The owner's running timer (GET /api/time-entries/timer), so it survives a reload. */
export function useTimer() {
  const res = useApi<ApiTimer>('work:timer', () => workApi.getTimer());
  const { mutate } = res;
  const start = useCallback(
    async (body: ApiTimerStart): Promise<ApiTimeEntry> => {
      const entry = await workApi.startTimer(body);
      mutate(() => ({ running: entry }));
      return entry;
    },
    [mutate],
  );
  const stop = useCallback(async (): Promise<ApiTimeEntry | null> => {
    const entry = await workApi.stopTimer();
    mutate(() => ({ running: null }));
    return entry;
  }, [mutate]);
  return { ...res, running: res.data?.running ?? null, start, stop };
}

export type TimerState = ReturnType<typeof useTimer>;
