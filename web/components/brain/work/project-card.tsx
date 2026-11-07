'use client';
import Link from 'next/link';
import { Clock, Pencil, Play } from 'lucide-react';
import type { ApiProject } from '@/lib/api/work';
import { MenuItem, MenuLinkItem } from '@/components/ui/menu';
import { MiniBillableBar } from './billable-bar';
import { formatHours, formatMoney } from './format';
import { canStartTimer, projectMeta } from './project-meta';

// The Dự án parts of a board card (components/brain/status-board.tsx): what the shared card shows under the title,
// and the project's own menu entries before "Chuyển sang ...".

/** Client and price, then hours with the billable bar, the running-timer dot and the effective rate. */
export function ProjectCardBody({ project: p, running }: { project: ApiProject; running: boolean }) {
  const hours = p.minutesTotal > 0;
  return (
    <>
      {/* two lines, not one: a long client name would otherwise cut off the agreed price on a 14-18rem card */}
      <p className="line-clamp-2 text-xs break-words text-muted-foreground">{projectMeta(p)}</p>
      {(hours || running || p.effectiveRate) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {(hours || running) && (
            <span className="inline-flex items-center gap-2">
              {running && (
                <>
                  <span className="size-2 shrink-0 rounded-full bg-bw-red" aria-hidden />
                  <span className="sr-only">Đang bấm giờ.</span>
                </>
              )}
              {hours && (
                <>
                  <span className="font-medium text-foreground">{formatHours(p.minutesTotal)}</span>
                  <span className="w-10">
                    <MiniBillableBar billable={p.minutesBillable} nonBillable={p.minutesNonBillable} />
                  </span>
                </>
              )}
            </span>
          )}
          {p.effectiveRate && <span>thực tế {formatMoney(p.effectiveRate, p.currency)}/giờ</span>}
        </div>
      )}
    </>
  );
}

/** Sửa, Bấm giờ (when a timer can start for it) and Xem giờ. */
export function ProjectCardMenu({
  project: p,
  running,
  onEdit,
  onStart,
}: {
  project: ApiProject;
  running: boolean;
  onEdit: () => void;
  onStart: () => void;
}) {
  return (
    <>
      <MenuItem onClick={onEdit}>
        <Pencil aria-hidden />
        Sửa
      </MenuItem>
      {canStartTimer(p, running) && (
        <MenuItem onClick={onStart}>
          <Play aria-hidden />
          Bấm giờ
        </MenuItem>
      )}
      <MenuLinkItem render={<Link href={`/cong-viec/gio/?project=${p.id}`} />}>
        <Clock aria-hidden />
        Xem giờ
      </MenuLinkItem>
    </>
  );
}
