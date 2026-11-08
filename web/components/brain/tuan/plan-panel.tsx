'use client';
import { useState } from 'react';
import type { ApiWeek } from '@/lib/api/client';
import { type ApiCarryCandidate, weeksApi } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/client';
import { ObjectiveHint, ObjectivesEditor, type ObjectivesUpdate } from './objectives-editor';
import { WeekSection, WriteError } from './week-section';
import { clockTime, weekRange } from './week-utils';
import { SaveKeys } from '../save-keys';

/** Last week's open objectives: tick the ones that still matter and carry them over in one action. */
function CarryOver({
  start,
  weekName,
  candidates,
  onCarried,
}: {
  start: string;
  weekName: string;
  candidates: ApiCarryCandidate[];
  onCarried: (week: ApiWeek, carried: number[]) => void;
}) {
  const t = useT();
  const pending = candidates.filter((c) => !c.carried);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(pending.map((c) => c.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const chosen = pending.filter((c) => picked.has(c.id)).map((c) => c.id);

  async function carry() {
    setBusy(true);
    setError(null);
    try {
      const week = await weeksApi.plan(start, { carry: chosen });
      onCarried(week, chosen);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    // The source week goes in the title; no how-to line under it (DESIGN.md §7).
    <WeekSection
      id="week-carry"
      title={t('Mục tiêu còn mở của tuần {range}', { range: weekRange(candidates[0].weekStart) })}
    >
      <ul className="flex flex-col divide-y">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2.5 py-2 text-sm has-data-disabled:cursor-default">
              <Checkbox
                checked={c.carried || picked.has(c.id)}
                disabled={c.carried}
                onCheckedChange={(on) =>
                  setPicked((s) => {
                    const next = new Set(s);
                    if (on) next.add(c.id);
                    else next.delete(c.id);
                    return next;
                  })
                }
              />
              <span className={c.carried ? 'flex-1 text-muted-foreground' : 'flex-1'}>{c.title}</span>
              {c.carried && <span className="text-xs text-muted-foreground">{t('Đã kéo sang')}</span>}
            </label>
          </li>
        ))}
      </ul>
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-auto min-h-9 max-w-full whitespace-normal py-1 text-start sm:h-auto sm:min-h-8"
            onClick={() => void carry()}
            disabled={chosen.length === 0}
            loading={busy}
          >
            {t('Kéo {n} mục tiêu sang {week}', { n: chosen.length, week: weekName })}
          </Button>
        </div>
      )}
      <WriteError error={error} />
    </WeekSection>
  );
}

/** "Kỳ vọng cho tuần này" (or "tuần tới"): the planning journal, saved with POST /plan. */
function PlanJournal({
  start,
  weekName,
  week,
  onSaved,
}: {
  start: string;
  weekName: string;
  week: ApiWeek;
  onSaved: (week: ApiWeek) => void;
}) {
  const t = useT();
  const [text, setText] = useState(week.planningJournal);
  const [saved, setSaved] = useState(week.planningJournal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = text !== saved;
  const hope = t('{week} mình mong...', { week: weekName });

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await weeksApi.plan(start, { planningJournal: text });
      setSaved(next.planningJournal);
      onSaved(next);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WeekSection id="week-plan-journal" title={t('Kỳ vọng cho {week}', { week: weekName })}>
      <Textarea
        aria-labelledby="week-plan-journal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void save();
          }
        }}
        rows={6}
        placeholder={`${hope.charAt(0).toUpperCase()}${hope.slice(1)}`}
      />
      {/* Quiet at rest (DESIGN.md D2, §1.2): the objectives are the focal point, so the save button is outline
          and appears only while there is something to save; Cmd/Ctrl+Enter in the field saves too. */}
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {dirty && (
          <Button variant="outline" size="sm" onClick={() => void save()} loading={busy}>
            {t('Lưu kế hoạch')}
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? (
            <>
              {t('Chưa lưu')}
              {/* Key hint only where a keyboard is likely (DESIGN.md D24) */}
              <span className="max-sm:hidden pointer-coarse:hidden">
                {' · '}
                <SaveKeys /> {t('để lưu')}
              </span>
            </>
          ) : week.plannedAt ? (
            t('Đã lên kế hoạch lúc {time}', { time: clockTime(week.plannedAt, t) })
          ) : (
            t('Chưa lên kế hoạch')
          )}
        </span>
      </div>
      <WriteError error={error} />
    </WeekSection>
  );
}

/** Planning ritual (DECISIONS 9.2, Sunsama): carry over, 3–5 objectives, the expectations journal. No tasks. */
export function PlanPanel({
  start,
  weekName,
  week,
  carryCandidates,
  onWeek,
  onObjectives,
  onCarried,
}: {
  start: string;
  /** How to name this week in sentences: "tuần này", "tuần tới" or "tuần 9/11 – 15/11". */
  weekName: string;
  week: ApiWeek;
  carryCandidates: ApiCarryCandidate[];
  onWeek: (week: ApiWeek) => void;
  onObjectives: (update: ObjectivesUpdate) => void;
  onCarried: (week: ApiWeek, carried: number[]) => void;
}) {
  const t = useT();
  return (
    // One surface for the ritual (DESIGN.md D12): objectives on the left, the journal on the right, a hairline
    // between them; the shorter column no longer leaves a floating card above an empty band. Two columns from xl,
    // where the page lifts its max-w-3xl reading cap.
    <div className="grid rounded-xl border bg-card xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col divide-y">
        {carryCandidates.length > 0 && <CarryOver start={start} weekName={weekName} candidates={carryCandidates} onCarried={onCarried} />}
        <WeekSection id="week-objectives" title={t('Mục tiêu tuần')}>
          <ObjectiveHint objectives={week.objectives} />
          <ObjectivesEditor start={start} objectives={week.objectives} onChange={onObjectives} />
        </WeekSection>
      </div>
      <div className="min-w-0 border-t xl:border-t-0 xl:border-l">
        <PlanJournal start={start} weekName={weekName} week={week} onSaved={onWeek} />
      </div>
    </div>
  );
}
