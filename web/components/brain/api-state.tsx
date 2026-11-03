'use client';
import type { ReactNode } from 'react';
import { CircleAlert, Inbox, PlugZap } from 'lucide-react';
import type { ApiError } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

/** Vietnamese explanation of a failed API call: backend absent, not signed in, or another error. */
export function describeApiError(error: ApiError): { title: string; text: string } {
  if (!error.reachable)
    return {
      title: 'Chưa kết nối được máy chủ',
      text: 'Phần này cần backend Django (qua nginx hoặc scripts/dev-proxy.mjs). Sổ tay vẫn đọc được bình thường.',
    };
  if (error.status === 401 || error.status === 403)
    return {
      title: 'Chưa đăng nhập',
      text: 'Phiên đăng nhập đã hết hoặc chưa có. Mở lại trang qua Cloudflare Access rồi thử lại.',
    };
  return { title: 'Không tải được dữ liệu', text: `Máy chủ trả lỗi ${error.status}. Thử lại sau ít phút.` };
}

/** Notice for a deep link (Cmd+K result) whose record could not be loaded: `notFound` for a 404. */
export function openError(err: unknown, notFound: string): string {
  const e = toApiError(err);
  return e.reachable && e.status === 404 ? notFound : describeApiError(e).title;
}

export function ApiErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { title, text } = describeApiError(error);
  const Icon = error.reachable ? CircleAlert : PlugZap;
  return (
    <Alert variant={error.reachable ? 'error' : 'warning'}>
      <Icon aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Thử lại
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
  if (!result.error || result.data === undefined) return null;
  const { title } = describeApiError(result.error);
  return (
    <Alert variant="warning">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>Đang hiện dữ liệu tải lần trước, có thể đã cũ.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline" onClick={result.reload}>
          Thử lại
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
    <Empty className="flex-none gap-4 rounded-xl border px-6 py-8 md:py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon ?? <Inbox aria-hidden />}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}
