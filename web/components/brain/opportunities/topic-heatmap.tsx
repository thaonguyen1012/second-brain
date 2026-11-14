'use client';
import { useRef, useState } from 'react';
import { opportunitiesApi, type ApiTopicCounts } from '@/lib/api/opportunities';
import { useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, ApiStaleAlert } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { PAGE_WIDTH } from '../layout';
import { formatDay } from './labels';

// Topic tags of the morning-brief news per ISO week (DECISIONS 9.2: replaces Exploding Topics).
// Heatmap: rows = topics (most frequent first, tail folded into "khác"), columns = weeks, one sequential hue.

const TOP = 10;
/** The folded tail's row: `OTHER.msgid` is its tag in the matrix, shown as t(OTHER). */
const OTHER = msg('khác');

const weekChoices = [
  { value: '4', label: msg('4 tuần') },
  { value: '8', label: msg('8 tuần') },
  { value: '12', label: msg('12 tuần') },
  { value: '26', label: msg('26 tuần') },
] as const;
type WeeksValue = (typeof weekChoices)[number]['value'];

interface Matrix {
  weeks: ApiTopicCounts['weeks'];
  rows: { tag: string; counts: number[]; total: number }[];
  max: number;
}

function buildMatrix(data: ApiTopicCounts): Matrix {
  const weeks = data.weeks;
  const totals = new Map<string, number>();
  for (const w of weeks) for (const t of w.topics) totals.set(t.tag, (totals.get(t.tag) ?? 0) + t.count);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
  const top = ranked.slice(0, ranked.length > TOP + 1 ? TOP : ranked.length);
  const rest = new Set(ranked.slice(top.length));
  const rows = top.map((tag) => {
    const counts = weeks.map((w) => w.topics.find((t) => t.tag === tag)?.count ?? 0);
    return { tag, counts, total: totals.get(tag) ?? 0 };
  });
  if (rest.size) {
    const counts = weeks.map((w) => w.topics.reduce((s, t) => s + (rest.has(t.tag) ? t.count : 0), 0));
    rows.push({ tag: OTHER.msgid, counts, total: counts.reduce((a, b) => a + b, 0) });
  }
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  return { weeks, rows, max };
}

/** Sequential fill: the data blue (--chart-data, never an area hue) mixed into the page surface, light to full. */
function fill(count: number, max: number): string | undefined {
  if (count === 0) return undefined;
  const pct = Math.round(18 + 82 * (count / max));
  return `color-mix(in oklab, var(--chart-data) ${pct}%, var(--background))`;
}

const shortWeek = (week: string) => week.replace(/^\d{4}-/, '');

