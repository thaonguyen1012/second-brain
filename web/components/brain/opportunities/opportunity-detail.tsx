'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, ExternalLink, Gauge, Link2, MessagesSquare, Pencil, SearchX } from 'lucide-react';
import {
  opportunitiesApi,
  type ApiDecision,
  type ApiEvidence,
  type ApiOpportunityDetail,
} from '@/lib/api/opportunities';
import { toApiError, useApi } from '@/lib/api/use-api';
import { formatDate } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, EmptyState, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { DecideByBadge, FitBadges } from './bits';
import { EvidenceDialog, type EvidenceTarget } from './evidence-dialog';
import { STALE_LABEL, decisionOf, decisions, evidenceKinds, formatDay, stanceOf } from './labels';
import { OpportunityFormDialog } from './opportunity-form-dialog';
import { ScoreDialog } from './score-dialog';
import { ScoreHistoryChart } from './score-history-chart';
import { useShortcuts } from './use-shortcuts';

type StanceFilter = 'all' | 'supports' | 'contradicts';

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
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-3xl border bg-card p-4 shadow-depth-1 sm:p-5">
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

function EvidenceRow({ e, onEdit }: { e: ApiEvidence; onEdit: () => void }) {
  const s = stanceOf(e.stance);
  const href = safeUrl(e.url);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
        <Badge variant="secondary">{evidenceKinds[e.kind]}</Badge>
        <span className="text-xs text-muted-foreground">{formatDay(e.date)}</span>
        <Button
          size="xs"
          variant="ghost"
          className="ms-auto"
          onClick={onEdit}
          aria-label={`Sửa bằng chứng "${e.title}"`}
        >
          <Pencil aria-hidden />
          Sửa
        </Button>
      </div>
      <p className="text-sm font-medium break-words">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-start gap-1 hover:underline"
          >
            {e.title || href}
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="(mở tab mới)" />
          </a>
        ) : (
          e.title
        )}
      </p>
      {e.note && <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{e.note}</p>}
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Đang tải">
      <Skeleton className="h-10 w-2/3 rounded-xl" />
      <Skeleton className="h-40 rounded-3xl" />
      <Skeleton className="h-56 rounded-3xl" />
    </div>
  );
}

