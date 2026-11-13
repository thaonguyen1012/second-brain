'use client';
import type { ReactNode } from 'react';
import { CircleAlert, Inbox, PlugZap } from 'lucide-react';
import type { ApiError } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';

/** What went wrong with an API call, in the page's language: backend absent, not signed in, or another error. */
export function describeApiError(error: ApiError, t: T): { title: string; text: string } {
  if (!error.reachable)
    return {
      title: t('Chưa kết nối được máy chủ'),
      text: t('Phần này cần backend Django (qua nginx hoặc scripts/dev-proxy.mjs). Sổ tay vẫn đọc được bình thường.'),
    };
  if (error.status === 401 || error.status === 403)
    return {
      title: t('Chưa đăng nhập'),
      text: t('Phiên đăng nhập đã hết hoặc chưa có. Mở lại trang qua Cloudflare Access rồi thử lại.'),
    };
  return {
    title: t('Không tải được dữ liệu'),
    text: t('Máy chủ trả lỗi {status}. Thử lại sau ít phút.', { status: error.status }),
  };
}

/** Notice for a deep link (Cmd+K result) whose record could not be loaded: `notFound` for a 404. */
export function openError(err: unknown, notFound: string, t: T): string {
  const e = toApiError(err);
  return e.reachable && e.status === 404 ? notFound : describeApiError(e, t).title;
}

export function ApiErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const t = useT();
  const { title, text } = describeApiError(error, t);
  const Icon = error.reachable ? CircleAlert : PlugZap;
  return (
    <Alert variant={error.reachable ? 'error' : 'warning'}>
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            {t('Thử lại')}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

/**
 * A failed reload (tab focus, retry) while the rows of the same list stay on screen: says the rows may be old.
 * Renders nothing otherwise; the full ApiErrorState covers the case with no rows.
 */
export function ApiStaleAlert({
  result,
}: {
  result: { error: ApiError | undefined; data: unknown; reload: () => void };
}) {
  const t = useT();
  if (!result.error || result.data === undefined) return null;
  const { title } = describeApiError(result.error, t);
  return (
    <Alert variant="warning">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{t('Đang hiện dữ liệu tải lần trước, có thể đã cũ.')}</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={result.reload}>
          {t('Thử lại')}
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    // Sized to its content (DESIGN.md D26): a solid hairline, no tall dashed void
    <Empty className="flex-none gap-4 rounded-xl border bg-card px-6 py-8 md:py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox aria-hidden />}</EmptyMedia>
        <EmptyTitle className="text-lg tracking-tight">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}

/**
 * Loading placeholder at the geometry of a BrainCard (Inbox entry, brief story): badge row, title, meta, two
 * excerpt lines and the action row, so the list does not jump when the cards arrive (DESIGN.md D27).
 */
export function LoadingCards({ count = 3 }: { count?: number }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
          </div>
          <Skeleton className="h-7 w-48 max-w-full" />
        </div>
      ))}
    </div>
  );
}
