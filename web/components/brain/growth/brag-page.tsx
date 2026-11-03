'use client';
import { useState } from 'react';
import { CalendarCheck, Pencil, Plus, Scale, Trash2, Trophy } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { growthApi, type ApiAchievement, type ApiOutcome, type ApiPrediction } from '@/lib/api/growth';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, ApiStaleAlert, EmptyState, describeApiError, openError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { AchievementDialog } from './achievement-dialog';
import { addDays, formatDay, mondayOf, outcomeOf, outcomes, today, weekLabel } from './labels';
import { PredictionDialog, type PredictionMode } from './prediction-dialog';
import { PeriodStepper, SectionTitle, useShortcuts } from './shared';

// --- Brag document -----------------------------------------------------------------------------------

/**
 * One brag line as a row (DESIGN.md D13): title (opens the edit dialog), the impact, the description, then date,
 * project and skills as meta text; edit and delete in the row menu, delete through the confirm dialog.
 */
function AchievementRow({
  a,
  onEdit,
  onDeleted,
}: {
  a: ApiAchievement;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const meta = [formatDay(a.date), a.projectTitle, a.skills.map((k) => k.name).join(', ')].filter(Boolean).join(' · ');
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="w-fit text-start text-sm font-medium break-words underline-offset-4 hover:underline"
        >
          {a.title}
        </button>
        {a.impact && <p className="text-[13px] leading-relaxed">{a.impact}</p>}
        {a.description && (
          <p className="line-clamp-2 text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {a.description}
          </p>
        )}
        <p className="pt-0.5 text-xs text-muted-foreground">{meta}</p>
      </div>
      <RowMenu label={`Thao tác với "${a.title}"`}>
        <MenuItem onClick={onEdit}>
          <Pencil aria-hidden />
          Sửa
        </MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden />
          Xóa
        </MenuItem>
      </RowMenu>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title="Xóa dòng thành tựu?"
        description={`"${a.title}" bị xóa khỏi nhật ký thành tựu. Không hoàn tác được.`}
        action={() => growthApi.deleteAchievement(a.id)}
        onDeleted={onDeleted}
      />
    </li>
  );
}

/** Loading placeholder at the geometry of a row list (DESIGN.md D27). */
function LoadingRows() {
  return <Skeleton className="h-36 rounded-xl" aria-busy="true" aria-label="Đang tải" />;
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
  const empty = !!list.data && !list.loading && !list.error && rows.length === 0;
  // A new line defaults to today when the shown week is this week, otherwise to that week's Friday.
  const defaultDate = scope === 'all' || week === thisWeek ? today() : addDays(week, 4);

  const create = () => {
    setEditing(null);
    setOpen(true);
  };
  useShortcuts({ n: create });

  // ?achievement=N (Cmd+K result): show the line's week and open it.
  useOpenFromUrl('achievement', (id) => {
    growthApi.getAchievement(id).then(
      (a) => {
        setScope('week');
        setWeek(mondayOf(a.date));
        setEditing(a);
        setOpen(true);
      },
      (err: unknown) => setNotice(openError(err, `Không tìm thấy thành tựu #${id}, có thể đã bị xóa.`)),
    );
  });

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
    <section className="flex flex-col gap-4" aria-label="Thành tựu">
      {/* One toolbar: period and stepper left, "Ghi thành tựu" right; at 390 px the stepper takes row 2 */}
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect label="Phạm vi" value={scope} onChange={setScope} choices={scopeChoices} className="w-auto" />
        {scope === 'week' && (
          <div className="order-last w-full sm:order-none sm:w-auto">
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
          </div>
        )}
        {/* While the list is empty the EmptyState button is the one primary (DESIGN.md D2) */}
        <Button className="ms-auto" variant={empty ? 'outline' : 'default'} onClick={create}>
          <Plus aria-hidden />
          Ghi thành tựu <Kbd className="max-sm:hidden pointer-coarse:hidden">N</Kbd>
        </Button>
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
        <LoadingRows />
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
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((a) => (
            <AchievementRow
              key={a.id}
              a={a}
              onEdit={() => {
                setEditing(a);
                setOpen(true);
              }}
              onDeleted={() => {
                list.mutate((d) => d && { ...d, results: d.results.filter((x) => x.id !== a.id) });
                setNotice(`Đã xóa "${a.title}"`);
              }}
            />
          ))}
        </ul>
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

/**
 * One prediction as a two-line row: a status badge only when it says something (due, or scored), the statement,
 * then dates and confidence as meta. "Chấm" stays visible (outline); edit and delete sit in the row menu.
 */