function Heatmap({ m }: { m: Matrix }) {
  const t = useT();
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tagLabel = (tag: string) => (tag === OTHER.msgid ? t(OTHER) : tag);
  const nCols = m.weeks.length;
  const active = hover ?? cursor;
  const cell =
    active && m.rows[active.r]
      ? { row: m.rows[active.r], week: m.weeks[active.c], count: m.rows[active.r].counts[active.c] }
      : null;
  const every = nCols > 13 ? 2 : 1;

  const move = (dr: number, dc: number) => {
    const cur = cursor ?? { r: 0, c: nCols - 1 };
    const next = {
      r: Math.max(0, Math.min(m.rows.length - 1, cur.r + dr)),
      c: Math.max(0, Math.min(nCols - 1, cur.c + dc)),
    };
    setHover(null);
    setCursor(next);
    // The arrows move the cursor, not the box: where the grid scrolls sideways (390 px), the box follows the cursor
    gridRef.current
      ?.querySelector(`[data-cell="${next.r}-${next.c}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {cell
          ? t.rich('<b>{n} tin</b> · {tag} · tuần {week} (từ {date})', {
              b: (chunks) => <span className="font-semibold text-foreground tabular-nums">{chunks}</span>,
              n: cell.count,
              tag: tagLabel(cell.row.tag),
              week: shortWeek(cell.week.week),
              date: formatDay(cell.week.start),
            })
          : t('Rê chuột lên ô, hoặc chọn bảng rồi dùng phím mũi tên.')}
      </p>
      {/* The grid's focus ring and the cursor's ring lie outside the grid: the box that scrolls it keeps 4px of room
          for them (padding, with the same negative margin so nothing moves; scroll-margin, so scrolling to the grid or
          a cell keeps the room in view), or it cuts them off (WCAG 2.4.7). An outline, so forced colours keep it. */}
      <div className="-m-1 overflow-x-auto p-1">
        <div
          ref={gridRef}
          tabIndex={0}
          role="group"
          aria-label={t('Bản đồ nhiệt chủ đề theo tuần. Phím mũi tên để đi qua từng ô.')}
          className="grid min-w-max scroll-m-1 gap-0.5 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          style={{ gridTemplateColumns: `minmax(6rem, max-content) repeat(${nCols}, minmax(1.75rem, 1fr))` }}
          onKeyDown={(e) => {
            const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
            if (!d) return;
            e.preventDefault();
            move(d[0], d[1]);
          }}
          onBlur={() => setCursor(null)}
          onPointerLeave={() => setHover(null)}
        >
          <span aria-hidden />
          {m.weeks.map((w, c) => (
            <span key={w.week} aria-hidden className="pb-1 text-center text-[11px] text-muted-foreground tabular-nums">
              {c % every === (nCols - 1) % every ? shortWeek(w.week) : ''}
            </span>
          ))}
          {m.rows.map((row, r) => (
            <div key={row.tag} className="contents" aria-hidden>
              <span
                className={cn(
                  'truncate pe-3 text-xs leading-7',
                  row.tag === OTHER.msgid ? 'text-muted-foreground italic' : 'text-foreground',
                  active?.r === r && 'font-semibold',
                )}
              >
                {tagLabel(row.tag)}
              </span>
              {row.counts.map((n, c) => {
                const on = active?.r === r && active?.c === c;
                return (
                  <span
                    key={c}
                    data-cell={`${r}-${c}`}
                    onPointerEnter={() => setHover({ r, c })}
                    className={cn(
                      'h-7 scroll-m-1 rounded-sm transition-shadow',
                      n === 0 && 'bg-muted',
                      // The cursor's ring; forced colours drop box-shadows, so there it is a Highlight outline (as the
                      // week strip's today), or the arrows would move nothing in sight (WCAG 2.4.7)
                      on &&
                        'ring-2 ring-foreground/70 ring-offset-1 ring-offset-background forced-colors:outline-2 forced-colors:outline-offset-1 forced-colors:outline-[Highlight]',
                    )}
                    style={{ background: fill(n, m.max) }}
                  />
                );
              })}
            </div>
          ))}
          <span className="pt-1 pe-3 text-[11px] text-muted-foreground" aria-hidden>
            {t('số tin đã gắn tag')}
          </span>
          {m.weeks.map((w) => (
            <span key={w.week} aria-hidden className="pt-1 text-center text-[11px] text-muted-foreground tabular-nums">
              {w.items}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>{t('ít')}</span>
        {[0.15, 0.35, 0.55, 0.78, 1].map((f) => (
          <span key={f} className="h-3 w-5 rounded-sm" style={{ background: fill(f * m.max, m.max) }} />
        ))}
        <span>{t('nhiều (tối đa {n} tin một tuần)', { n: m.max })}</span>
        <span className="ms-2 inline-block h-3 w-5 rounded-sm bg-muted" />
        <span>{t('không có')}</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('Xem dạng bảng')}</summary>
        {/* Wider than the card at 390 px, the table scrolls inside this box, which is then a tab stop (a scroller with
            nothing focusable in it): its focus is the app's 2px ring outside the box, in the card's padding (inside the
            edge it would cover the first letters of the topics) */}
        <div className="mt-2 overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring">
          <table className="text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pe-3 font-medium">{t('Chủ đề')}</th>
                {m.weeks.map((w) => (
                  <th
                    key={w.week}
                    className="py-1 pe-3 font-medium"
                    title={t('từ {date}', { date: formatDay(w.start) })}
                  >
                    {shortWeek(w.week)}
                  </th>
                ))}
                <th className="py-1 font-medium">{t('Tổng')}</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((row) => (
                <tr key={row.tag} className="border-t">
                  <th scope="row" className="py-1 pe-3 font-normal">
                    {tagLabel(row.tag)}
                  </th>
                  {row.counts.map((n, c) => (
                    <td key={c} className="py-1 pe-3">
                      {n}
                    </td>
                  ))}
                  <td className="py-1 font-medium">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Widths of the empty frame's topic-label bars, fixed so they never read as data. */
const ghostLabel = ['w-14', 'w-10', 'w-12', 'w-8'] as const;

/**
 * No tagged news yet: the heatmap's own frame at its real geometry (the range's last 8 week columns, so a 12 or 26
 * week range still fits 390 px without scrolling; four muted rows), with the message over it (DESIGN.md §9a: show
 * what the block will become). Cells stay neutral; the data blue arrives only with data.
 */
function EmptyHeatmap({ weeks: range }: { weeks: Matrix['weeks'] }) {
  const t = useT();
  const weeks = range.slice(-8);
  const cols = { gridTemplateColumns: `minmax(4.5rem, max-content) repeat(${weeks.length}, minmax(1.75rem, 1fr))` };
  return (
    // Below sm the message sits above the frame; from sm it lies over the cells
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4">
      <div aria-hidden className="grid gap-0.5" style={cols}>
        <span />
        {weeks.map((w) => (
          <span key={w.week} className="pb-1 text-center text-[11px] text-muted-foreground tabular-nums">
            {shortWeek(w.week)}
          </span>
        ))}
        {ghostLabel.map((width) => (
          <div key={width} className="contents">
            <span className="flex h-6 items-center pe-3">
              <span className={cn('h-2 rounded-sm bg-muted', width)} />
            </span>
            {weeks.map((w) => (
              <span key={w.week} className="h-6 rounded-sm bg-muted" />
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm text-pretty text-muted-foreground max-sm:order-first sm:absolute sm:inset-x-4 sm:top-1/2 sm:mx-auto sm:w-fit sm:max-w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-lg sm:bg-card/90 sm:px-3 sm:py-2 sm:text-center">
        {t.rich(
          '<b>Chưa có tin nào được gắn tag.</b> Bản tin sáng gắn tag chủ đề mỗi ngày; số đếm sẽ hiện ở đây.',
          { b: (chunks) => <span className="font-medium text-foreground">{chunks}</span> },
        )}
      </p>
    </div>
  );
}

/** "Chủ đề trong bản tin": GET /api/news/topics, with its own range filter. */
export function TopicHeatmap() {
  const t = useT();
  const [weeks, setWeeks] = useState<WeeksValue>('8');
  const topics = useApi(`news-topics:${weeks}`, () => opportunitiesApi.topicCounts(Number(weeks)));
  const m = topics.data ? buildMatrix(topics.data) : null;
  // No tagged news in the default range: the range picker and the explanation have nothing to act on. Once the
  // owner has changed the range it stays, so an empty short range can be widened again.
  const nothing = !!m && m.rows.length === 0 && weeks === '8';

  return (
    <section className={cn(PAGE_WIDTH, 'flex flex-col gap-4')} aria-labelledby="topics-heading">
      <div className="flex flex-wrap items-center gap-2">
        <div className="me-auto flex flex-col gap-1">
          <h2 id="topics-heading" className="font-heading text-lg font-semibold tracking-tight">
            {t('Chủ đề trong bản tin theo tuần')}
          </h2>
          {!nothing && (
            <p className="text-sm text-muted-foreground">
              {t(
                'Số tin mỗi tag xuất hiện trong bản tin sáng, theo tuần ISO. Chủ đề nóng dần là gợi ý tìm bằng chứng.',
              )}
            </p>
          )}
        </div>
        {!nothing && (
          <ChoiceSelect
            label={t('Khoảng thời gian')}
            value={weeks}
            onChange={setWeeks}
            choices={weekChoices.map((c) => ({ value: c.value, label: t(c.label) }))}
            className="w-auto"
          />
        )}
      </div>
      <ApiStaleAlert result={topics} />
      {topics.error && !topics.data ? (
        <ApiErrorState error={topics.error} onRetry={topics.reload} />
      ) : !m ? (
        <Skeleton className="h-48 rounded-xl" role="status" aria-busy="true" aria-label={t('Đang tải')} />
      ) : m.rows.length === 0 ? (
        <EmptyHeatmap weeks={m.weeks} />
      ) : (
        <div
          className={cn(
            'rounded-xl border bg-card p-4 transition-opacity',
            topics.loading && 'opacity-60',
          )}
        >
          <Heatmap m={m} />
        </div>
      )}
    </section>
  );
}
