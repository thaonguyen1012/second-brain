'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ApiWeek } from '@/lib/api/client';
import { type ApiReviewField, type ApiReviewPatch, type ApiWeekOpportunities, weeksApi } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/client';
import { useInvalidFields } from '../invalid-fields';
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
  const t = useT();
  const [answers, setAnswers] = useState<Answers>(() => answersOf(week));
  const [saved, setSaved] = useState<Answers>(() => answersOf(week));
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<unknown>(null);
  const invalid = useInvalidFields();
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
  const answered = reviewQuestions.filter((q) => saved[q.field].trim() !== '').length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** `focus`: a save asked for (Cmd/Ctrl+Enter, the button) takes the focus to a refused answer; one on blur never. */
  async function save(fields: ApiReviewField[], focus = false) {
    if (fields.length === 0) return;
    if (busy.current) {
      for (const f of fields) queued.current.add(f);
      return;
    }
    busy.current = true;
    setState('saving');
    setError(null);
    invalid.clear();
    const body: ApiReviewPatch = Object.fromEntries(fields.map((f) => [f, latest.current[f]]));
    try {
      const next = await weeksApi.saveReview(start, body);
      setSaved((s) => ({ ...s, ...body }));
      setReviewedAt(next.reviewedAt);
      setState('idle');
      onSaved(next);
    } catch (err) {
      setError(err);
      invalid.fromError(err, t, undefined, { focus });
      setState('error');
    } finally {
      busy.current = false;
    }
    const rest = [...queued.current];
    queued.current.clear();
    if (rest.length) void save(rest);
  }

  const suggestion = opportunities.withEvidence
    .map((o) =>
      t('{title}: +{supports} ủng hộ, {contradicts} phản bác', {
        title: o.title,
        supports: o.supports,
        contradicts: o.contradicts,
      }),
    )
    .join('\n');

  return (
    // The column around it carries id="week-review-journal" (the "Trả lời 6 câu" anchor), so the heading's id differs.
    <WeekSection
      id="week-review-journal-title"
      title={t('Nhật ký nhìn lại')}
      action={
        // Answers saved and the save state in one meta line; the save button shows below only while needed
        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {t('{answered}/{total} câu', { answered, total: reviewQuestions.length })}
          {state === 'saving' ? (
            ` · ${t('Đang lưu…')}`
          ) : dirty ? (
            <>
              {` · ${t('Chưa lưu')}`}
              {/* Key hint only where a keyboard is likely (DESIGN.md D24) */}
              <span className="max-sm:hidden pointer-coarse:hidden">
                {' · '}
                <SaveKeys /> {t('để lưu')}
              </span>
            </>
          ) : reviewedAt ? (
            ` · ${t('Đã lưu lúc {time}', { time: clockTime(reviewedAt, t) })}`
          ) : null}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {reviewQuestions.map((q, i) => {
          const id = `review-${q.field}`;
          const done = saved[q.field].trim() !== '';
          return (
            <div key={q.field} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-medium">
                {/* An answered (saved) question shows a check in place of its number */}
                <span className="flex w-4 shrink-0 justify-center self-center text-muted-foreground tabular-nums">
                  {done ? (
                    <>
                      <CheckCircle2 className="size-4 text-success-foreground" aria-hidden />
                      <span className="sr-only">{t('Đã trả lời:')} </span>
                    </>
                  ) : (
                    `${i + 1}.`
                  )}
                </span>
                {t(q.label)}
              </label>
              {/* The hint is the placeholder; screen readers get it as the description too */}
              {q.hint && (
                <p id={`${id}-hint`} className="sr-only">
                  {t(q.hint)}
                </p>
              )}
              <Textarea
                id={id}
                {...invalid.field(q.field, q.hint ? `${id}-hint` : undefined)}
                placeholder={q.hint ? t(q.hint) : undefined}
                className="[&_textarea]:min-h-8.5"
                value={answers[q.field]}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.field]: e.target.value }))}
                onBlur={() => answers[q.field] !== saved[q.field] && void save([q.field])}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void save(dirtyFields, true);
                  }
                }}
                rows={1}
              />
              {q.field === 'reviewOpportunityEvidence' && suggestion && !answers[q.field].trim() && (
                <Button
                  size="xs"
                  variant="outline"
                  className="self-start"
                  onClick={() => setAnswers((a) => ({ ...a, [q.field]: suggestion }))}
                >
                  {t('Chèn các cơ hội có bằng chứng tuần này')}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {/* Same as Kế hoạch's save (DESIGN.md D2, §1.5): outline, shown only while there is something to save; each
          field also saves on blur and with Cmd/Ctrl+Enter, so nothing blue sits idle at the end of the journal. */}
      {(dirty || state === 'saving') && (
        <div className="flex">
          <Button variant="outline" size="sm" onClick={() => void save(dirtyFields, true)} loading={state === 'saving'}>
            {t('Lưu nhìn lại')}
          </Button>
        </div>
      )}
      <WriteError error={error} />
      {invalid.copies}
    </WeekSection>
  );
}
