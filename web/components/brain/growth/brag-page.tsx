'use client';
import { useState } from 'react';
import { CalendarCheck, Pencil, Plus, Scale, Trophy } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { growthApi, type ApiAchievement, type ApiOutcome, type ApiPrediction } from '@/lib/api/growth';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from '../api-state';
import { BrainCard, StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { AchievementDialog } from './achievement-dialog';
import { addDays, formatDay, mondayOf, outcomeOf, outcomes, today, weekLabel } from './labels';
import { PredictionDialog, type PredictionMode } from './prediction-dialog';
import { PeriodStepper, SectionTitle, useShortcuts } from './shared';

// --- Brag document -----------------------------------------------------------------------------------

function AchievementCard({ a, onEdit }: { a: ApiAchievement; onEdit: () => void }) {
  return (
    <BrainCard
      badges={
        <>
          <Badge variant="secondary">{formatDay(a.date)}</Badge>
          {a.projectTitle && <Badge variant="outline">Dự án: {a.projectTitle}</Badge>}
        </>
      }
      title={a.title}
      actions={
        <Button size="xs" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden />
          Sửa
        </Button>
      }
    >
      {a.impact && (
        <p className="text-sm">
          <span className="font-medium">Kết quả: </span>
          {a.impact}
        </p>
      )}
      {a.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{a.description}</p>}
      {a.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Kỹ năng">
          {a.skills.map((s) => (
            <Badge key={s.id} variant="outline">
              {s.name}
            </Badge>
          ))}
        </div>
      )}
    </BrainCard>
  );
}

type Scope = 'week' | 'all';
const scopeChoices: { value: Scope; label: string }[] = [
  { value: 'week', label: 'Theo tuần' },
  { value: 'all', label: 'Mọi tuần' },
];

