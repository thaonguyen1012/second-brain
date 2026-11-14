'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Gauge, Link2, MessagesSquare, Pencil, SearchX } from 'lucide-react';
import {
  opportunitiesApi,
  type ApiDecision,
  type ApiEvidence,
  type ApiOpportunityDetail,
} from '@/lib/api/opportunities';
import { toApiError, useApi } from '@/lib/api/use-api';
import { formatDate } from '@/lib/labels';
import { tabPanelProps, tabProps } from '@/lib/tab-panel';
import { useT } from '@/lib/i18n/client';
import { useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, EmptyState, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { AreaTile } from '../page-header';
import { DecideByBadge, FitBadges, Tip } from './bits';
import { EvidenceDialog, type EvidenceTarget } from './evidence-dialog';
import { STALE_LABEL, decisionOf, decisions, evidenceKinds, formatDay, stanceOf } from './labels';
import { OpportunityFormDialog } from './opportunity-form-dialog';
import { ScoreDialog } from './score-dialog';
import { ScoreHistoryChart } from './score-history-chart';
import { useShortcuts } from './use-shortcuts';

type StanceFilter = 'all' | 'supports' | 'contradicts';

/** The evidence the stance tabs filter (lib/tab-panel.ts). */
const EVIDENCE_PANEL = 'evidence-list';

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={id} className="me-auto font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Only http(s) links become anchors; they open in a new tab and send no referrer. */
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : null);

/** One evidence record: stance and kind as meta words, the title, the note; edit and delete as icon buttons. */
function EvidenceRow({
  e,
  opportunityId,
  onEdit,
  onDeleted,
}: {
  e: ApiEvidence;
  opportunityId: number;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const s = stanceOf(e.stance);
  const href = safeUrl(e.url);
  const name = e.title || e.url;
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t(s.label)}</span> · {t(evidenceKinds[e.kind])} ·{' '}
          {formatDay(e.date)}
        </p>
        <p className="text-sm font-medium break-words">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 hover:underline"
            >
              {e.title || href}
              <ExternalLink
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-label={t('(mở tab mới)')}
              />
            </a>
          ) : (
            e.title
          )}
        </p>
        {e.note && (
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">{e.note}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tip
          trigger={
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={onEdit}
              aria-label={t('Sửa bằng chứng "{title}"', { title: name })}
            >
              <Pencil aria-hidden />
            </Button>
          }
        >
          {t('Sửa')}
        </Tip>
        <Tooltip>
          <ConfirmDelete
            title={t('Xóa bằng chứng?')}
            description={t(
              '"{title}" bị gỡ khỏi cơ hội này. Mục inbox, item hay ghi chú gốc vẫn giữ nguyên. Không hoàn tác được.',
              { title: name },
            )}
            action={() => opportunitiesApi.deleteEvidence(opportunityId, e.id)}
            onDeleted={onDeleted}
            trigger={
              <TooltipTrigger
                render={
                  <DeleteButton size="icon-sm" label="" aria-label={t('Xóa bằng chứng "{title}"', { title: name })} />
                }
              />
            }
          />
          <TooltipPopup>{t('Xóa')}</TooltipPopup>
        </Tooltip>
      </div>
    </li>
  );
}

/** Loading state at the real geometry: badge row, title, hypothesis, action row, then the two panels. */
function DetailSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-1.5">
          <Skeleton className="h-4.5 w-16" />
          <Skeleton className="h-4.5 w-28" />
          <Skeleton className="h-4.5 w-24" />
        </div>
        {/* The tile is static, so it shows while loading and the title does not shift when the data arrives */}
        <div className="flex items-start gap-3">
          <AreaTile nav="/co-hoi/" />
          <Skeleton className="h-9 w-2/3 max-w-xl rounded-md" />
        </div>
        <div className="flex max-w-2xl flex-col gap-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