/** One opportunity: hypothesis, decision, score history, fit skills and the evidence list. */
export function OpportunityDetail({ id }: { id: number }) {
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
      setNotice(`Quyết định: ${decisionOf(decision).label}`);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    }
  };

  const back = (
    <Link
      href="/co-hoi/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Tất cả cơ hội
    </Link>
  );

  if (opp.error && !o) {
    if (opp.error.status === 404 && opp.error.reachable)
      return (
        <div className="flex flex-col gap-4">
          {back}
          <EmptyState
            icon={<SearchX aria-hidden />}
            title="Không tìm thấy cơ hội này"
            description="Có thể link đã cũ. Quay lại danh sách để chọn cơ hội khác."
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
      <div className="flex flex-col gap-4">
        {back}
        <DetailSkeleton />
      </div>
    );

  const d = decisionOf(o.decision);
  const shown = o.evidence.filter((e) => stanceFilter === 'all' || e.stance === stanceFilter);
  const stanceTabs: { value: StanceFilter; label: string }[] = [
    { value: 'all', label: `Tất cả (${o.evidence.length})` },
    { value: 'supports', label: `Ủng hộ (${o.evidenceSupports})` },
    { value: 'contradicts', label: `Phản bác (${o.evidenceContradicts})` },
  ];

  return (
    <div className="flex flex-col gap-5">
      {back}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={d.tone}>{d.label}</StatusBadge>
          {o.decidedAt && o.decision !== 'open' && (
            <span className="text-xs text-muted-foreground">từ {formatDate(o.decidedAt)}</span>
          )}
          {o.stale && (
            <StatusBadge tone="warning">
              <Clock aria-hidden />
              {STALE_LABEL}
            </StatusBadge>
          )}
          {(o.decision === 'open' || o.decision === 'keep') && <DecideByBadge day={o.decideBy} />}
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight break-words">{o.title}</h1>
        <p className="max-w-3xl text-base leading-relaxed">{o.hypothesis}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} aria-keyshortcuts="e">
            <Pencil aria-hidden />
            Sửa
            <Kbd className="hidden sm:inline-flex">E</Kbd>
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <span className="text-sm text-muted-foreground" id="decide-label">
            Quyết định:
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="decide-label">
            {decisions.map((x) => (
              <Button
                key={x.value}
                size="sm"
                variant={o.decision === x.value ? 'default' : 'outline'}
                aria-pressed={o.decision === x.value}
                onClick={() => o.decision !== x.value && void decide(x.value)}
              >
                {x.value === 'open' && o.decision !== 'open' ? 'Mở lại' : x.label}
              </Button>
            ))}
          </div>
        </div>
        {notice && (
          <p className="text-sm text-muted-foreground" role="status">
            {notice}
          </p>
        )}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section id="opp-plan" title="Vì sao bây giờ và bước kế tiếp">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Vì sao bây giờ</dt>
              <dd className="leading-relaxed whitespace-pre-line">{o.whyNow || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Hành động kế tiếp</dt>
              <dd className="leading-relaxed">{o.nextAction || '—'}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Hạn quyết giữ, bỏ hay làm</dt>
              <dd>{o.decideBy ? formatDay(o.decideBy) : 'Chưa đặt'}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs font-medium text-muted-foreground">Hợp với mình</dt>
              <dd>
                {o.fit.length ? (
                  <FitBadges fit={o.fit} />
                ) : (
                  <span className="text-muted-foreground">Chưa chọn kỹ năng nào</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-muted-foreground">Bằng chứng gần nhất</dt>
              <dd>{o.lastEvidenceAt ? formatDate(o.lastEvidenceAt) : 'Chưa có'}</dd>
            </div>
          </dl>
        </Section>

        <Section
          id="opp-scores"
          title="Điểm tự chấm"
          action={
            <Button size="sm" onClick={() => setScoreOpen(true)} aria-keyshortcuts="s">
              <Gauge aria-hidden />
              Chấm điểm
              <Kbd className="hidden bg-primary-foreground/20 text-primary-foreground sm:inline-flex">S</Kbd>
            </Button>
          }
        >
          <ScoreHistoryChart history={o.scoreHistory} />
        </Section>
      </div>

      <Section
        id="opp-evidence"
        title="Bằng chứng"
        action={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEvidence({ mode: 'add', kind: 'conversation' })}
              aria-keyshortcuts="c"
            >
              <MessagesSquare aria-hidden />
              Cuộc nói chuyện
              <Kbd className="hidden sm:inline-flex">C</Kbd>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEvidence({ mode: 'add', kind: 'link' })}
              aria-keyshortcuts="l"
            >
              <Link2 aria-hidden />
              Link
              <Kbd className="hidden sm:inline-flex">L</Kbd>
            </Button>
          </>
        }
      >
        {o.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc bằng chứng">
            {stanceTabs.map((t) => (
              <Button
                key={t.value}
                size="xs"
                variant={stanceFilter === t.value ? 'secondary' : 'ghost'}
                aria-pressed={stanceFilter === t.value}
                onClick={() => setStanceFilter(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        )}
        {o.evidence.length === 0 ? (
          <EmptyState
            title="Chưa có bằng chứng"
            description="Ghi lại một cuộc nói chuyện thật hoặc một link. Tin trong bản tin sáng và mục inbox cũng gắn được vào đây."
          />
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Không có bằng chứng nào loại này.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((e) => (
              <EvidenceRow key={e.id} e={e} onEdit={() => setEvidence({ mode: 'edit', evidence: e })} />
            ))}
          </ul>
        )}
      </Section>

      <OpportunityFormDialog
        open={editOpen}
        opportunity={o}
        onOpenChange={setEditOpen}
        onSaved={(saved) => {
          opp.mutate(() => saved);
          setEditOpen(false);
          setNotice('Đã lưu');
        }}
      />
      <ScoreDialog
        open={scoreOpen}
        opportunity={o}
        onOpenChange={setScoreOpen}
        onSaved={() => {
          setScoreOpen(false);
          setNotice('Đã lưu điểm mới');
          opp.reload();
        }}
      />
      <EvidenceDialog
        opportunityId={o.id}
        target={evidence}
        onClose={() => setEvidence(null)}
        onSaved={(_, created) => {
          setEvidence(null);
          setNotice(created ? 'Đã thêm bằng chứng' : 'Đã lưu bằng chứng');
          opp.reload();
        }}
      />
    </div>
  );
}
