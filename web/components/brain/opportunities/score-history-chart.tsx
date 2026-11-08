'use client';
import { useRef, useState } from 'react';
import type { ApiScoreSnapshot } from '@/lib/api/opportunities';
import { formatDate } from '@/lib/labels';
import { useT } from '@/lib/i18n/client';
import type { Msg } from '@/lib/i18n/translate';
import { scoreDims, type ScoreKey } from './labels';

// Small multiples, one figure per score (1-10, shared scale), one data hue (--chart-data): the tile title names the series, so no
// legend and no categorical palette. One cursor drives every tile; arrows move it, a table view carries all values.
const W = 220;
const H = 92;
const PAD = { left: 18, right: 22, top: 8, bottom: 8 };
const Y_TICKS = [1, 5, 10];

const yOf = (v: number) => PAD.top + ((10 - v) / 9) * (H - PAD.top - PAD.bottom);

function xPositions(points: ApiScoreSnapshot[]): number[] {
  const times = points.map((p) => Date.parse(p.createdAt));
  const min = Math.min(...times);
  const max = Math.max(...times);
  const inner = W - PAD.left - PAD.right;
  if (points.length === 1 || max === min)
    return points.map((_, i) => PAD.left + (inner * (i + 1)) / (points.length + 1));
  return times.map((t) => PAD.left + ((t - min) / (max - min)) * inner);
}

function Tile({
  dim,
  points,
  xs,
  active,
  onActive,
}: {
  dim: { key: ScoreKey; label: Msg };
  points: ApiScoreSnapshot[];
  xs: number[];
  active: number;
  onActive: (i: number | null) => void;
}) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const values = points.map((p) => p[dim.key]);
  const current = values[active];
  const prev = active > 0 ? values[active - 1] : null;
  const delta = prev === null ? null : current - prev;
  const last = values.length - 1;
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const x = ((clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
    onActive(best);
  };

  return (
    <figure className="flex min-w-0 flex-col gap-1">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{t(dim.label)}</span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{current}</span>
          <span className="text-muted-foreground">/10</span>
          {delta !== null && delta !== 0 && (
            <span className="ms-1 text-xs text-muted-foreground">
              ({delta > 0 ? '+' : '−'}
              {Math.abs(delta)})
            </span>
          )}
        </span>
      </figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y overflow-visible"
        aria-hidden
        onPointerMove={(e) => nearest(e.clientX)}
        onPointerDown={(e) => nearest(e.clientX)}
        onPointerLeave={() => onActive(null)}
      >
        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yOf(tick)}
              y2={yOf(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 5}
              y={yOf(tick)}
              dy="0.32em"
              textAnchor="end"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {tick}
            </text>
          </g>
        ))}
        <line
          x1={xs[active]}
          x2={xs[active]}
          y1={PAD.top}
          y2={H - PAD.bottom}
          className="stroke-muted-foreground/50"
          strokeWidth={1}
        />
        {values.length > 1 && (
          <path
            d={path}
            fill="none"
            className="stroke-chart-data"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {values.map((v, i) => (
          <circle
            key={points[i].id}
            cx={xs[i]}
            cy={yOf(v)}
            r={i === active ? 5 : 3.5}
            className="fill-chart-data stroke-background"
            strokeWidth={2}
          />
        ))}
        <text x={xs[last] + 7} y={yOf(values[last])} dy="0.32em" fontSize={11} className="fill-foreground font-medium">
          {values[last]}
        </text>
        {/* hit layer: the whole plot, the pointer snaps to the nearest snapshot */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
      </svg>
    </figure>
  );
}

/** Score history of one opportunity (scoreHistory, newest first from the API). */
export function ScoreHistoryChart({ history }: { history: ApiScoreSnapshot[] }) {
  const t = useT();
  const points = [...history].reverse();
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  if (points.length === 0)
    return <p className="text-sm text-muted-foreground">{t('Chưa chấm lần nào. Chấm 4 điểm để bắt đầu lịch sử.')}</p>;

  const last = points.length - 1;
  const active = Math.min(hover ?? cursor ?? last, last);
  const snap = points[active];
  const xs = xPositions(points);
  const snapLabel =
    active === last ? t('Lần chấm gần nhất') : t('Lần chấm {i}/{total}', { i: active + 1, total: points.length });

  return (
    <div className="flex flex-col gap-3">
      <div
        tabIndex={0}
        role="group"
        aria-label={t('Lịch sử điểm, {n} lần chấm. Dùng phím mũi tên để xem từng lần.', { n: points.length })}
        className="flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(e) => {
          const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
          let next: number | null = null;
          if (step) next = Math.max(0, Math.min(last, active + step));
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = last;
          if (next === null) return;
          e.preventDefault();
          setHover(null);
          setCursor(next);
        }}
      >
        <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
          <span className="font-medium text-foreground">
            {snapLabel},{' '}
            {formatDate(snap.createdAt, t)}
          </span>
          {snap.note && <>: {snap.note}</>}
          <span className="sr-only">{scoreDims.map((d) => `${t(d.label)} ${snap[d.key]}`).join(', ')}</span>
        </p>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {scoreDims.map((d) => (
            <Tile key={d.key} dim={d} points={points} xs={xs} active={active} onActive={setHover} />
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('Xem dạng bảng')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pe-3 font-medium">{t('Ngày')}</th>
                {scoreDims.map((d) => (
                  <th key={d.key} className="py-1 pe-3 font-medium">
                    {t(d.label)}
                  </th>
                ))}
                <th className="py-1 font-medium">{t('Ghi chú')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-1 pe-3 whitespace-nowrap">{formatDate(s.createdAt, t)}</td>
                  {scoreDims.map((d) => (
                    <td key={d.key} className="py-1 pe-3">
                      {s[d.key]}
                    </td>
                  ))}
                  <td className="py-1 text-muted-foreground">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
