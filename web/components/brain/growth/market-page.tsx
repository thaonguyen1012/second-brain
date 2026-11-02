'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, ClipboardPaste, ExternalLink, HelpCircle, Pencil, Plus, RefreshCw, Sparkles } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { growthApi, type ApiJobAd, type ApiMarketReport, type ApiMarketSkill } from '@/lib/api/growth';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { hostOf } from '@/lib/labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError, openError } from '../api-state';
import { BrainCard, StatusBadge } from '../brain-card';
import { ConfirmDelete, DeleteButton } from '../confirm-delete';
import { JobAdDialog } from './job-ad-dialog';
import { MarketSkillTable, MatchedSkill } from './market-chart';
import { addMonths, formatDay, monthLabel, seniority, thisMonth, twoQuestions } from './labels';
import { PeriodStepper, SectionTitle, useShortcuts } from './shared';
import { SkillDialog } from './skill-dialog';

function adState(ad: ApiJobAd): { label: string; tone: 'success' | 'info' | 'error' } {
  if (ad.processed) return { label: 'Đã phân tích', tone: 'success' };
  if (ad.error) return { label: 'Lỗi phân tích', tone: 'error' };
  return { label: 'Đang chờ phân tích', tone: 'info' };
}

function JobAdCard({ ad, onEdit, onDeleted }: { ad: ApiJobAd; onEdit: () => void; onDeleted: () => void }) {
  const s = adState(ad);
  const host = hostOf(ad.url);
  return (
    <BrainCard
      badges={
        <>
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          {ad.processed && <Badge variant="secondary">{seniority[ad.seniority]}</Badge>}
        </>
      }
      title={ad.title}
      meta={[ad.company, host, `thêm ${formatDay(ad.createdAt)}`].filter(Boolean).join(' · ')}
      actions={
        <>
          <Button size="xs" variant="outline" onClick={onEdit}>
            <Pencil aria-hidden />
            Sửa
          </Button>
          {/^https?:\/\//.test(ad.url) && (
            <Button
              size="xs"
              variant="ghost"
              render={<a href={ad.url} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink aria-hidden />
              Mở tin
            </Button>
          )}
          <ConfirmDelete
            title="Xóa tin tuyển dụng?"
            description={`"${ad.title}" bị xóa và không còn tính vào báo cáo thị trường tháng này. Không hoàn tác được.`}
            action={() => growthApi.deleteJobAd(ad.id)}
            onDeleted={onDeleted}
            focusNeighbour
            trigger={<DeleteButton className="ms-auto" aria-label={`Xóa tin "${ad.title}"`} />}
          />
        </>
      }
    >
      {ad.processed && ad.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Kỹ năng được đòi">
          {ad.skills.map((k) => (
            <Badge key={k} variant="outline">
              {k}
            </Badge>
          ))}
        </div>
      )}
      {!ad.processed && ad.error && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>AI không trả về kết quả hợp lệ. Sửa tin để phân tích lại, hoặc tự điền kỹ năng.</p>
          <details>
            <summary className="w-fit cursor-pointer select-none">Chi tiết kỹ thuật</summary>
            <p className="mt-1 break-words font-mono text-[11px]" lang="en">
              {ad.error}
            </p>
          </details>
        </div>
      )}
      {!ad.processed && !ad.error && (
        <p className="text-xs text-muted-foreground">Kỹ năng và cấp bậc sẽ được rút ra trong nền, vài phút sau.</p>
      )}
    </BrainCard>
  );
}

