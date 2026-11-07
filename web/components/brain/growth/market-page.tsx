'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ClipboardPaste, ExternalLink, Newspaper, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { Page } from '@/lib/api/client';
import { growthApi, type ApiJobAd, type ApiMarketReport, type ApiMarketSkill } from '@/lib/api/growth';
import { appendNextPage, toApiError, useApi } from '@/lib/api/use-api';
import { hostOf } from '@/lib/labels';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { MenuItem, MenuLinkItem, MenuSeparator } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { ApiErrorState, ApiStaleAlert, EmptyState, LoadingCards, describeApiError, openError } from '../api-state';
import { BrainCard, StatusBadge } from '../brain-card';
import { ConfirmDelete } from '../confirm-delete';
import { EmptyPanel } from '../empty-panel';
import { GhostRows } from '../ghost-rows';
import { PAGE_WIDTH } from '../layout';
import { RowMenu } from '../row-menu';
import { JobAdDialog } from './job-ad-dialog';
import { MarketSkillTable, MatchedSkill } from './market-chart';
import { addMonths, formatDay, monthLabel, seniority, thisMonth, twoQuestions } from './labels';
import { PeriodStepper, SectionTitle, useShortcuts } from './shared';
import { SkillDialog } from './skill-dialog';

function adState(ad: ApiJobAd): { label: string; tone: 'success' | 'secondary' | 'error' } {
  if (ad.processed) return { label: 'Đã phân tích', tone: 'success' };
  if (ad.error) return { label: 'Lỗi phân tích', tone: 'error' };
  return { label: 'Đang chờ phân tích', tone: 'secondary' };
}

/** "tự động" after a value the AI derived (DESIGN.md §4, D18). */
function Auto() {
  return <span className="text-xs text-muted-foreground">tự động</span>;
}

/**
 * One job ad as a row (DESIGN.md D13): status and title, company/host/date meta, the AI-derived level and skills
 * (labelled "tự động"); the title opens the edit dialog, the rest of the actions sit in the row menu.
 */
function JobAdRow({ ad, onEdit, onDeleted }: { ad: ApiJobAd; onEdit: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const s = adState(ad);
  const host = hostOf(ad.url);
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
          <button
            type="button"
            onClick={onEdit}
            className="min-w-0 text-start text-sm font-medium break-words underline-offset-4 hover:underline"
          >
            {ad.title}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {[ad.company, host, `thêm ${formatDay(ad.createdAt)}`].filter(Boolean).join(' · ')}
        </p>
        {ad.processed && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" aria-label="Cấp bậc và kỹ năng được đòi">
            <Badge variant="secondary">{seniority[ad.seniority]}</Badge>
            {ad.skills.map((k) => (
              <Badge key={k} variant="outline">
                {k}
              </Badge>
            ))}
            <Auto />
          </div>
        )}
        {!ad.processed && ad.error && (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>AI không trả về kết quả hợp lệ. Sửa tin để phân tích lại, hoặc tự điền kỹ năng.</p>
            <details>
              <summary className="w-fit cursor-pointer select-none">Chi tiết kỹ thuật</summary>
              <p className="mt-1 break-words font-mono text-xs" lang="en">
                {ad.error}
              </p>
            </details>
          </div>
        )}
        {!ad.processed && !ad.error && (
          <p className="text-xs text-muted-foreground">Kỹ năng và cấp bậc sẽ được rút ra trong nền, vài phút sau.</p>
        )}
      </div>
      <RowMenu label={`Thao tác với tin "${ad.title}"`}>
        <MenuItem onClick={onEdit}>
          <Pencil aria-hidden />
          Sửa
        </MenuItem>
        {/^https?:\/\//.test(ad.url) && (
          <MenuLinkItem render={<a href={ad.url} target="_blank" rel="noopener noreferrer" />}>
            <ExternalLink aria-hidden />
            Mở tin
          </MenuLinkItem>
        )}
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden />
          Xóa
        </MenuItem>
      </RowMenu>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title="Xóa tin tuyển dụng?"
        description={`"${ad.title}" bị xóa và không còn tính vào báo cáo thị trường tháng này. Không hoàn tác được.`}
        action={() => growthApi.deleteJobAd(ad.id)}
        onDeleted={onDeleted}
      />
    </li>
  );
}

