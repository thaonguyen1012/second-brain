'use client';
import { ArrowRight } from 'lucide-react';
import type { ApiObjective, ApiWeek } from '@/lib/api/client';
import type { ApiAchievement, ApiOpportunityDecision, ApiReviewView, ApiRhythm } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { useInboxCount } from '../inbox-count';
import { type BookIndex, BodyOfWork } from './body-of-work';
import { ObjectivesEditor, type ObjectivesUpdate } from './objectives-editor';
import { ReviewAchievements, ReviewOpportunities, ReviewPredictions } from './review-extras';
import { ReviewJournal } from './review-journal';
import { CheckLink, CheckRow, RhythmRows } from './review-rhythm';
import { TimeChart } from './time-chart';
import { WeekSection } from './week-section';

/**
 * The checks of the 15-minute review in one list (DECISIONS 9.1, 6.5): inbox at 0, objectives done, the practice
 * rhythm (notes, brag lines, predictions due, month and quarter lines), then on to next week's plan.
 */
function ReviewChecklist({
  objectives,
  rhythm,
  onNextWeek,
}: {
  objectives: ApiObjective[];
  rhythm: ApiRhythm | null;
  onNextWeek?: () => void;
}) {
  const inbox = useInboxCount();
  const counted = objectives.filter((o) => o.status !== 'dropped');
  const done = counted.filter((o) => o.status === 'done').length;
  return (
    <ul className="flex flex-col divide-y rounded-xl border bg-card" aria-label="Kiểm tra cuối tuần">
      <CheckRow
        done={inbox === '0'}
        question="Inbox về 0 chưa?"
        value={inbox === null ? '–' : inbox === '0' ? 'Đã về 0' : `Còn ${inbox}`}
        action={inbox !== null && inbox !== '0' && <CheckLink href="/inbox/">Xử lý inbox</CheckLink>}
      />
      <CheckRow
        done={counted.length > 0 && done === counted.length}
        question="Mục tiêu xong"
        value={counted.length ? `${done}/${counted.length}` : 'Chưa có mục tiêu'}
      />
      {rhythm && <RhythmRows rhythm={rhythm} />}
      {onNextWeek && (
        <CheckRow
          done={false}
          question="3 ưu tiên tuần tới"
          action={
            <Button size="xs" variant="outline" onClick={onNextWeek}>
              Tuần tới
              <ArrowRight aria-hidden />
            </Button>
          }
        />
      )}
      {/* Below lg the six questions come after every section: one jump to them */}
      <li className="flex px-0.5 py-1 lg:hidden">
        <Button variant="link" size="sm" className="lg:hidden" render={<a href="#week-review-journal" />}>
          Trả lời 6 câu
        </Button>
      </li>
    </ul>
  );
}

/**
 * Review ritual (DECISIONS 9.1, 9.2): the checklist, then the left column to read (objectives with their hours
 * first, then hours, body of work, opportunities, brag lines, due predictions) and the six questions on the right.
 */
export function ReviewPanel({
  start,
  week,
  review,
  books,
  onWeek,
  onObjectives,
  onAchievement,
  onOpportunity,
  onNextWeek,
}: {
  start: string;
  week: ApiWeek;
  review: ApiReviewView;
  books: BookIndex;
  onWeek: (week: ApiWeek) => void;
  onObjectives: (update: ObjectivesUpdate) => void;
  onAchievement: (a: ApiAchievement) => void;
  onOpportunity: (id: number, decision: ApiOpportunityDecision) => void;
  onNextWeek?: () => void;
}) {
  const minutes = new Map(review.time.byObjective.map((o) => [o.id, o.minutes]));
  // The brag lines added in this review count at once (the server counts the same rows).
  const rhythm = review.rhythm ? { ...review.rhythm, achievements: review.achievements.length } : null;
  const { withEvidence, stale } = review.opportunities;
  return (
    <div className="flex flex-col gap-4">
      <ReviewChecklist objectives={week.objectives} rhythm={rhythm} onNextWeek={onNextWeek} />
      {/* Two surfaces side by side, each sized to its content (no empty band under the shorter one, §7): the
          sections to read on the left, divided by hairlines, the six questions on the right */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col divide-y rounded-xl border bg-card">
          <WeekSection id="week-review-objectives" title="Tiến độ mục tiêu">
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
          {/* Only when the server counts some due by Sunday; the section itself hides while none is due today */}
          {(rhythm?.predictionsDue ?? 1) > 0 && <ReviewPredictions />}
        </div>
        {/* The journal scrolls with the page (no inner scroll area): 'Lưu nhìn lại' is always reachable */}
        <div id="week-review-journal" className="min-w-0 scroll-mt-20 rounded-xl border bg-card">
          <ReviewJournal start={start} week={week} opportunities={review.opportunities} onSaved={onWeek} />
        </div>
      </div>
    </div>
  );
}
