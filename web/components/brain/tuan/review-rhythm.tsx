'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Circle, CircleCheck } from 'lucide-react';
import type { ApiRhythm } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PREDICTIONS_HREF } from '../due-predictions';

/** "2026-10" -> "tháng 10/2026". */
function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `tháng ${Number(m)}/${year}`;
}

/** The small outline link at the end of an open check ("Xử lý inbox", "Viết ghi chú"...). */
export function CheckLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button size="xs" variant="outline" render={<Link href={href} />}>
      {children}
      <ArrowRight aria-hidden />
    </Button>
  );
}

/**
 * One row of the review checklist (DESIGN.md §3 list rows): a check mark, the question, an optional detail line,
 * then the short answer and at most one action. From sm every row shares one grid template (icon | question |
 * answer | action track of fixed width, empty when there is no action), so the answers line up down the list
 * (§3 Columns); the answer is muted meta next to the medium question (D7). Below sm they wrap under the question.
 */
export function CheckRow({
  done,
  question,
  value,
  detail,
  action,
}: {
  done: boolean;
  question: string;
  value?: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="grid min-h-10 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto_8.5rem]">
      <Icon className={cn('size-4 shrink-0', done ? 'text-success-foreground' : 'text-muted-foreground')} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{question}</span>
        {detail && <span className="text-xs leading-relaxed text-muted-foreground">{detail}</span>}
      </div>
      {(value || action) && (
        <div className="col-start-2 flex flex-wrap items-center gap-3 sm:contents">
          {value && (
            <span className="text-sm text-muted-foreground tabular-nums sm:col-start-3 sm:justify-self-end">
              {value}
            </span>
          )}
          {action && <div className="flex sm:col-start-4 sm:justify-self-start">{action}</div>}
        </div>
      )}
    </li>
  );
}

/**
 * Practice rhythm of DECISIONS 6.5, from the review's `rhythm` counts, as rows of the review checklist: the weekly
 * checks, plus a monthly line on the first review of a month and a quarterly line on the first review of a quarter.
 */
export function RhythmRows({ rhythm }: { rhythm: ApiRhythm }) {
  const { notes, achievements, predictionsDue, month, quarter } = rhythm;
  return (
    <>
      <CheckRow
        done={notes > 0}
        question="Có ghi chú mới tuần này?"
        value={notes > 0 ? `${notes} ghi chú` : 'Chưa có'}
        action={notes === 0 && <CheckLink href="/thu-vien/ghi-chu/">Viết ghi chú</CheckLink>}
      />
      <CheckRow
        done={achievements > 0}
        question="Có cập nhật thành tựu?"
        value={achievements > 0 ? `${achievements} dòng` : 'Chưa có'}
        action={achievements === 0 && <CheckLink href="#week-achievements">Thêm dòng</CheckLink>}
      />
      <CheckRow
        done={predictionsDue === 0}
        question="Dự đoán đến hạn?"
        value={predictionsDue > 0 ? `${predictionsDue} cần chấm` : 'Không có'}
        action={predictionsDue > 0 && <CheckLink href={PREDICTIONS_HREF}>Chấm lại</CheckLink>}
      />
      {month && (
        <CheckRow
          done={false}
          question="Đầu tháng: nhìn lại tháng trước"
          detail={
            `Trong ${monthLabel(month.month)}: ${month.booksFinished} cuốn sách đọc xong, ${month.notes} ghi chú. ` +
            'Nhịp tháng: một cuốn sách, một cuộc trò chuyện cà phê với người trong hoặc ngoài ngành.'
          }
        />
      )}
      {quarter && (
        <CheckRow
          done={false}
          question="Đầu quý: nhìn lại quý trước"
          detail={
            `Quý ${quarter.quarter}/${quarter.year}: ${quarter.achievements} thành tựu, ` +
            `${quarter.projectsFinished} dự án xong, ${quarter.predictionsOpen} dự đoán chưa chấm. ` +
            'Nhịp quý: ship một thứ hoàn chỉnh có người dùng thật, viết case study, nâng một kỹ năng nền, cập nhật CV ' +
            'theo kết quả, xem lại danh sách dự đoán.'
          }
        />
      )}
    </>
  );
}