/** Gaps: one flat section, rows in one bordered list on a shared grid (name, count, matched skill, action). */
function Gaps({ gaps, onAdd }: { gaps: ApiMarketSkill[]; onAdd: (name: string) => void }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="market-gaps">
      <SectionTitle>
        <span id="market-gaps">Thị trường đòi mà mình chưa có bằng chứng</span>
      </SectionTitle>
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có khoảng trống: mọi kỹ năng được đòi đều có trong ma trận và chưa mờ.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {gaps.map((g) => (
            <li
              key={g.name}
              className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-1.5 sm:grid-cols-[minmax(0,1fr)_4rem_10rem_auto]"
            >
              <span className="text-sm font-medium break-words">{g.name}</span>
              <span className="text-end text-xs text-muted-foreground tabular-nums">{g.count} tin</span>
              <span className="min-w-0 max-sm:hidden">
                <MatchedSkill line={g} />
              </span>
              <span className="justify-self-end">
                {g.skill ? (
                  <Button size="xs" variant="outline" render={<Link href={`/phat-trien/ky-nang/?id=${g.skill.id}`} />}>
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
    </section>
  );
}

/** New tools from the morning brief: stories worth reading in place, so cards, one column; none yet: one surface. */
function NewTools({ items }: { items: ApiMarketReport['newTools'] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="new-tools">
      <SectionTitle>
        <span id="new-tools">Công cụ và kỹ năng mới từ bản tin sáng</span>
      </SectionTitle>
      {items.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Tháng này bản tin chưa gắn tin nào là công cụ hay kỹ năng mới.
        </p>
      ) : (
        <>
          {/* DECISIONS 6.1: the two questions, behind a disclosure (DESIGN.md §7: help text is not content) */}
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer select-none font-medium">Hai câu hỏi trước khi học</summary>
            <ol className="mt-1.5 list-decimal ps-5 leading-relaxed">
              {twoQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
            <p className="mt-1">Chỉ học thứ trả lời &quot;có&quot; cho cả hai.</p>
          </details>
          <ul className="flex flex-col gap-3">
            {items.map((n) => (
              <li key={n.id}>
                <BrainCard
                  badges={
                    <>
                      <Badge variant="secondary">{n.source.name}</Badge>
                      {n.relevance ? (
                        <>
                          <Badge variant="outline">liên quan {n.relevance}/5</Badge>
                          <Auto />
                        </>
                      ) : null}
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
                  {n.summary && (
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      <span className="text-xs">Tóm tắt tự động: </span>
                      {n.summary}
                    </p>
                  )}
                </BrainCard>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Report({ report, onAddSkill }: { report: ApiMarketReport; onAddSkill: (name: string) => void }) {
  const pending = report.jobAds - report.processed;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="text-sm">
          <span className="font-heading text-2xl font-semibold tabular-nums">{report.jobAds}</span>{' '}
          <span className="text-muted-foreground">tin trong tháng</span>
          {pending > 0 && <span className="text-muted-foreground"> · {pending} đang chờ phân tích</span>}
        </p>
        {report.seniority.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Cấp bậc">
              {report.seniority.map((s) => (
                <li key={s.level}>
                  <Badge variant="outline">
                    {seniority[s.level]} <span className="font-semibold tabular-nums">{s.count}</span>
                  </Badge>
                </li>
              ))}
            </ul>
            <Auto />
          </div>
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
  const empty = !!report.data && report.data.jobAds === 0;
  // First run = no ad in any month (one row is enough to know); asked only while this month is empty.
  const askAny = empty && month === current;
  const anyAds = useApi<Page<ApiJobAd>>(askAny ? 'job-ads:any' : null, () => growthApi.listJobAds({ limit: 1 }));
  // Only a fresh answer decides: an earlier "none" may be stale after an ad was pasted
  const checking = askAny && anyAds.loading;
  const firstRun = askAny && !anyAds.loading && !anyAds.error && anyAds.data?.results.length === 0;

  const paste = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useShortcuts({ n: paste });
  const refresh = () => {
    report.reload();
    ads.reload();
    if (anyAds.data) anyAds.reload();
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
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* No toolbar before the first ad (D26), kept while that is checked (no flicker on a month empty for now); an
          empty month keeps the stepper but drops "Làm mới" */}
      {!firstRun && (
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
            {/* Icon-only below 640 px, so it carries a tooltip (DESIGN.md D21) */}
            {!empty && (
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" onClick={refresh} aria-label="Làm mới" />}>
                  <RefreshCw aria-hidden />
                  <span className="max-sm:hidden">Làm mới</span>
                </TooltipTrigger>
                <TooltipPopup>Làm mới</TooltipPopup>
              </Tooltip>
            )}
            {/* While the month is empty the EmptyState button is the one primary (DESIGN.md D2) */}
            <Button variant={empty ? 'outline' : 'default'} onClick={paste}>
              <ClipboardPaste aria-hidden />
              Dán tin tuyển dụng <Kbd className="max-sm:hidden pointer-coarse:hidden">N</Kbd>
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={report} />
      {report.error && !report.data ? (
        <ApiErrorState error={report.error} onRetry={report.reload} />
      ) : (report.loading && !report.data) || checking ? (
        <LoadingCards count={2} />
      ) : firstRun ? (
        <EmptyPanel
          glyph={Newspaper}
          title="Chưa có tin tuyển dụng nào"
          text="Dán 5 đến 10 tin của vai trò nhắm tới; kỹ năng được rút ra trong nền rồi so với ma trận."
          action={
            <Button onClick={paste} aria-keyshortcuts="n">
              <ClipboardPaste aria-hidden />
              Dán tin đầu tiên
              <Kbd className="ms-1 bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">N</Kbd>
            </Button>
          }
          ghost={<GhostRows variant="chart" caption="Biểu đồ tần suất hiện khi có tin tuyển dụng đầu tiên." />}
        />
      ) : empty ? (
        <EmptyState
          icon={<Newspaper aria-hidden />}
          title={month === current ? 'Tháng này chưa có tin nào' : `${monthLabel(month)} chưa có tin nào`}
          description="Dán 5 đến 10 tin của vai trò nhắm tới; kỹ năng được rút ra trong nền rồi so với ma trận."
        >
          <Button onClick={paste}>
            <ClipboardPaste aria-hidden />
            Dán tin tuyển dụng
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
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {adList.map((ad) => (
              <JobAdRow
                key={ad.id}
                ad={ad}
                onEdit={() => {
                  setEditing(ad);
                  setDialogOpen(true);
                }}
                onDeleted={() => {
                  ads.mutate((d) => d && { ...d, results: d.results.filter((x) => x.id !== ad.id) });
                  report.reload();
                  if (anyAds.data) anyAds.reload();
                  setNotice(`Đã xóa "${ad.title}"`);
                }}
              />
            ))}
          </ul>
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
