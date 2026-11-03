'use client';
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import type { ApiError } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { firstFieldError } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { describeApiError } from '../api-state';

/**
 * One block of the planning or review ritual: a plain headed block, no card of its own. The panel puts its
 * sections in one bordered surface with dividers between them (DESIGN.md D12: no box inside a box). No how-to
 * line under the title (DESIGN.md §7: help text is not content); the ritual is explained on /huong-dan/.
 */
export function WeekSection({
  title,
  id,
  action,
  children,
  className,
}: {
  title: string;
  id: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-3 p-4 sm:p-6', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={id} className="font-heading text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {action && <div className="ms-auto flex items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** A failed write, in Vietnamese; the first DRF validation message is shown (translated by lib/labels). */
export function WriteError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const err: ApiError = toApiError(error);
  const { title, text } = describeApiError(err);
  const detail = err.status === 400 ? firstFieldError(err.body) : null;
  return (
    <Alert variant="error" className={className} role="alert">
      <CircleAlert aria-hidden />
      <AlertTitle>{err.status === 400 ? 'Chưa lưu được' : title}</AlertTitle>
      <AlertDescription>{detail ?? text}</AlertDescription>
    </Alert>
  );
}
