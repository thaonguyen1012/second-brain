'use client';
import { useState } from 'react';
import { ArrowRightLeft, NotebookPen, Target } from 'lucide-react';
import type { ApiObjective, ApiWeek } from '@/lib/api/client';
import { type ApiCarryCandidate, weeksApi } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Kbd } from '@/components/ui/kbd';
import { Textarea } from '@/components/ui/textarea';
import { ObjectiveHint, ObjectivesEditor } from './objectives-editor';
import { WeekSection, WriteError } from './week-section';
import { clockTime, weekRange } from './week-utils';

/** Last week's open objectives: tick the ones that still matter and carry them over in one action. */
function CarryOver({
  start,
  candidates,
  onCarried,
}: {
  start: string;
  candidates: ApiCarryCandidate[];
  onCarried: (week: ApiWeek, carried: number[]) => void;
}) {
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
    <WeekSection
      icon={ArrowRightLeft}
      id="week-carry"
      title="Kéo mục tiêu chưa xong sang"
      description={`Mục tiêu còn mở của tuần ${weekRange(candidates[0].weekStart)}. Bỏ chọn cái không còn quan trọng.`}
    >
      <ul className="flex flex-col gap-1.5">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm has-data-disabled:cursor-default">
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
              {c.carried && <span className="text-xs text-muted-foreground">Đã kéo sang</span>}
            </label>
          </li>
        ))}
      </ul>
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void carry()} disabled={chosen.length === 0} loading={busy}>
            Kéo {chosen.length} mục tiêu sang tuần này
          </Button>
        </div>
      )}
      <WriteError error={error} />
    </WeekSection>
  );
}

/** "Kỳ vọng cho tuần này": the planning journal, saved with POST /plan. */
function PlanJournal({ start, week, onSaved }: { start: string; week: ApiWeek; onSaved: (week: ApiWeek) => void }) {
  const [text, setText] = useState(week.planningJournal);
  const [saved, setSaved] = useState(week.planningJournal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const dirty = text !== saved;

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
    <WeekSection
      icon={NotebookPen}
      id="week-plan-journal"
      title="Kỳ vọng cho tuần này"
      description="Vài dòng: tuần này mong điều gì, sợ điều gì, bận gì ngoài kế hoạch. Không lên task ở đây."
    >
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
        placeholder="Tuần này mình mong..."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={!dirty} loading={busy}>
          Lưu kế hoạch
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? (
            <>
              Chưa lưu · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> để lưu
            </>
          ) : week.plannedAt ? (
            `Đã lên kế hoạch lúc ${clockTime(week.plannedAt)}`
          ) : (
            'Chưa lên kế hoạch'
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
  week,
  carryCandidates,
  onWeek,
  onObjectives,
  onCarried,
}: {
  start: string;
  week: ApiWeek;
  carryCandidates: ApiCarryCandidate[];
  onWeek: (week: ApiWeek) => void;
  onObjectives: (objectives: ApiObjective[]) => void;
  onCarried: (week: ApiWeek, carried: number[]) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        {carryCandidates.length > 0 && <CarryOver start={start} candidates={carryCandidates} onCarried={onCarried} />}
        <WeekSection icon={Target} id="week-objectives" title="Mục tiêu tuần">
          <ObjectiveHint objectives={week.objectives} />
          <ObjectivesEditor start={start} objectives={week.objectives} onChange={onObjectives} />
        </WeekSection>
      </div>
      <PlanJournal start={start} week={week} onSaved={onWeek} />
    </div>
  );
}
