'use client';
import { useEffect, useRef, useState } from 'react';
import type { ApiWeek } from '@/lib/api/client';
import { type ApiReviewField, type ApiReviewPatch, type ApiWeekOpportunities, weeksApi } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { WeekSection, WriteError } from './week-section';
import { clockTime, reviewQuestions } from './week-utils';
import { SaveKeys } from '../save-keys';

type Answers = Record<ApiReviewField, string>;

function answersOf(week: ApiWeek): Answers {
  return Object.fromEntries(reviewQuestions.map((q) => [q.field, week[q.field] ?? ''])) as Answers;
}

/**
 * The six review questions. Each answer is saved when the field loses focus (PATCH with only the changed
 * fields), Ctrl/Cmd+Enter saves everything; nothing typed is lost when leaving the page with unsaved text.
 */
export function ReviewJournal({
  start,
  week,
  opportunities,
  onSaved,
}: {
  start: string;
  week: ApiWeek;
  opportunities: ApiWeekOpportunities;
  onSaved: (week: ApiWeek) => void;
}) {
  const [answers, setAnswers] = useState<Answers>(() => answersOf(week));
  const [saved, setSaved] = useState<Answers>(() => answersOf(week));
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<unknown>(null);
  const [reviewedAt, setReviewedAt] = useState(week.reviewedAt);
  const busy = useRef(false);
  // A blur while a save is running queues its fields; they are sent with the latest text right after.
  const queued = useRef(new Set<ApiReviewField>());
  const latest = useRef(answers);
  useEffect(() => {
    latest.current = answers;
  });

  const dirtyFields = reviewQuestions.map((q) => q.field).filter((f) => answers[f] !== saved[f]);
  const dirty = dirtyFields.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(fields: ApiReviewField[]) {
    if (fields.length === 0) return;
    if (busy.current) {
      for (const f of fields) queued.current.add(f);
      return;
    }
    busy.current = true;
    setState('saving');
    setError(null);
    const body: ApiReviewPatch = Object.fromEntries(fields.map((f) => [f, latest.current[f]]));
    try {
      const next = await weeksApi.saveReview(start, body);
      setSaved((s) => ({ ...s, ...body }));
      setReviewedAt(next.reviewedAt);
      setState('idle');
      onSaved(next);
    } catch (err) {
      setError(err);
      setState('error');
    } finally {
      busy.current = false;
    }
    const rest = [...queued.current];
    queued.current.clear();
    if (rest.length) void save(rest);
  }

  const suggestion = opportunities.withEvidence
    .map((o) => `${o.title}: +${o.supports} ủng hộ, ${o.contradicts} phản bác`)
    .join('\n');

  return (
    // The column around it carries id="week-review-journal" (the "Trả lời 6 câu" anchor), so the heading's id differs.
    <WeekSection id="week-review-journal-title" title="Nhật ký nhìn lại">
      <div className="flex flex-col gap-4">
        {reviewQuestions.map((q, i) => {
          const id = `review-${q.field}`;
          return (
            <div key={q.field} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium">
                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                {q.label}
              </label>
              {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
              <Textarea
                id={id}
                value={answers[q.field]}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.field]: e.target.value }))}
                onBlur={() => answers[q.field] !== saved[q.field] && void save([q.field])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void save(dirtyFields);
                  }
                }}
                rows={3}
              />
              {q.field === 'reviewOpportunityEvidence' && suggestion && !answers[q.field].trim() && (
                <Button
                  size="xs"
                  variant="outline"
                  className="self-start"
                  onClick={() => setAnswers((a) => ({ ...a, [q.field]: suggestion }))}
                >
                  Chèn các cơ hội có bằng chứng tuần này
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {/* Same as Kế hoạch's save (DESIGN.md D2, §1.5): outline, shown only while there is something to save; each
          field also saves on blur and with Cmd/Ctrl+Enter, so nothing blue sits idle at the end of the journal. */}
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {(dirty || state === 'saving') && (
          <Button variant="outline" size="sm" onClick={() => void save(dirtyFields)} loading={state === 'saving'}>
            Lưu nhìn lại
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {state === 'saving' ? (
            'Đang lưu…'
          ) : dirty ? (
            <>
              Chưa lưu
              {/* Key hint only where a keyboard is likely (DESIGN.md D24) */}
              <span className="max-sm:hidden pointer-coarse:hidden">
                {' · '}
                <SaveKeys /> để lưu
              </span>
            </>
          ) : reviewedAt ? (
            `Đã lưu lúc ${clockTime(reviewedAt)}`
          ) : (
            'Chưa nhìn lại tuần này'
          )}
        </span>
      </div>
      <WriteError error={error} />
    </WeekSection>
  );
}
