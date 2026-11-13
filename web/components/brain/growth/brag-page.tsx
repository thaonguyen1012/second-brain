'use client';
import { useState } from 'react';
import { CalendarCheck, Pencil, Plus, Scale, Trash2, Trophy } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { growthApi, type ApiAchievement, type ApiOutcome, type ApiPrediction } from '@/lib/api/growth';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { cn } from '@/lib/utils';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, ApiStaleAlert, EmptyState, describeApiError, openError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { ConfirmDelete } from '../confirm-delete';
import { EmptyPanel } from '../empty-panel';
import { GhostRows } from '../ghost-rows';
import { PAGE_WIDTH } from '../layout';
import { RowMenu } from '../row-menu';
import { AchievementDialog } from './achievement-dialog';
import { AchievementQuickAdd } from './achievement-quick-add';
import { addDays, formatDay, mondayOf, outcomeOf, outcomes, today, weekLabel } from './labels';
import { PredictionDialog, type PredictionMode } from './prediction-dialog';
import { PeriodStepper, useShortcuts } from './shared';

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
  const t = useT();
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
      <RowMenu label={t('Thao tác với "{title}"', { title: a.title })}>
        <MenuItem onClick={onEdit}>
          <Pencil aria-hidden />
          {t('Sửa')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden />
          {t('Xóa')}
        </MenuItem>
      </RowMenu>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={t('Xóa dòng thành tựu?')}
        description={t('"{title}" bị xóa khỏi nhật ký thành tựu. Không hoàn tác được.', { title: a.title })}
        action={() => growthApi.deleteAchievement(a.id)}
        onDeleted={onDeleted}
      />
    </li>
  );
}

/** Loading placeholder at the geometry of a row list (DESIGN.md D27). */
function LoadingRows() {
  const t = useT();
  return <Skeleton className="h-36 rounded-xl" aria-busy="true" aria-label={t('Đang tải')} />;
}

type Scope = 'week' | 'all';
const scopeChoices: { value: Scope; label: Msg }[] = [
  { value: 'week', label: msg('Theo tuần') },
  { value: 'all', label: msg('Mọi tuần') },
];

