'use client';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Inbox, Target } from 'lucide-react';
import type { ApiObjective, ApiWeek } from '@/lib/api/client';
import type { ApiAchievement, ApiOpportunityDecision, ApiReviewView } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInboxCount } from '../inbox-count';
import { type BookIndex, BodyOfWork } from './body-of-work';
import { ObjectivesEditor, type ObjectivesUpdate } from './objectives-editor';
import { ReviewAchievements, ReviewOpportunities, ReviewPredictions } from './review-extras';
import { ReviewJournal } from './review-journal';
import { ReviewRhythm } from './review-rhythm';
import { TimeChart } from './time-chart';
import { WeekSection } from './week-section';

function Step({ label, value, done, children }: { label: string; value: string; done: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1 rounded-2xl bg-secondary p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('font-heading text-xl font-semibold tabular-nums', done && 'text-success-foreground')}>
        {value}
      </span>
      {children}
    </div>
  );
}

/** The questions of the 15-minute review at a glance (DECISIONS 9.1): inbox at 0, objectives done. */
function ReviewChecklist({ objectives, onNextWeek }: { objectives: ApiObjective[]; onNextWeek?: () => void }) {
  const inbox = useInboxCount();
  const counted = objectives.filter((o) => o.status !== 'dropped');
  const done = counted.filter((o) => o.status === 'done').length;
  return (
    <Card className="flex flex-col gap-3 rounded-3xl border p-2 shadow-depth-1">
      <div className="flex flex-wrap gap-2">
        <Step label="Inbox về 0 chưa?" value={inbox === null ? '–' : inbox === '0' ? 'Đã về 0' : `Còn ${inbox}`} done={inbox === '0'}>
          {inbox !== null && inbox !== '0' && (
            <Button size="xs" variant="outline" className="self-start" render={<Link href="/inbox/" />}>
              <Inbox aria-hidden />
              Xử lý inbox
            </Button>
          )}
        </Step>
        <Step
          label="Mục tiêu xong"
          value={counted.length ? `${done}/${counted.length}` : '–'}
          done={counted.length > 0 && done === counted.length}
        />
        {onNextWeek && (
          <Step label="3 ưu tiên tuần tới" value="Lên kế hoạch" done={false}>
            <Button size="xs" className="self-start" onClick={onNextWeek}>
              <CalendarPlus aria-hidden />
              Tuần tới
              <ArrowRight aria-hidden />
            </Button>
          </Step>
        )}
      </div>
    </Card>
  );
}

/**
 * Review ritual (DECISIONS 9.1, 9.2): read the left column (objectives, hours, body of work, opportunities,
 * brag lines) and answer the six questions on the right, which stays in view on wide screens.
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
  return (
    <div className="flex flex-col gap-4">
      <ReviewChecklist objectives={week.objectives} onNextWeek={onNextWeek} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-4">
          <WeekSection
            icon={Target}
            id="week-review-objectives"
            title="Tiến độ mục tiêu"
            description="Đánh dấu xong hoặc bỏ. Cái còn mở sẽ được đề nghị kéo sang tuần sau."
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
          {review.rhythm && (
            // The brag lines added in this review count at once (the server counts the same rows).
            <ReviewRhythm rhythm={{ ...review.rhythm, achievements: review.achievements.length }} />
          )}
          <ReviewOpportunities opportunities={review.opportunities} onDecided={onOpportunity} />
          <ReviewAchievements start={start} achievements={review.achievements} onAdded={onAchievement} />
          <ReviewPredictions />
        </div>
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:rounded-3xl">
          <ReviewJournal start={start} week={week} opportunities={review.opportunities} onSaved={onWeek} />
        </div>
      </div>
    </div>
  );
}
