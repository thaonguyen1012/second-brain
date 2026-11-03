'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Circle, CircleCheck } from 'lucide-react';
import type { ApiRhythm } from '@/lib/api/weeks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PREDICTIONS_HREF } from '../due-predictions';
import { WeekSection } from './week-section';

/** "2026-10" -> "tháng 10/2026". */
function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `tháng ${Number(m)}/${year}`;
}

function Check({
  done,
  question,
  answer,
  href,
  action,
}: {
  done: boolean;
  question: string;
  answer: string;
  href: string;
  action: string;
}) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <Icon className={cn('size-4 shrink-0', done ? 'text-success-foreground' : 'text-muted-foreground')} aria-hidden />
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-sm font-medium">{question}</span>
        <span className={cn('text-[13px]', done ? 'text-muted-foreground' : 'text-foreground')}>{answer}</span>
      </div>
      {!done && (
        <Button size="xs" variant="outline" render={<Link href={href} />}>
          {action}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </li>
  );
}

function Line({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-t pt-3">
      <span className="text-sm font-medium">{title}</span>
      <p className="text-[13px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

/**
 * Practice rhythm of DECISIONS 6.5, from the review's `rhythm` counts: the weekly checks, plus a monthly line on
 * the first review of a month and a quarterly line on the first review of a quarter.
 */
export function ReviewRhythm({ rhythm }: { rhythm: ApiRhythm }) {
  const { notes, achievements, predictionsDue, month, quarter } = rhythm;
  return (
    <WeekSection
      id="week-rhythm"
      title="Nhịp thực hành"
      description="Mỗi tuần: viết ít nhất một ghi chú, cập nhật nhật ký thành tựu."
    >
      <ul className="flex flex-col divide-y">
        <Check
          done={notes > 0}
          question="Có ghi chú mới tuần này?"
          answer={notes > 0 ? `Có, ${notes} ghi chú mới.` : 'Chưa có ghi chú nào.'}
          href="/thu-vien/ghi-chu/"
          action="Viết ghi chú"
        />
        <Check
          done={achievements > 0}
          question="Có cập nhật thành tựu?"
          answer={achievements > 0 ? `Có, ${achievements} dòng trong tuần.` : 'Chưa có dòng nào trong tuần.'}
          href="#week-achievements"
          action="Thêm dòng"
        />
        <Check
          done={predictionsDue === 0}
          question="Dự đoán đến hạn?"
          answer={
            predictionsDue > 0 ? `${predictionsDue} dự đoán đến hạn chấm lại.` : 'Không có dự đoán nào đến hạn.'
          }
          href={PREDICTIONS_HREF}
          action="Chấm lại"
        />
      </ul>
      {month && (
        <Line title="Đầu tháng: nhìn lại tháng trước">
          {`Trong ${monthLabel(month.month)}: ${month.booksFinished} cuốn sách đọc xong, ${month.notes} ghi chú. `}
          Nhịp tháng: một cuốn sách, một cuộc trò chuyện cà phê với người trong hoặc ngoài ngành.
        </Line>
      )}
      {quarter && (
        <Line title="Đầu quý: nhìn lại quý trước">
          {`Quý ${quarter.quarter}/${quarter.year}: ${quarter.achievements} thành tựu, ` +
            `${quarter.projectsFinished} dự án xong, ${quarter.predictionsOpen} dự đoán chưa chấm. `}
          Nhịp quý: ship một thứ hoàn chỉnh có người dùng thật, viết case study, nâng một kỹ năng nền, cập nhật CV
          theo kết quả, xem lại danh sách dự đoán.
        </Line>
      )}
    </WeekSection>
  );
}