function BragSection() {
  const t = useT();
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
  // First run = no line in any week: "Mọi tuần" answers it itself, an empty "Tuần này" asks for one row of any week.
  // A past empty week never counts: the panel hides the stepper, which would leave no way back.
  const askAny = empty && scope === 'week' && week === thisWeek;
  const anyLine = useApi<Page<ApiAchievement>>(askAny ? 'achievements:any' : null, () =>
    growthApi.listAchievements({ limit: 1 }),
  );
  // Only a fresh answer decides: an earlier "none" may be stale after a line was added
  const checking = askAny && anyLine.loading;
  const firstRun =
    empty &&
    (scope === 'all' || (askAny && !anyLine.loading && !anyLine.error && anyLine.data?.results.length === 0));
  // A new line defaults to today when the shown week is this week, otherwise to that week's Friday.
  const defaultDate = scope === 'all' || week === thisWeek ? today() : addDays(week, 4);
  const added = (a: ApiAchievement, message: string) => {
    setNotice(message);
    if (scope === 'week' && mondayOf(a.date) !== week) setWeek(mondayOf(a.date));
    else list.reload();
    if (anyLine.data) anyLine.reload();
  };

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
      (err: unknown) => setNotice(openError(err, t('Không tìm thấy thành tựu #{id}, có thể đã bị xóa.', { id }), t)),
    );
  });

  const loadMore = async () => {
    const next = list.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(list);
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="flex flex-col gap-6" aria-label={t('Thành tựu')}>
      {/* One toolbar: period and stepper left, "Ghi thành tựu" right; at 390 px the stepper takes row 2. None
          before the first line (D26): the first-run panel carries the add. Kept while that is being checked, so a
          week that is empty only for now does not make it flicker. */}
      {!firstRun && (
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceSelect
            label={t('Phạm vi')}
            value={scope}
            onChange={setScope}
            choices={scopeChoices.map((c) => ({ value: c.value, label: t(c.label) }))}
            className="w-auto"
          />
          {scope === 'week' && (
            <div className="order-last w-full sm:order-none sm:w-auto">
              <PeriodStepper
                name={t('tuần')}
                label={weekLabel(week)}
                onPrev={() => setWeek((w) => addDays(w, -7))}
                onNext={() => setWeek((w) => addDays(w, 7))}
                nextDisabled={week >= thisWeek}
                current={week === thisWeek}
                onCurrent={() => setWeek(thisWeek)}
                currentLabel={t('Tuần này')}
              />
            </div>
          )}
          {/* While the list is empty the EmptyState button is the one primary (DESIGN.md D2) */}
          <Button className="ms-auto" variant={empty ? 'outline' : 'default'} onClick={create}>
            <Plus aria-hidden />
            {t('Ghi thành tựu')} <Kbd className="max-sm:hidden pointer-coarse:hidden">N</Kbd>
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
      ) : (list.loading && rows.length === 0) || checking ? (
        <LoadingRows />
      ) : firstRun ? (
        <EmptyPanel
          glyph={Trophy}
          title={t('Chưa có thành tựu nào')}
          text={t('Mỗi tuần ghi việc đã làm được, kèm kết quả bằng số: nguyên liệu cho CV và case study.')}
          action={
            <Button onClick={create} aria-keyshortcuts="n">
              <Plus aria-hidden />
              {t('Ghi thành tựu')}
              <Kbd className="ms-1 bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">N</Kbd>
            </Button>
          }
          quick={
            <>
              <p className="basis-full text-xs text-muted-foreground">{t('Hoặc ghi nhanh một dòng')}</p>
              <AchievementQuickAdd
                date={defaultDate}
                titlePlaceholder={t('Giảm build từ 14 GB xuống 1,9 GB')}
                onAdded={(a) => added(a, t('Đã ghi "{title}"', { title: a.title }))}
              />
            </>
          }
          ghost={<GhostRows />}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Trophy aria-hidden />}
          title={
            scope === 'week'
              ? week === thisWeek
                ? t('Tuần này chưa ghi gì')
                : t('Tuần {week} không có dòng nào', { week: weekLabel(week) })
              : t('Nhật ký còn trống')
          }
          description={t('Mỗi tuần ghi những việc đã làm được, kèm kết quả bằng số. Đây là nguyên liệu cho CV và case study.')}
        >
          <Button onClick={create}>
            <Plus aria-hidden />
            {t('Ghi thành tựu')}
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
                setNotice(t('Đã xóa "{title}"', { title: a.title }));
                if (anyLine.data) anyLine.reload();
              }}
            />
          ))}
        </ul>
      )}
      {list.data?.next && !list.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          {t('Tải thêm')}
        </Button>
      )}
      <AchievementDialog
        open={open}
        achievement={editing}
        defaultDate={defaultDate}
        onOpenChange={setOpen}
        onSaved={(saved, created) => {
          setOpen(false);
          added(
            saved,
            created ? t('Đã ghi "{title}"', { title: saved.title }) : t('Đã lưu "{title}"', { title: saved.title }),
          );
        }}
      />
    </section>
  );
}

// --- Predictions -------------------------------------------------------------------------------------

