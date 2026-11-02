'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Clock, Lightbulb, Pencil, Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api, type ApiOpportunity, type Page } from '@/lib/api/client';
import { opportunitiesApi, type ApiDecision } from '@/lib/api/opportunities';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { opportunityHref } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError } from '../api-state';
import { BrainCard, StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { DecideByBadge, FitBadges, ScoresLine } from './bits';
import { STALE_LABEL, decisionOf, decisions } from './labels';
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

function OpportunityCard({ o, onEdit, onDrop }: { o: ApiOpportunity; onEdit: () => void; onDrop: () => void }) {
  const d = decisionOf(o.decision);
  return (
    <BrainCard
      badges={
        <>
          <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
          {o.stale && (
            <StatusBadge tone="warning">
              <Clock aria-hidden />
              {STALE_LABEL}
            </StatusBadge>
          )}
          {o.decision === 'open' || o.decision === 'keep' ? <DecideByBadge day={o.decideBy} /> : null}
        </>
      }
      title={
        <Link href={detailHref(o.id)} className="hover:underline focus-visible:underline">
          {o.title}
        </Link>
      }
      meta={
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="size-3" aria-hidden />
            {o.evidenceSupports} ủng hộ
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsDown className="size-3" aria-hidden />
            {o.evidenceContradicts} phản bác
          </span>
        </span>
      }
      actions={
        <>
          <Button size="xs" render={<Link href={detailHref(o.id)} />}>
            Mở
          </Button>
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </Button>
          {o.stale && (
            <Button size="xs" variant="outline" onClick={onDrop}>
              Bỏ cơ hội này
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm leading-relaxed">{o.hypothesis}</p>
      {o.nextAction && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Kế tiếp:</span> {o.nextAction}
        </p>
      )}
      <ScoresLine scores={o.scores} />
      <FitBadges fit={o.fit} />
    </BrainCard>
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect
          label="Quyết định"
          value={decision}
          onChange={setDecision}
          choices={decisionChoices}
          className="w-auto"
        />
        <ChoiceSelect label="Bằng chứng" value={stale} onChange={setStale} choices={staleChoices} className="w-auto" />
        <Button className="ms-auto" onClick={openNew} aria-keyshortcuts="n">
          <Plus aria-hidden />
          Cơ hội mới
          <Kbd className="ms-1 hidden bg-primary-foreground/20 text-primary-foreground sm:inline-flex">N</Kbd>
        </Button>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={opps} />
      {opps.error && !opps.data ? (
        <ApiErrorState error={opps.error} onRetry={opps.reload} />
      ) : opps.loading && list.length === 0 ? (
        <LoadingCards />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Lightbulb aria-hidden />}
          title={filtered ? 'Không có cơ hội nào khớp bộ lọc' : 'Chưa có cơ hội nào'}
          description={
            filtered
              ? 'Đổi bộ lọc để xem các cơ hội khác.'
              : 'Ghi một giả thuyết: ai, đau gì, trả tiền cho gì. Tin trong bản tin sáng và mục inbox sẽ thành bằng chứng.'
          }
        >
          {!filtered && (
            <Button onClick={openNew}>
              <Plus aria-hidden />
              Cơ hội mới
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((o) => (
            <OpportunityCard
              key={o.id}
              o={o}
              onEdit={() => {
                setEditing(o);
                setDialogOpen(true);
              }}
              onDrop={() => void drop(o)}
            />
          ))}
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
