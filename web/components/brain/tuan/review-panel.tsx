'use client';
import type { ApiWeek } from '@/lib/api/client';
import type { ApiAchievement, ApiOpportunityDecision, ApiReviewView } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { type BookIndex, BodyOfWork } from './body-of-work';
import { ObjectivesEditor, type ObjectivesUpdate } from './objectives-editor';
import { ReviewAchievements, ReviewOpportunities, ReviewPredictions } from './review-extras';
import { ReviewJournal } from './review-journal';
import { CheckRow, checkProgress, type ReviewCheck } from './review-rhythm';
import { TimeChart } from './time-chart';
import { WeekSection } from './week-section';

/**
 * The checks of the 15-minute review in one list (DECISIONS 9.1, 6.5) under a header with their progress in the
 * data blue (DESIGN.md §9a, D31: a count and a bar, no badge). The first open check's button is the region's one
 * filled button (D2); finished rows are muted.
 */
function ReviewChecklist({ checks, className }: { checks: ReviewCheck[]; className?: string }) {
  const { done, total } = checkProgress(checks);
  const primary = checks.find((c) => !c.done && c.action)?.key;
  return (
    <section aria-labelledby="week-checks" className={cn('min-w-0 rounded-xl border bg-card', className)}>
      <div className="flex min-h-12 items-center gap-3 border-b px-4 py-2 sm:px-6">
        <h2 id="week-checks" className="font-heading text-[15px] font-semibold tracking-tight">
          Kiểm tra cuối tuần
        </h2>
        <Progress
          value={done}
          max={total}
          aria-label="Tiến độ kiểm tra cuối tuần"
          getAriaValueText={() => `${done}/${total} bước`}
          className="ms-auto w-20 sm:w-32"
        >
          <ProgressTrack>
            <ProgressIndicator className="bg-chart-data duration-200 motion-reduce:transition-none" />
          </ProgressTrack>
        </Progress>
        <span className="text-xs text-muted-foreground tabular-nums" aria-hidden>
          {done}/{total}
        </span>
      </div>
      <ul className="flex flex-col divide-y">
        {checks.map((c) => (
          <CheckRow key={c.key} check={c} primary={c.key === primary} />
        ))}
      </ul>
      {/* Below xl the six questions come after every section: one jump to them. Outside the list, so at xl the last
          check gets no divider of its own just above the surface's border. */}
      <div className="flex border-t px-1.5 py-1 sm:px-3.5 xl:hidden">
        <Button variant="link" size="sm" render={<a href="#week-review-journal" />}>
          Trả lời 6 câu
        </Button>
      </div>
    </section>
  );
}

/**
 * Review ritual (DECISIONS 9.1, 9.2). From xl two columns: the ritual on the left (the checklist, then the six
 * questions), the sections to read on the right (objectives with their hours, hours, body of work, opportunities,
 * brag lines, due predictions), each surface sized to its content (§7). Below xl one column (the page caps it at
 * max-w-3xl), in reading order: checklist, sections, questions.
 */
export function ReviewPanel({
  start,
  week,
  review,
  books,
  checks,
  onWeek,
  onObjectives,
  onAchievement,
  onOpportunity,
  onPlan,
}: {
  start: string;
  week: ApiWeek;
  review: ApiReviewView;
  books: BookIndex;
  checks: ReviewCheck[];
  onWeek: (week: ApiWeek) => void;
  onObjectives: (update: ObjectivesUpdate) => void;
  onAchievement: (a: ApiAchievement) => void;
  onOpportunity: (id: number, decision: ApiOpportunityDecision) => void;
  /** Switches to the Kế hoạch tab */
  onPlan: () => void;
}) {
  const minutes = new Map(review.time.byObjective.map((o) => [o.id, o.minutes]));
  const { withEvidence, stale } = review.opportunities;
  // Only when the server counts some due by Sunday; the section itself hides while none is due today.
  const predictionsDue = review.rhythm?.predictionsDue ?? 1;
  return (
    // The reading column is a little wider: an objective row keeps its badges on one line at 1280
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-rows-[auto_1fr] xl:items-start">
      <ReviewChecklist checks={checks} className="xl:col-start-1 xl:row-start-1" />
      <div className="flex min-w-0 flex-col divide-y rounded-xl border bg-card xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <WeekSection
          id="week-review-objectives"
          title="Tiến độ mục tiêu"
          action={
            week.objectives.length === 0 && (
              <Button size="xs" variant="ghost" onClick={onPlan}>
                Đặt mục tiêu
              </Button>
            )
          }
        >
          {week.objectives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tuần này không có mục tiêu nào.</p>
          ) : (
            <ObjectivesEditor
              start={start}
              objectives={week.objectives}
              onChange={onObjectives}
              minutes={minutes}
              allowAdd={false}
            />
          )}
        </WeekSection>
        <TimeChart days={review.days} time={review.time} />
        <BodyOfWork days={review.days} books={books} />
        {(withEvidence.length > 0 || stale.length > 0) && (
          <ReviewOpportunities opportunities={review.opportunities} onDecided={onOpportunity} />
        )}
        <ReviewAchievements start={start} achievements={review.achievements} onAdded={onAchievement} />
        {predictionsDue > 0 && <ReviewPredictions />}
      </div>
      {/* The journal scrolls with the page (no inner scroll area): 'Lưu nhìn lại' is always reachable */}
      <div
        id="week-review-journal"
        className="min-w-0 scroll-mt-20 rounded-xl border bg-card xl:col-start-1 xl:row-start-2"
      >
        <ReviewJournal start={start} week={week} opportunities={review.opportunities} onSaved={onWeek} />
      </div>
    </div>
  );
}
