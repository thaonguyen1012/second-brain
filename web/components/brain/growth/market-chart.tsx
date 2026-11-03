'use client';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ApiMarketSkill } from '@/lib/api/growth';
import { cn } from '@/lib/utils';
import { freshness } from './labels';

/** Matched skill of a market line: freshness by colour + word, or "not in the matrix". */
export function MatchedSkill({ line }: { line: ApiMarketSkill }) {
  if (!line.skill) return <span className="text-xs text-muted-foreground">Chưa có trong ma trận</span>;
  const f = freshness[line.skill.freshness];
  const sameName = line.skill.name.toLowerCase() === line.name.toLowerCase();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('size-2 shrink-0 rounded-full', f.dot)} aria-hidden />
      <span>
        {sameName ? '' : `${line.skill.name} · `}
        {f.label}
      </span>
    </span>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (now === before)
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        <span className="sr-only">không đổi</span>
      </span>
    );
  const up = now > before;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{up ? 'tăng' : 'giảm'}</span>
    </span>
  );
}

/**
 * Skill frequency of the month vs the previous month (dataviz: emphasis form, one hue + a reference tick).
 * Built as a table so every value is text in a cell (the table view); the bar is decoration (aria-hidden) and is
 * hidden below 640 px, where the numbers alone fit. Styled by hand per DESIGN.md §6 Tables (the Space UI table could
 * not be fetched from the registry). Bar: chart-2, at most 12px thick, 4px rounded data end, square at the
 * baseline. Previous month: a 2px tick.
 */
export function MarketSkillTable({ lines, processed }: { lines: ApiMarketSkill[]; processed: number }) {
  const max = Math.max(1, ...lines.map((l) => Math.max(l.count, l.previousCount)));
  const pct = (n: number) => `${(n / max) * 100}%`;
  return (
    <div className="flex flex-col gap-2">
      <ul
        className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground max-sm:hidden"
        aria-label="Chú giải"
      >
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-e-[4px] bg-chart-2" aria-hidden />
          Tháng này
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-0.5 rounded-full bg-foreground/70" aria-hidden />
          Tháng trước
        </li>
      </ul>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Số tin tuyển dụng đã phân tích nhắc tới từng kỹ năng, so với tháng trước
          </caption>
          <thead>
            <tr className="h-10 border-b text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-3 text-start font-medium">
                Kỹ năng được đòi
              </th>
              <th scope="col" className="w-[40%] px-3 text-start font-medium max-sm:hidden">
                <span className="sr-only">Biểu đồ</span>
              </th>
              <th scope="col" className="px-3 text-end font-medium">
                Tháng này
              </th>
              <th scope="col" className="px-3 text-end font-medium">
                Tháng trước
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map((l) => (
              <tr key={l.name} className="h-10 transition-colors duration-150 hover:bg-accent">
                <th scope="row" className="px-3 py-2 text-start font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium break-words">{l.name}</span>
                    {l.skill ? (
                      <Link href={`/phat-trien/ky-nang/?id=${l.skill.id}`} className="w-fit hover:underline">
                        <MatchedSkill line={l} />
                      </Link>
                    ) : (
                      <MatchedSkill line={l} />
                    )}
                  </div>
                </th>
                <td className="px-3 py-2 max-sm:hidden" aria-hidden>
                  <div className="relative h-5">
                    <div
                      className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-e-[4px] bg-chart-2"
                      style={{ width: pct(l.count) }}
                    />
                    {l.previousCount > 0 && (
                      <div
                        className="absolute top-0 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
                        style={{ left: pct(l.previousCount) }}
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums">
                  <span className="font-medium">{l.count}</span>
                  <span className="text-muted-foreground">/{processed} tin</span>
                </td>
                <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Delta now={l.count} before={l.previousCount} />
                    {l.previousCount}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
