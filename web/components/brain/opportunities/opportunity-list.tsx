'use client';
import { useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Pencil, Plus, X } from 'lucide-react';
import { api, type ApiOpportunity, type Page } from '@/lib/api/client';
import { opportunitiesApi, type ApiDecision } from '@/lib/api/opportunities';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { opportunityHref } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem } from '@/components/ui/menu';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { EmptyPanel } from '../empty-panel';
import { PAGE_WIDTH } from '../layout';
import { useNavCounts } from '../nav-counts';
import { RowMenu } from '../row-menu';
import { DecideByCell, RowsSkeleton, ScoresCell } from './bits';
import { STALE_LABEL, decisionOf, decisions, formatDay, scoreDims } from './labels';
import { OpportunityFormDialog } from './opportunity-form-dialog';
import { useShortcuts } from './use-shortcuts';

type DecisionFilter = ApiDecision | 'all';
type StaleFilter = 'all' | 'true' | 'false';

const decisionChoices = [{ value: 'all' as const, label: 'Mọi quyết định' }, ...decisions];
const staleChoices: { value: StaleFilter; label: string }[] = [
  { value: 'all', label: 'Mọi tình trạng' },
  { value: 'true', label: 'Cần bằng chứng mới' },
  { value: 'false', label: 'Còn bằng chứng mới' },
];

export const detailHref = opportunityHref;

/**
 * One list row (DESIGN.md §3 "List row beats card"): decision | title + evidence meta | scores | decide-by | menu.
 * The title link stretches over the row; the menu sits above it. Hypothesis and next action live on the detail.
 */
const ROW_GRID =
  'grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 md:grid-cols-[5.5rem_minmax(0,1fr)_7rem_10rem_auto]';

function OpportunityRow({ o, onEdit, onDrop }: { o: ApiOpportunity; onEdit: () => void; onDrop: () => void }) {
  const d = decisionOf(o.decision);
  const undecided = o.decision === 'open' || o.decision === 'keep';
  return (
    <li
      className={cn(
        ROW_GRID,
        // badges are positioned (relative): let clicks on them fall through to the stretched title link
        'relative min-h-14 px-3 py-2 transition-colors hover:bg-accent [&_[data-slot=badge]]:pointer-events-none',
      )}
    >
      <span className="flex">
        <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={detailHref(o.id)}
          className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {o.title}
        </Link>
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground tabular-nums">
          {o.stale && <StatusBadge tone="warning">{STALE_LABEL}</StatusBadge>}
          <span>
            {o.evidenceSupports} ủng hộ · {o.evidenceContradicts} phản bác
            {undecided && o.decideBy && <span className="md:hidden"> · hạn {formatDay(o.decideBy)}</span>}
          </span>
        </p>
      </div>
      <span className="max-md:hidden">
        <ScoresCell scores={o.scores} />
      </span>
      <span className="flex max-md:hidden">{undecided && <DecideByCell day={o.decideBy} />}</span>
      <span className="relative z-10 flex justify-end">
        <RowMenu label={`Thao tác cho "${o.title}"`}>
          <MenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </MenuItem>
          {o.stale && o.decision !== 'drop' && (
            <MenuItem onClick={onDrop}>
              <X aria-hidden />
              Bỏ cơ hội này
            </MenuItem>
          )}
        </RowMenu>
      </span>
    </li>
  );
}

