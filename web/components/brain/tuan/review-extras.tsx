'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';
import { opportunitiesApi } from '@/lib/api/opportunities';
import { type ApiAchievement, type ApiOpportunityDecision, type ApiWeekOpportunities, weeksApi } from '@/lib/api/weeks';
import { decisionOf, formatDate, opportunityHref } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '../brain-card';
import { DuePredictionList, PREDICTIONS_HREF, useDuePredictions } from '../due-predictions';
import { WeekSection, WriteError } from './week-section';
import { addDays, shortDate, todayPrague } from './week-utils';

/** Keep or drop a stale opportunity right in the review (PATCH /api/opportunities/{id} decision). */
function DecideButtons({
  id,
  title,
  decision,
  onDecided,
}: {
  id: number;
  title: string;
  decision: ApiOpportunityDecision;
  onDecided: (id: number, decision: ApiOpportunityDecision) => void;
}) {
  const [busy, setBusy] = useState<ApiOpportunityDecision | null>(null);
  const [error, setError] = useState<unknown>(null);
  const decide = async (to: ApiOpportunityDecision) => {
    if (busy) return;
    setBusy(to);
    setError(null);
    try {
      const saved = await opportunitiesApi.update(id, { decision: to });
      onDecided(id, saved.decision);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <div className="flex items-center gap-1.5">
        {decision !== 'keep' && (
          <Button
            size="xs"
            variant="outline"
            loading={busy === 'keep'}
            disabled={busy !== null}
            aria-label={`Giữ "${title}"`}
            onClick={() => void decide('keep')}
          >
            Giữ
          </Button>
        )}
        {decision !== 'drop' && (
          <Button
            size="xs"
            variant="outline"
            loading={busy === 'drop'}
            disabled={busy !== null}
            aria-label={`Bỏ "${title}"`}
            onClick={() => void decide('drop')}
          >
            Bỏ
          </Button>
        )}
      </div>
      <WriteError error={error} className="basis-full" />
    </>
  );
}

/** "Cơ hội nào có thêm bằng chứng" and the stale ones (4 weeks without new evidence: keep or drop, DECISIONS 9.2). */
export function ReviewOpportunities({
  opportunities,
  onDecided,
}: {
  opportunities: ApiWeekOpportunities;
  onDecided: (id: number, decision: ApiOpportunityDecision) => void;
}) {
  const { withEvidence, stale } = opportunities;
  if (withEvidence.length === 0 && stale.length === 0) return null;
  return (
    <WeekSection
      id="week-opportunities"
      title="Cơ hội"
      action={
        <Button size="xs" variant="ghost" render={<Link href="/co-hoi/" />}>
          Mở Cơ hội
          <ArrowRight aria-hidden />
        </Button>
      }
    >
      {withEvidence.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">Có thêm bằng chứng tuần này</h3>
          <ul className="flex flex-col divide-y">
            {withEvidence.map((o) => {
              const d = decisionOf(o.decision);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link
                    href={opportunityHref(o.id)}
                    className="min-w-0 flex-1 font-medium hover:underline focus-visible:underline"
                  >
                    {o.title}
                  </Link>
                  <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {o.supports} ủng hộ · {o.contradicts} phản bác
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {stale.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            4 tuần không có bằng chứng mới: giữ hay bỏ?
          </h3>
          <ul className="flex flex-col divide-y">
            {stale.map((o) => {
              const d = decisionOf(o.decision);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <Link href={opportunityHref(o.id)} className="min-w-0 flex-1 hover:underline focus-visible:underline">
                    {o.title}
                  </Link>
                  <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    {o.lastEvidenceAt ? `Bằng chứng cuối ${formatDate(o.lastEvidenceAt)}` : 'Chưa có bằng chứng'}
                  </span>
                  <DecideButtons id={o.id} title={o.title} decision={o.decision} onDecided={onDecided} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </WeekSection>
  );
}

/** The week's brag-document lines, with a one-line add so the weekly entry happens during the review. */
export function ReviewAchievements({
  start,
  achievements,
  onAdded,
}: {
  start: string;
  achievements: ApiAchievement[];
  onAdded: (a: ApiAchievement) => void;
}) {
  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Dated inside the reviewed week: today for the running week, its Sunday for a past one.
  const today = todayPrague();
  const sunday = addDays(start, 6);
  const date = today < start ? start : today > sunday ? sunday : today;

  async function add() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await weeksApi.addAchievement({ title: title.trim(), impact: impact.trim(), date });
      onAdded(a);
      setTitle('');
      setImpact('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WeekSection
      id="week-achievements"
      title="Nhật ký thành tựu"
      action={
        <Button size="xs" variant="ghost" render={<Link href="/phat-trien/thanh-tuu/" />}>
          Tất cả
          <ArrowRight aria-hidden />
        </Button>
      }
    >
      {achievements.length > 0 && (
        <ul className="flex flex-col divide-y">
          {achievements.map((a) => (
            <li key={a.id} className="flex flex-col gap-1 py-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <span className="ms-auto text-xs text-muted-foreground tabular-nums">{shortDate(a.date)}</span>
              </div>
              {a.impact && <p className="text-[13px] text-muted-foreground">{a.impact}</p>}
              {(a.projectTitle || a.skills.length > 0) && (
                <div className="flex flex-wrap gap-1">
                  {a.projectTitle && <Badge variant="secondary">{a.projectTitle}</Badge>}
                  {a.skills.map((s) => (
                    <Badge key={s.id} variant="outline">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Đã làm gì"
          aria-label="Thành tựu"
          maxLength={200}
          className="sm:flex-[3]"
        />
        <Input
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder="Con số tác động"
          aria-label="Tác động (con số)"
          maxLength={200}
          className="sm:flex-[2]"
        />
        <Button type="submit" variant="outline" disabled={!title.trim()} loading={busy}>
          <Plus aria-hidden />
          Thêm
        </Button>
      </form>
      <WriteError error={error} />
    </WeekSection>
  );
}

/**
 * Predictions whose 6 months are up (GET /api/predictions?due=true): scored on Thành tựu (DECISIONS 4.8). Shown
 * only when some are due; the review checklist already says "Không có" otherwise.
 */
export function ReviewPredictions() {
  const due = useDuePredictions();
  if (!due.data || due.data.results.length === 0) return null;
  return (
    <WeekSection
      id="week-predictions"
      title="Dự đoán đến hạn chấm lại"
      action={
        <Button size="xs" variant="ghost" render={<Link href={PREDICTIONS_HREF} />}>
          Chấm lại
          <ArrowRight aria-hidden />
        </Button>
      }
    >
      <DuePredictionList due={due} />
    </WeekSection>
  );
}