/** Decision picker whose value is the decision's status badge (same pattern as the objective status). */
function DecisionSelect({ value, onChange }: { value: ApiDecision; onChange: (value: ApiDecision) => void }) {
  const t = useT();
  return (
    <Select
      items={decisions.map((d) => ({ value: d.value, label: t(d.label) }))}
      value={value}
      onValueChange={(v) => v !== null && v !== value && onChange(v as ApiDecision)}
    >
      <SelectTrigger aria-label={t('Quyết định')} className="w-auto min-w-0">
        <span className="text-sm text-muted-foreground">{t('Quyết định')}</span>
        <SelectValue>
          {(v: ApiDecision) => {
            const d = decisionOf(v);
            return <StatusBadge tone={d.tone}>{t(d.label)}</StatusBadge>;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {decisions.map((x) => (
          <SelectItem key={x.value} value={x.value}>
            {t(x.label)}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

/** One opportunity: hypothesis, decision, score history, fit skills and the evidence list. */
export function OpportunityDetail({ id }: { id: number }) {
  const t = useT();
  const keys = useSingleKeyShortcuts();
  const opp = useApi<ApiOpportunityDetail>(`opportunity:${id}`, () => opportunitiesApi.get(id));
  const [editOpen, setEditOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceTarget | null>(null);
  const [stanceFilter, setStanceFilter] = useState<StanceFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const o = opp.data;

  const anyDialog = editOpen || scoreOpen || evidence !== null;
  useShortcuts(
    {
      e: () => setEditOpen(true),
      s: () => setScoreOpen(true),
      c: () => setEvidence({ mode: 'add', kind: 'conversation' }),
      l: () => setEvidence({ mode: 'add', kind: 'link' }),
    },
    !!o && !anyDialog,
  );

  const decide = async (decision: ApiDecision) => {
    if (!o) return;
    try {
      const saved = await opportunitiesApi.update(o.id, { decision });
      opp.mutate(() => saved);
      setNotice(t('Quyết định: {decision}', { decision: t(decisionOf(decision).label) }));
    } catch (err) {
      setNotice(describeApiError(toApiError(err), t).title);
    }
  };

  const back = (
    <Link
      href="/co-hoi/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t('Tất cả cơ hội')}
    </Link>
  );

  if (opp.error && !o) {
    if (opp.error.status === 404 && opp.error.reachable)
      return (
        <div className="flex flex-col gap-4">
          {back}
          <EmptyState
            icon={<SearchX aria-hidden />}
            title={t('Không tìm thấy cơ hội này')}
            description={t('Có thể link đã cũ. Quay lại danh sách để chọn cơ hội khác.')}
          />
        </div>
      );
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ApiErrorState error={opp.error} onRetry={opp.reload} />
      </div>
    );
  }
  if (!o)
    return (
      <div className="flex flex-col gap-3">
        {back}
        <DetailSkeleton />
      </div>
    );

  const shown = o.evidence.filter((e) => stanceFilter === 'all' || e.stance === stanceFilter);
  const stanceTabs: { value: StanceFilter; label: string }[] = [
    { value: 'all', label: t('Tất cả ({n})', { n: o.evidence.length }) },
    { value: 'supports', label: t('Ủng hộ ({n})', { n: o.evidenceSupports }) },
    { value: 'contradicts', label: t('Phản bác ({n})', { n: o.evidenceContradicts }) },
  ];
  const undecided = o.decision === 'open' || o.decision === 'keep';
  const flags = o.stale || (undecided && !!o.decideBy);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {back}
        {flags && (
          <div className="flex flex-wrap items-center gap-1.5">
            {o.stale && <StatusBadge tone="warning">{t(STALE_LABEL)}</StatusBadge>}
            {undecided && <DecideByBadge day={o.decideBy} />}
          </div>
        )}
        {/* The Cơ hội title icon, as on the list page (PageHeader nav); min-w-0 lets a long title wrap */}
        <div className="flex items-start gap-3">
          <AreaTile nav="/co-hoi/" />
          <h1 className="min-w-0 font-heading text-3xl font-semibold tracking-tight break-words">{o.title}</h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-foreground">{o.hypothesis}</p>
        <div className="flex flex-wrap items-center gap-2">
          <DecisionSelect value={o.decision} onChange={(v) => void decide(v)} />
          {o.decidedAt && o.decision !== 'open' && (
            <span className="text-xs text-muted-foreground">
              {t('từ {date}', { date: formatDate(o.decidedAt, t) }, 'since')}
            </span>
          )}
          <Tip
            trigger={
              <Button variant="outline" onClick={() => setEditOpen(true)} aria-keyshortcuts={keys ? 'e' : undefined}>
                <Pencil aria-hidden />
                {t('Sửa')}
              </Button>
            }
          >
            {t('Sửa cơ hội')}
            {keys && <> <Kbd>E</Kbd></>}
          </Tip>
        </div>
        <p className="text-sm text-muted-foreground empty:sr-only" role="status">
          {notice}
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="opp-plan" title={t('Vì sao bây giờ và bước kế tiếp')}>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{t('Vì sao bây giờ')}</dt>
              <dd className="leading-relaxed whitespace-pre-line">{o.whyNow || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{t('Hành động kế tiếp')}</dt>
              <dd className="leading-relaxed">{o.nextAction || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{t('Hạn quyết giữ, bỏ hay làm')}</dt>
              <dd>{o.decideBy ? formatDay(o.decideBy) : t('Chưa đặt')}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">{t('Hợp với mình')}</dt>
              <dd>
                {o.fit.length ? (
                  <FitBadges fit={o.fit} />
                ) : (
                  <span className="text-muted-foreground">{t('Chưa chọn kỹ năng nào')}</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">{t('Bằng chứng gần nhất')}</dt>
              <dd>{o.lastEvidenceAt ? formatDate(o.lastEvidenceAt, t) : t('Chưa có')}</dd>
            </div>
          </dl>
        </Section>

        <Section
          id="opp-scores"
          title={t('Điểm tự chấm')}
          action={
            <Button size="sm" onClick={() => setScoreOpen(true)} aria-keyshortcuts={keys ? 's' : undefined}>
              <Gauge aria-hidden />
              {t('Chấm điểm')}
              {keys && (
                <Kbd className="bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">
                  S
                </Kbd>
              )}
            </Button>
          }
        >
          <ScoreHistoryChart history={o.scoreHistory} />
        </Section>
      </div>

      <Section
        id="opp-evidence"
        title={t('Bằng chứng')}
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEvidence({ mode: 'add', kind: 'conversation' })}
              aria-keyshortcuts={keys ? 'c' : undefined}
            >
              <MessagesSquare aria-hidden />
              {t('Cuộc nói chuyện')}
              {keys && <Kbd className="pointer-coarse:hidden max-sm:hidden">C</Kbd>}
            </Button>
            <Tip
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEvidence({ mode: 'add', kind: 'link' })}
                  aria-keyshortcuts={keys ? 'l' : undefined}
                >
                  <Link2 aria-hidden />
                  {t('Link')}
                </Button>
              }
            >
              {t('Thêm link')}
              {keys && <> <Kbd>L</Kbd></>}
            </Tip>
          </>
        }
      >
        {o.evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              'Chưa có bằng chứng. Ghi lại một cuộc nói chuyện thật hoặc một link; tin trong bản tin sáng và mục inbox cũng gắn được vào đây.',
            )}
          </p>
        ) : (
          <>
            <Tabs value={stanceFilter} onValueChange={(v) => setStanceFilter(v as StanceFilter)}>
              <TabsList variant="underline" aria-label={t('Lọc bằng chứng')}>
                {stanceTabs.map((tab) => (
                  <TabsTab key={tab.value} value={tab.value} {...tabProps(EVIDENCE_PANEL, tab.value)}>
                    {tab.label}
                  </TabsTab>
                ))}
              </TabsList>
            </Tabs>
            <div {...tabPanelProps(EVIDENCE_PANEL, stanceFilter)}>
              {shown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('Không có bằng chứng nào loại này.')}</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {shown.map((e) => (
                    <EvidenceRow
                      key={e.id}
                      e={e}
                      opportunityId={o.id}
                      onEdit={() => setEvidence({ mode: 'edit', evidence: e })}
                      onDeleted={() => {
                        opp.mutate((d) => d && { ...d, evidence: d.evidence.filter((x) => x.id !== e.id) });
                        setNotice(t('Đã xóa bằng chứng'));
                        // counts, last evidence date and "stale" are computed by the server
                        opp.reload();
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Section>

      <OpportunityFormDialog
        open={editOpen}
        opportunity={o}
        onOpenChange={setEditOpen}
        onSaved={(saved) => {
          opp.mutate(() => saved);
          setEditOpen(false);
          setNotice(t('Đã lưu'));
        }}
      />
      <ScoreDialog
        open={scoreOpen}
        opportunity={o}
        onOpenChange={setScoreOpen}
        onSaved={() => {
          setScoreOpen(false);
          setNotice(t('Đã lưu điểm mới'));
          opp.reload();
        }}
      />
      <EvidenceDialog
        opportunityId={o.id}
        target={evidence}
        onClose={() => setEvidence(null)}
        onSaved={(_, created) => {
          setEvidence(null);
          setNotice(t(created ? 'Đã thêm bằng chứng' : 'Đã lưu bằng chứng'));
          opp.reload();
        }}
      />
    </div>
  );
}