function Gaps({ gaps, onAdd }: { gaps: ApiMarketSkill[]; onAdd: (name: string) => void }) {
  return (
    <Card className="flex flex-col gap-3 rounded-3xl border p-4 shadow-depth-1 sm:p-5">
      <SectionTitle>Thị trường đòi mà mình chưa có bằng chứng</SectionTitle>
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có khoảng trống: mọi kỹ năng được đòi đều có trong ma trận và chưa mờ.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {gaps.map((g) => (
            <li key={g.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="font-medium">{g.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{g.count} tin</span>
              <MatchedSkill line={g} />
              <span className="ms-auto">
                {g.skill ? (
                  <Button size="xs" variant="outline" render={<Link href="/phat-trien/ky-nang/" />}>
                    Thêm bằng chứng
                  </Button>
                ) : (
                  <Button size="xs" variant="outline" onClick={() => onAdd(g.name)}>
                    <Plus aria-hidden />
                    Thêm vào ma trận
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function NewTools({ items }: { items: ApiMarketReport['newTools'] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="new-tools">
      <SectionTitle>
        <span id="new-tools" className="inline-flex items-center gap-2">
          <Sparkles className="size-4.5 text-muted-foreground" aria-hidden />
          Công cụ và kỹ năng mới từ bản tin sáng
        </span>
      </SectionTitle>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary p-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <HelpCircle className="size-4" aria-hidden />
          Trước khi học cái nào, hỏi hai câu:
        </p>
        <ol className="list-decimal ps-6 text-muted-foreground">
          {twoQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">Chỉ học thứ trả lời &quot;có&quot; cho cả hai.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tháng này bản tin chưa gắn tin nào là công cụ hay kỹ năng mới.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((n) => (
            <li key={n.id}>
              <BrainCard
                className="h-full"
                badges={
                  <>
                    <Badge variant="secondary">{n.source.name}</Badge>
                    {n.relevance ? <Badge variant="outline">liên quan {n.relevance}/5</Badge> : null}
                  </>
                }
                title={
                  /^https?:\/\//.test(n.url) ? (
                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {n.title}
                    </a>
                  ) : (
                    n.title
                  )
                }
                meta={formatDay(n.published ?? n.createdAt)}
              >
                {n.summary && <p className="text-sm text-muted-foreground">{n.summary}</p>}
              </BrainCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Report({ report, onAddSkill }: { report: ApiMarketReport; onAddSkill: (name: string) => void }) {
  const pending = report.jobAds - report.processed;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p className="text-sm">
          <span className="font-heading text-2xl font-semibold">{report.jobAds}</span>{' '}
          <span className="text-muted-foreground">tin trong tháng</span>
          {pending > 0 && <span className="text-muted-foreground"> · {pending} đang chờ phân tích</span>}
        </p>
        {report.seniority.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Cấp bậc">
            {report.seniority.map((s) => (
              <li key={s.level}>
                <Badge variant="outline" size="lg">
                  {seniority[s.level]} <span className="font-semibold tabular-nums">{s.count}</span>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
      {report.processed === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có tin nào được phân tích xong trong tháng này.</p>
      ) : (
        <>
          <Gaps gaps={report.gaps} onAdd={onAddSkill} />
          <section className="flex flex-col gap-3" aria-labelledby="market-skills">
            <SectionTitle>
              <span id="market-skills">Tần suất kỹ năng so với tháng trước</span>
            </SectionTitle>
            <MarketSkillTable lines={report.skills} processed={report.processed} />
          </section>
        </>
      )}
    </div>
  );
}

/** Thị trường: paste job ads, see what the market asks for vs the skills matrix (DECISIONS 9.2 Market). */
export function MarketPage() {
  const [month, setMonth] = useState(thisMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ApiJobAd | null>(null);
  const [newSkill, setNewSkill] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const report = useApi(`market-report:${month}`, () => growthApi.getMarketReport(month));
  const ads = useApi<Page<ApiJobAd>>(`job-ads:${month}`, () => growthApi.listJobAds({ month, limit: 100 }));
  const adList = ads.loading ? [] : (ads.data?.results ?? []);
  const current = thisMonth();

  const paste = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useShortcuts({ n: paste });
  const refresh = () => {
    report.reload();
    ads.reload();
  };

  // ?jobAd=N (Cmd+K result): show the ad's month and open the ad.
  useOpenFromUrl('jobAd', (id) => {
    growthApi.getJobAd(id).then(
      (ad) => {
        setMonth(ad.month);
        setEditing(ad);
        setDialogOpen(true);
      },
      (err: unknown) => setNotice(openError(err, `Không tìm thấy tin tuyển dụng #${id}, có thể đã bị xóa.`)),
    );
  });

  const loadMore = async () => {
    const next = ads.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      await appendNextPage(ads);
    } catch (err) {
      setNotice(describeApiError(toApiError(err)).title);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodStepper
          name="tháng"
          label={monthLabel(month)}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          nextDisabled={month >= current}
          current={month === current}
          onCurrent={() => setMonth(current)}
          currentLabel="Tháng này"
        />
        <div className="ms-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={refresh} aria-label="Làm mới">
            <RefreshCw aria-hidden />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
          <Button onClick={paste}>
            <ClipboardPaste aria-hidden />
            Dán tin tuyển dụng <Kbd className="hidden sm:inline-flex">N</Kbd>
          </Button>
        </div>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={report} />
      {report.error && !report.data ? (
        <ApiErrorState error={report.error} onRetry={report.reload} />
      ) : report.loading && !report.data ? (
        <LoadingCards count={2} />
      ) : report.data && report.data.jobAds === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness aria-hidden />}
          title={`${monthLabel(month)} chưa có tin tuyển dụng nào`}
          description="Dán 5 đến 10 tin của vai trò nhắm tới (Product Engineer AI-native, Forward-Deployed Engineer…). Kỹ năng được rút ra trong nền rồi so với ma trận của mình."
        >
          <Button onClick={paste}>
            <ClipboardPaste aria-hidden />
            Dán tin đầu tiên
          </Button>
        </EmptyState>
      ) : report.data ? (
        <div className={report.loading ? 'opacity-60 transition-opacity' : undefined}>
          <Report report={report.data} onAddSkill={setNewSkill} />
        </div>
      ) : null}

      {report.data && <NewTools items={report.data.newTools} />}

      {adList.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="job-ads">
          <SectionTitle>
            <span id="job-ads">Tin tuyển dụng {monthLabel(month).toLowerCase()}</span>
          </SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {adList.map((ad) => (
              <JobAdCard
                key={ad.id}
                ad={ad}
                onEdit={() => {
                  setEditing(ad);
                  setDialogOpen(true);
                }}
                onDeleted={() => {
                  ads.mutate((d) => d && { ...d, results: d.results.filter((x) => x.id !== ad.id) });
                  report.reload();
                  setNotice(`Đã xóa "${ad.title}"`);
                }}
              />
            ))}
          </div>
          {ads.data?.next && (
            <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
              Tải thêm
            </Button>
          )}
        </section>
      )}
      <ApiStaleAlert result={ads} />
      {ads.error && !ads.data && !report.error && <ApiErrorState error={ads.error} onRetry={ads.reload} />}

      <JobAdDialog
        open={dialogOpen}
        ad={editing}
        month={month}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          setDialogOpen(false);
          setNotice(
            created
              ? `Đã lưu "${saved.title}". Kỹ năng sẽ được rút ra trong nền, bấm Làm mới sau vài phút.`
              : `Đã lưu "${saved.title}"`,
          );
          if (saved.month !== month) setMonth(saved.month);
          else refresh();
        }}
      />
      <SkillDialog
        open={newSkill !== null}
        skill={null}
        initialName={newSkill ?? undefined}
        onOpenChange={(open) => !open && setNewSkill(null)}
        onSaved={(saved) => {
          setNewSkill(null);
          setNotice(`Đã thêm "${saved.name}" vào ma trận. Gắn bằng chứng ở trang Kỹ năng để nó sáng lên.`);
          report.reload();
        }}
      />
    </div>
  );
}
