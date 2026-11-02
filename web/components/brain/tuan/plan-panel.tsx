'use client';
import { useState } from 'react';
import { ArrowRightLeft, NotebookPen, Target } from 'lucide-react';
import type { ApiWeek } from '@/lib/api/client';
import { type ApiCarryCandidate, weeksApi } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
            Kéo {chosen.length} mục tiêu sang {weekName}
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
      title={`Kỳ vọng cho ${weekName}`}
      description={`Vài dòng: ${weekName} mong điều gì, sợ điều gì, bận gì ngoài kế hoạch. Không lên task ở đây.`}
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
                placeholder={`${weekName.charAt(0).toUpperCase()}${weekName.slice(1)} mình mong...`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void save()} disabled={!dirty} loading={busy}>
          Lưu kế hoạch
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {dirty ? (
            <>
              Chưa lưu · <SaveKeys /> để lưu
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
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-4">
        {carryCandidates.length > 0 && <CarryOver start={start} weekName={weekName} candidates={carryCandidates} onCarried={onCarried} />}
        <WeekSection icon={Target} id="week-objectives" title="Mục tiêu tuần">
          <ObjectiveHint objectives={week.objectives} />
          <ObjectivesEditor start={start} objectives={week.objectives} onChange={onObjectives} />
        </WeekSection>
      </div>
      <PlanJournal start={start} weekName={weekName} week={week} onSaved={onWeek} />
    </div>
  );
}