function BragSection() {
  const thisWeek = mondayOf(today());
  const [week, setWeek] = useState(thisWeek);
  const [scope, setScope] = useState<Scope>('week');
  const [editing, setEditing] = useState<ApiAchievement | null>(null);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const key = scope === 'week' ? `achievements:${week}` : 'achievements:all';
  const list = useApi<Page<ApiAchievement>>(key, () =>
    growthApi.listAchievements({ limit: 100, ...(scope === 'week' && { week }) }),
  );
  const rows = list.loading ? [] : (list.data?.results ?? []);
  // A new line defaults to today when the shown week is this week, otherwise to that week's Friday.
  const defaultDate = scope === 'all' || week === thisWeek ? today() : addDays(week, 4);

  const create = () => {
    setEditing(null);
    setOpen(true);
  };
  useShortcuts({ n: create });

  const loadMore = async () => {
    const next = list.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(list);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="brag-title">
      <SectionTitle
        action={
          <Button onClick={create}>
            <Plus aria-hidden />
            Ghi thành tựu <Kbd className="hidden sm:inline-flex">N</Kbd>
          </Button>
        }
      >
        <span id="brag-title">Nhật ký thành tựu</span>
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect label="Phạm vi" value={scope} onChange={setScope} choices={scopeChoices} className="w-auto" />
        {scope === 'week' && (
          <PeriodStepper
            name="tuần"
            label={weekLabel(week)}
            onPrev={() => setWeek((w) => addDays(w, -7))}
            onNext={() => setWeek((w) => addDays(w, 7))}
            nextDisabled={week >= thisWeek}
            current={week === thisWeek}
            onCurrent={() => setWeek(thisWeek)}
            currentLabel="Tuần này"
          />
        )}
      </div>
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <ApiStaleAlert result={list} />
      {list.error && !list.data ? (
        <ApiErrorState error={list.error} onRetry={list.reload} />
      ) : list.loading && rows.length === 0 ? (
        <LoadingCards count={2} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden />}
          title={
            scope === 'week'
              ? week === thisWeek
                ? 'Tuần này chưa ghi gì'
                : `Tuần ${weekLabel(week)} không có dòng nào`
              : 'Nhật ký còn trống'
          }
          description="Mỗi tuần ghi những việc đã làm được, kèm kết quả bằng số. Đây là nguyên liệu cho CV và case study."
        >
          <Button onClick={create}>
            <Plus aria-hidden />
            Ghi thành tựu
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((a) => (
            <AchievementCard
              key={a.id}
              a={a}
              onEdit={() => {
                setEditing(a);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
      {list.data?.next && !list.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}
      <AchievementDialog
        open={open}
        achievement={editing}
        defaultDate={defaultDate}
        onOpenChange={setOpen}
        onSaved={(saved, created) => {
          setOpen(false);
          setNotice(created ? `Đã ghi "${saved.title}"` : `Đã lưu "${saved.title}"`);
          if (scope === 'week' && mondayOf(saved.date) !== week) setWeek(mondayOf(saved.date));
          else list.reload();
        }}
      />
    </section>
  );
}

// --- Predictions -------------------------------------------------------------------------------------

type PredFilter = 'all' | 'due' | ApiOutcome;
const predChoices: { value: PredFilter; label: string }[] = [
  { value: 'all', label: 'Mọi dự đoán' },
  { value: 'due', label: 'Đến hạn chấm lại' },
  ...outcomes.map((o) => ({ value: o.value as PredFilter, label: o.label })),
];

function PredictionCard({
  p,
  onScore,
  onEdit,
}: {
  p: ApiPrediction;
  onScore: () => void;
  onEdit: () => void;
}) {
  const o = outcomeOf(p.outcome);
  const due = p.outcome === 'open' && p.checkOn <= today();
  return (
    <BrainCard
      badges={
        <>
          {due ? (
            <StatusBadge tone="warning">
              <CalendarCheck aria-hidden />
              Đến hạn chấm lại
            </StatusBadge>
          ) : (
            <StatusBadge tone={o.tone}>{o.label}</StatusBadge>
          )}
          {p.confidence ? <Badge variant="outline">Tự tin {p.confidence}/10</Badge> : null}
        </>
      }
      title={p.statement}
      meta={[
        `ghi ${formatDay(p.madeOn)}`,
        p.outcome === 'open' ? `chấm lại ${formatDay(p.checkOn)}` : `chấm ${formatDay(p.scoredAt)}`,
      ].join(' · ')}
      actions={
        <>
          <Button size="xs" variant={due ? 'default' : 'outline'} onClick={onScore}>
            <Scale aria-hidden />
            {p.outcome === 'open' ? 'Chấm' : 'Chấm lại'}
          </Button>
          <Button size="xs" variant="ghost" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </Button>
        </>
      }
    >
      {p.note && <p className="text-sm whitespace-pre-line text-muted-foreground">{p.note}</p>}
    </BrainCard>
  );
}

function PredictionsSection() {
  const [filter, setFilter] = useState<PredFilter>('all');
  const [target, setTarget] = useState<ApiPrediction | null>(null);
  const [mode, setMode] = useState<PredictionMode>('edit');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const list = useApi<Page<ApiPrediction>>(`predictions:${filter}`, () =>
    growthApi.listPredictions({
      limit: 100,
      ...(filter === 'due' && { due: true }),
      ...(filter !== 'all' && filter !== 'due' && { outcome: filter }),
    }),
  );
  const due = useApi<Page<ApiPrediction>>('predictions:due-count', () =>
    growthApi.listPredictions({ due: true, limit: 50 }),
  );
  const rows = list.loading ? [] : (list.data?.results ?? []);
  const dueCount = due.data?.results.length ?? 0;

  const show = (p: ApiPrediction | null, m: PredictionMode) => {
    setTarget(p);
    setMode(m);
    setOpen(true);
  };
  useShortcuts({ p: () => show(null, 'edit') });

  const loadMore = async () => {
    const next = list.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(list);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="pred-title">
      <SectionTitle
        action={
          <Button variant="outline" onClick={() => show(null, 'edit')}>
            <Plus aria-hidden />
            Ghi dự đoán <Kbd className="hidden sm:inline-flex">P</Kbd>
          </Button>
        }
      >
        <span id="pred-title">Dự đoán, chấm lại sau 6 tháng</span>
      </SectionTitle>
      {dueCount > 0 && filter !== 'due' && (
        <Alert variant="warning">
          <CalendarCheck aria-hidden />
          <AlertTitle>
            {dueCount}
            {due.data?.next ? '+' : ''} dự đoán đến hạn chấm lại
          </AlertTitle>
          <AlertDescription>Mỗi quý xem lại danh sách dự đoán: đúng, sai, hay đúng một phần, và vì sao.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => setFilter('due')}>
              Xem
            </Button>
          </AlertAction>
        </Alert>
      )}
      <ChoiceSelect label="Lọc dự đoán" value={filter} onChange={setFilter} choices={predChoices} className="w-auto self-start" />
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <ApiStaleAlert result={list} />
      {list.error && !list.data ? (
        <ApiErrorState error={list.error} onRetry={list.reload} />
      ) : list.loading && rows.length === 0 ? (
        <LoadingCards count={2} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Scale aria-hidden />}
          title={filter === 'all' ? 'Chưa có dự đoán nào' : 'Không có dự đoán nào khớp bộ lọc'}
          description={
            filter === 'all'
              ? 'Ghi một dự đoán về AI, kinh tế hay địa chính trị kèm độ tự tin; 6 tháng sau app nhắc chấm lại.'
              : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((p) => (
            <PredictionCard key={p.id} p={p} onScore={() => show(p, 'score')} onEdit={() => show(p, 'edit')} />
          ))}
        </div>
      )}
      {list.data?.next && !list.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}
      <PredictionDialog
        open={open}
        prediction={target}
        mode={mode}
        onOpenChange={setOpen}
        onSaved={(saved, created) => {
          setOpen(false);
          setNotice(
            created
              ? `Đã ghi dự đoán, chấm lại ngày ${formatDay(saved.checkOn)}`
              : mode === 'score'
                ? `Đã chấm: ${outcomeOf(saved.outcome).label}`
                : 'Đã lưu dự đoán',
          );
          list.reload();
          due.reload();
        }}
      />
    </section>
  );
}

/** Nhật ký thành tựu: weekly brag document and the predictions list (DECISIONS 4.8, 6.2, 6.5). */
export function BragPage() {
  return (
    <div className="flex flex-col gap-10 px-4 pb-12 sm:px-8">
      <BragSection />
      <PredictionsSection />
    </div>
  );
}