/** Cơ hội: list with decision and stale filters, create and edit; the week rule drops stale ones (9.2). */
export function OpportunityList() {
  const [decision, setDecision] = useState<DecisionFilter>('all');
  const [stale, setStale] = useState<StaleFilter>('all');
  const [editing, setEditing] = useState<ApiOpportunity | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const opps = useApi<Page<ApiOpportunity>>(`opportunities:${decision}:${stale}`, () =>
    api.listOpportunities({
      limit: 100,
      ...(decision !== 'all' && { decision }),
      ...(stale !== 'all' && { stale: stale === 'true' }),
    }),
  );
  const list = opps.loading ? [] : (opps.data?.results ?? []);
  const matches = (o: ApiOpportunity) =>
    (decision === 'all' || o.decision === decision) && (stale === 'all' || String(o.stale) === stale);

  const upsert = (saved: ApiOpportunity, created: boolean) =>
    opps.mutate((d) => {
      if (!d) return d;
      const rest = d.results.filter((o) => o.id !== saved.id);
      if (!matches(saved)) return { ...d, results: rest };
      return {
        ...d,
        results: created ? [saved, ...rest] : d.results.map((o) => (o.id === saved.id ? saved : o)),
      };
    });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useShortcuts({ n: openNew }, !dialogOpen);

  const drop = async (o: ApiOpportunity) => {
    try {
      upsert(await opportunitiesApi.update(o.id, { decision: 'drop' }), false);
      setNotice(`Đã bỏ "${o.title}"`);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    }
  };

  const loadMore = async () => {
    const next = opps.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(opps);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = decision !== 'all' || stale !== 'all';
  const clearFilters = () => {
    setDecision('all');
    setStale('all');
  };
  // The toolbar waits for a first opportunity or a filter (DESIGN.md §9a): an empty list shows only the empty panel,
  // whose "Cơ hội mới" is the one primary (D2); N still opens the form. While the list loads it stays unless the
  // sidebar count already says 0, so the rows never jump down when they arrive (first load, reload on tab focus).
  const counts = useNavCounts();
  const showToolbar = list.length > 0 || filtered || (opps.loading && counts?.opportunities !== 0);
  const newButton = (className?: string) => (
    <Button className={className} onClick={openNew} aria-keyshortcuts="n">
      <Plus aria-hidden />
      Cơ hội mới
      <Kbd className="ms-1 bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">N</Kbd>
    </Button>
  );

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6')}>
      {/* 390 px: the two filters share row 1, "Cơ hội mới" takes row 2 at full width, as on Thư viện (D11) */}
      {showToolbar && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <ChoiceSelect
            label="Quyết định"
            value={decision}
            onChange={setDecision}
            choices={decisionChoices}
            className="min-w-0 max-sm:text-sm sm:w-auto"
          />
          <ChoiceSelect
            label="Bằng chứng"
            value={stale}
            onChange={setStale}
            choices={staleChoices}
            className="min-w-0 max-sm:text-sm sm:w-auto"
          />
          {newButton('col-span-2 max-sm:w-full sm:ms-auto')}
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={opps} />
      {opps.error && !opps.data ? (
        <ApiErrorState error={opps.error} onRetry={opps.reload} />
      ) : opps.loading && list.length === 0 ? (
        <RowsSkeleton />
      ) : list.length === 0 && filtered ? (
        <p className="text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.{' '}
          <Button variant="link" size="sm" className="px-0" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        </p>
      ) : list.length === 0 ? (
        <EmptyPanel
          area="opportunity"
          glyph={FlaskConical}
          title="Chưa có cơ hội nào"
          text="Ghi một giả thuyết: ai đang đau vì điều gì và sẽ trả tiền cho gì."
          action={newButton()}
          guide={opps.error ? undefined : 'opportunity'}
        />
      ) : (
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
          <div className={cn(ROW_GRID, 'h-8 px-3 text-xs font-medium text-muted-foreground max-md:hidden')} aria-hidden>
            <span>Quyết định</span>
            <span>Cơ hội</span>
            <span title={scoreDims.map((d) => d.label).join(' · ')}>Điểm</span>
            <span>Hạn quyết định</span>
            <span className="w-8 sm:w-7" />
          </div>
          <ul className="flex flex-col divide-y" aria-label="Cơ hội">
            {list.map((o) => (
              <OpportunityRow
                key={o.id}
                o={o}
                onEdit={() => {
                  setEditing(o);
                  setDialogOpen(true);
                }}
                onDrop={() => void drop(o)}
              />
            ))}
          </ul>
        </div>
      )}
      {opps.data?.next && !opps.loading && (
        <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
          Tải thêm
        </Button>
      )}

      <OpportunityFormDialog
        open={dialogOpen}
        opportunity={editing}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          upsert(saved, created);
          setDialogOpen(false);
          setNotice(created ? `Đã tạo "${saved.title}"` : `Đã lưu "${saved.title}"`);
        }}
      />
    </div>
  );
}