type PredFilter = 'all' | 'due' | ApiOutcome;
const predChoices: { value: PredFilter; label: Msg }[] = [
  { value: 'all', label: msg('Mọi dự đoán') },
  { value: 'due', label: msg('Đến hạn chấm lại') },
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
  const t = useT();
  const [deleting, setDeleting] = useState(false);
  const o = outcomeOf(p.outcome);
  const due = p.outcome === 'open' && p.checkOn <= today();
  const meta = [
    t('ghi {date}', { date: formatDay(p.madeOn) }),
    p.outcome === 'open'
      ? t('chấm lại {date}', { date: formatDay(p.checkOn) })
      : t('chấm {date}', { date: formatDay(p.scoredAt) }),
    p.confidence ? t('tự tin {confidence}/10', { confidence: p.confidence }) : null,
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
              {t('Đến hạn chấm lại')}
            </StatusBadge>
          ) : p.outcome !== 'open' ? (
            <StatusBadge tone={o.tone}>{t(o.label)}</StatusBadge>
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
          {p.outcome === 'open' ? t('Chấm') : t('Chấm lại')}
        </Button>
        <RowMenu label={t('Thao tác với "{title}"', { title: p.statement })}>
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            {t('Sửa')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 aria-hidden />
            {t('Xóa')}
          </MenuItem>
        </RowMenu>
      </div>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={t('Xóa dự đoán?')}
        description={t('"{statement}" bị xóa, kể cả kết quả đã chấm. Không hoàn tác được.', { statement: p.statement })}
        action={() => growthApi.deletePrediction(p.id)}
        onDeleted={onDeleted}
      />
    </li>
  );
}

function PredictionsSection() {
  const t = useT();
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
      (err: unknown) => setNotice(openError(err, t('Không tìm thấy dự đoán #{id}, có thể đã bị xóa.', { id }), t)),
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
      setNotice(describeApiError(toApiError(err), t).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const addButton = (
    <Button className="shrink-0" variant="outline" onClick={() => show(null, 'edit')}>
      <Plus aria-hidden />
      {t('Ghi dự đoán')} <Kbd className="max-sm:hidden pointer-coarse:hidden">P</Kbd>
    </Button>
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="pred-title">
      {dueCount > 0 && filter !== 'due' && (
        <Alert variant="warning">
          <CalendarCheck aria-hidden />
          <AlertTitle>
            {t('{n}{plus} dự đoán đến hạn chấm lại', { n: dueCount, plus: due.data?.next ? '+' : '' })}
          </AlertTitle>
          <AlertDescription>
            {t('Mỗi quý xem lại danh sách dự đoán: đúng, sai, hay đúng một phần, và vì sao.')}
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => setFilter('due')}>
              {t('Xem')}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
      <ApiStaleAlert result={list} />
      {/* One surface: the title, filter and "Ghi dự đoán" in its header, then the rows or one line. With no
          predictions yet there is nothing to filter. */}
      <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
        {/* 390 px: alone, the button keeps the title's row (the title wraps); with the filter both take row 2 */}
        <div className={cn('flex min-h-12 items-center gap-2 px-3 py-2', !none && 'flex-wrap')}>
          <h2
            id="pred-title"
            className="me-auto min-w-0 font-heading text-lg font-semibold tracking-tight text-balance"
          >
            {t('Dự đoán, chấm lại sau 6 tháng')}
          </h2>
          {none ? (
            addButton
          ) : (
            <div className="flex items-center gap-2 max-sm:w-full">
              <ChoiceSelect
                label={t('Lọc dự đoán')}
                value={filter}
                onChange={setFilter}
                choices={predChoices.map((c) => ({ value: c.value, label: t(c.label) }))}
                className="w-auto max-sm:min-w-0 max-sm:flex-1"
              />
              {addButton}
            </div>
          )}
        </div>
        {list.error && !list.data ? (
          <div className="p-3">
            <ApiErrorState error={list.error} onRetry={list.reload} />
          </div>
        ) : list.loading && rows.length === 0 ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label={t('Đang tải')}>
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : none ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {t(
              'Chưa có dự đoán nào. Ghi một dự đoán về AI, kinh tế hay địa chính trị kèm độ tự tin; 6 tháng sau app nhắc chấm lại.',
            )}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            {t('Không có mục nào khớp bộ lọc.')}{' '}
            <Button variant="link" size="sm" className="px-0" onClick={() => setFilter('all')}>
              {t('Xóa bộ lọc')}
            </Button>
          </p>
        ) : (
          <ul className="flex flex-col divide-y" aria-label={t('Dự đoán', null, 'list')}>
            {rows.map((p) => (
              <PredictionRow
                key={p.id}
                p={p}
                onScore={() => show(p, 'score')}
                onEdit={() => show(p, 'edit')}
                onDeleted={() => {
                  list.mutate((d) => d && { ...d, results: d.results.filter((x) => x.id !== p.id) });
                  due.reload();
                  setNotice(t('Đã xóa dự đoán'));
                }}
              />
            ))}
          </ul>
        )}
      </div>
      {list.data?.next && !list.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          {t('Tải thêm')}
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
              ? t('Đã ghi dự đoán, chấm lại ngày {date}', { date: formatDay(saved.checkOn) })
              : mode === 'score'
                ? t('Đã chấm: {outcome}', { outcome: t(outcomeOf(saved.outcome).label) })
                : t('Đã lưu dự đoán'),
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
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-8 px-4 pb-12 sm:px-8')}>
      <BragSection />
      <PredictionsSection />
    </div>
  );
}
