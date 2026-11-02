'use client';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CircleAlert } from 'lucide-react';
import type { ApiError } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { describeApiError } from '../api-state';

/** One block of the planning or review ritual: same card style as the "Hôm nay" panels. */
export function WeekSection({
  icon: Icon,
  title,
  id,
  action,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  id: string;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      render={<section aria-labelledby={id} />}
      className={cn('flex flex-col gap-3 rounded-3xl border p-4 shadow-depth-1 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <h2 id={id} className="font-heading text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {action && <div className="ms-auto flex items-center gap-2">{action}</div>}
      </div>
      {description && <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </Card>
  );
}

/** DRF 400 bodies are `{ field: [messages] }` or `{ detail }`; show the first message. */
function firstMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  for (const v of Object.values(body as Record<string, unknown>)) {
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  }
  return null;
}

/** A failed write, in Vietnamese; DRF validation messages are shown as they come. */
export function WriteError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const err: ApiError = toApiError(error);
  const { title, text } = describeApiError(err);
  const detail = err.status === 400 ? firstMessage(err.body) : null;
  return (
    <Alert variant="error" className={className} role="alert">
      <CircleAlert aria-hidden />
      <AlertTitle>{err.status === 400 ? 'Chưa lưu được' : title}</AlertTitle>
      <AlertDescription>{detail ?? text}</AlertDescription>
    </Alert>
  );
}