function PredictionRow({
  p,
  onScore,
  onEdit,
  onDeleted,
}: {
  p: ApiPrediction;
  onScore: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const o = outcomeOf(p.outcome);
  const due = p.outcome === 'open' && p.checkOn <= today();
  const meta = [
    `ghi ${formatDay(p.madeOn)}`,
    p.outcome === 'open' ? `chấm lại ${formatDay(p.checkOn)}` : `chấm ${formatDay(p.scoredAt)}`,
    p.confidence ? `tự tin ${p.confidence}/10` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {due ? (
            <StatusBadge tone="warning">
              <CalendarCheck aria-hidden />
              Đến hạn chấm lại
            </StatusBadge>
          ) : p.outcome !== 'open' ? (
            <StatusBadge tone={o.tone}>{o.label}</StatusBadge>
          ) : null}
          <p className="min-w-0 text-sm font-medium break-words">{p.statement}</p>
        </div>
        <p className="text-xs text-muted-foreground">{meta}</p>
        {p.note && (
          <p className="line-clamp-2 pt-0.5 text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {p.note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="xs" variant="outline" onClick={onScore}>
          <Scale aria-hidden />
          {p.outcome === 'open' ? 'Chấm' : 'Chấm lại'}
        </Button>
        <RowMenu label="Thao tác với dự đoán">
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            Xóa
          </MenuItem>
        </RowMenu>
      </div>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title="Xóa dự đoán?"
        description={`"${p.statement}" bị xóa, kể cả kết quả đã chấm. Không hoàn tác được.`}
        action={() => growthApi.deletePrediction(p.id)}
        onDeleted={onDeleted}
      />
    </li>
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
  // No predictions at all (not just none for a filter): heading + one muted line, no filter, no empty box.
  const none = filter === 'all' && !!list.data && !list.loading && !list.error && rows.length === 0;
  const dueCount = due.data?.results.length ?? 0;

  const show = (p: ApiPrediction | null, m: PredictionMode) => {
    setTarget(p);
    setMode(m);
    setOpen(true);
  };

  // ?prediction=N (Cmd+K result): open it in the edit dialog.
  useOpenFromUrl('prediction', (id) => {
    growthApi.getPrediction(id).then(
      (p) => show(p, 'edit'),
      (err: unknown) => setNotice(openError(err, `Không tìm thấy dự đoán #${id}, có thể đã bị xóa.`)),
    );
  });
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
      <SectionTitle>
        <span id="pred-title" className="scroll-mt-20">
          Dự đoán, chấm lại sau 6 tháng
        </span>
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
      {/* One row: filter left, "Ghi dự đoán" right (it keeps the end of row 1 at 390 px). With no predictions
          yet there is nothing to filter: the button follows the empty sentence instead of standing alone. */}
      {!none && (
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceSelect label="Lọc dự đoán" value={filter} onChange={setFilter} choices={predChoices} className="w-auto" />
          <Button className="ms-auto" variant="outline" onClick={() => show(null, 'edit')}>
            <Plus aria-hidden />
            Ghi dự đoán <Kbd className="max-sm:hidden pointer-coarse:hidden">P</Kbd>
          </Button>
        </div>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <ApiStaleAlert result={list} />
      {list.error && !list.data ? (
        <ApiErrorState error={list.error} onRetry={list.reload} />
      ) : list.loading && rows.length === 0 ? (
        <LoadingRows />
      ) : none ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Chưa có dự đoán nào. Ghi một dự đoán về AI, kinh tế hay địa chính trị kèm độ tự tin; 6 tháng sau app nhắc
            chấm lại.
          </p>
          <Button variant="outline" onClick={() => show(null, 'edit')}>
            <Plus aria-hidden />
            Ghi dự đoán <Kbd className="max-sm:hidden pointer-coarse:hidden">P</Kbd>
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.{' '}
          <Button variant="link" size="sm" className="px-0" onClick={() => setFilter('all')}>
            Xóa bộ lọc
          </Button>
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {rows.map((p) => (
            <PredictionRow
              key={p.id}
              p={p}
              onScore={() => show(p, 'score')}
              onEdit={() => show(p, 'edit')}
              onDeleted={() => {
                list.mutate((d) => d && { ...d, results: d.results.filter((x) => x.id !== p.id) });
                due.reload();
                setNotice('Đã xóa dự đoán');
              }}
            />
          ))}
        </ul>
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
    <div className="flex flex-col gap-8 px-4 pb-12 sm:px-8">
      <BragSection />
      <PredictionsSection />
    </div>
  );
}
