'use client';
import { useState } from 'react';
import { opportunitiesApi, type ApiTopicCounts } from '@/lib/api/opportunities';
import { useApi } from '@/lib/api/use-api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, ApiStaleAlert } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { formatDay } from './labels';

// Topic tags of the morning-brief news per ISO week (DECISIONS 9.2: replaces Exploding Topics).
// Heatmap: rows = topics (most frequent first, tail folded into "khác"), columns = weeks, one sequential hue.

const TOP = 10;
const OTHER = 'khác';

const weekChoices = [
  { value: '4', label: '4 tuần' },
  { value: '8', label: '8 tuần' },
  { value: '12', label: '12 tuần' },
  { value: '26', label: '26 tuần' },
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
    rows.push({ tag: OTHER, counts, total: counts.reduce((a, b) => a + b, 0) });
  }
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  return { weeks, rows, max };
}

/** Sequential fill: the data hue (--chart-2, not the action blue) mixed into the page surface, light to full. */
function fill(count: number, max: number): string | undefined {
  if (count === 0) return undefined;
  const pct = Math.round(18 + 82 * (count / max));
  return `color-mix(in oklab, var(--chart-2) ${pct}%, var(--background))`;
}

const shortWeek = (week: string) => week.replace(/^\d{4}-/, '');

function Heatmap({ m }: { m: Matrix }) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
  const nCols = m.weeks.length;
  const active = hover ?? cursor;
  const cell =
    active && m.rows[active.r]
      ? { row: m.rows[active.r], week: m.weeks[active.c], count: m.rows[active.r].counts[active.c] }
      : null;
  const every = nCols > 13 ? 2 : 1;

  const move = (dr: number, dc: number) => {
    const cur = cursor ?? { r: 0, c: nCols - 1 };
    setHover(null);
    setCursor({
      r: Math.max(0, Math.min(m.rows.length - 1, cur.r + dr)),
      c: Math.max(0, Math.min(nCols - 1, cur.c + dc)),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
        {cell ? (
          <>
            <span className="font-semibold text-foreground tabular-nums">{cell.count} tin</span> · {cell.row.tag} · tuần{' '}
            {shortWeek(cell.week.week)} (từ {formatDay(cell.week.start)})
          </>
        ) : (
          'Rê chuột lên ô, hoặc chọn bảng rồi dùng phím mũi tên.'
        )}
      </p>
      <div className="overflow-x-auto">
        <div
          tabIndex={0}
          role="group"
          aria-label="Bản đồ nhiệt chủ đề theo tuần. Phím mũi tên để đi qua từng ô."
          className="grid min-w-max gap-0.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  row.tag === OTHER ? 'text-muted-foreground italic' : 'text-foreground',
                  active?.r === r && 'font-semibold',
                )}
              >
                {row.tag}
              </span>
              {row.counts.map((n, c) => {
                const on = active?.r === r && active?.c === c;
                return (
                  <span
                    key={c}
                    onPointerEnter={() => setHover({ r, c })}
                    className={cn(
                      'h-7 rounded-sm transition-shadow',
                      n === 0 && 'bg-muted',
                      on && 'ring-2 ring-foreground/70 ring-offset-1 ring-offset-background',
                    )}
                    style={{ background: fill(n, m.max) }}
                  />
                );
              })}
            </div>
          ))}
          <span className="pt-1 pe-3 text-[11px] text-muted-foreground" aria-hidden>
            số tin đã gắn tag
          </span>
          {m.weeks.map((w) => (
            <span key={w.week} aria-hidden className="pt-1 text-center text-[11px] text-muted-foreground tabular-nums">
              {w.items}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>ít</span>
        {[0.15, 0.35, 0.55, 0.78, 1].map((f) => (
          <span key={f} className="h-3 w-5 rounded-sm" style={{ background: fill(f * m.max, m.max) }} />
        ))}
        <span>nhiều (tối đa {m.max} tin một tuần)</span>
        <span className="ms-2 inline-block h-3 w-5 rounded-sm bg-muted" />
        <span>không có</span>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Xem dạng bảng</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pe-3 font-medium">Chủ đề</th>
                {m.weeks.map((w) => (
                  <th key={w.week} className="py-1 pe-3 font-medium" title={`từ ${formatDay(w.start)}`}>
                    {shortWeek(w.week)}
                  </th>
                ))}
                <th className="py-1 font-medium">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {m.rows.map((row) => (
                <tr key={row.tag} className="border-t">
                  <th scope="row" className="py-1 pe-3 font-normal">
                    {row.tag}
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

/** "Chủ đề trong bản tin": GET /api/news/topics, with its own range filter. */
export function TopicHeatmap() {
  const [weeks, setWeeks] = useState<WeeksValue>('8');
  const topics = useApi(`news-topics:${weeks}`, () => opportunitiesApi.topicCounts(Number(weeks)));
  const m = topics.data ? buildMatrix(topics.data) : null;
  // No tagged news in the default range: the range picker and the explanation have nothing to act on. Once the
  // owner has changed the range it stays, so an empty short range can be widened again.
  const nothing = !!m && m.rows.length === 0 && weeks === '8';

  return (
    <section className="flex flex-col gap-4" aria-labelledby="topics-heading">
      <div className="flex flex-wrap items-center gap-2">
        <div className="me-auto flex flex-col gap-1">
          <h2 id="topics-heading" className="font-heading text-lg font-semibold tracking-tight">
            Chủ đề trong bản tin theo tuần
          </h2>
          {!nothing && (
            <p className="text-sm text-muted-foreground">
              Số tin mỗi tag xuất hiện trong bản tin sáng, theo tuần ISO. Chủ đề nóng dần là gợi ý tìm bằng chứng.
            </p>
          )}
        </div>
        {!nothing && (
          <ChoiceSelect
            label="Khoảng thời gian"
            value={weeks}
            onChange={setWeeks}
            choices={weekChoices}
            className="w-auto"
          />
        )}
      </div>
      <ApiStaleAlert result={topics} />
      {topics.error && !topics.data ? (
        <ApiErrorState error={topics.error} onRetry={topics.reload} />
      ) : !m ? (
        <Skeleton className="h-48 rounded-xl" aria-busy="true" aria-label="Đang tải" />
      ) : m.rows.length === 0 ? (
        // A secondary block of the page: one line, not a second empty box (DESIGN.md D26)
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Chưa có tin nào được gắn tag.</span> Bản tin sáng gắn tag chủ đề
          mỗi ngày; số đếm sẽ hiện ở đây.
        </p>
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
