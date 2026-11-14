'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { api, type ApiItem } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { TOOLS_LABEL, TOOLS_PATH } from '@/lib/labels';
import { setNavCurrent } from '@/lib/nav-current';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, EmptyState } from '../api-state';
import { ItemDetail } from './item-detail';

// /thu-vien/item/?id=N: the Item page in full (DECISIONS 9.8 point 1). A query parameter instead of a dynamic segment
// keeps the route a static shell (like /co-hoi/?id=N); the Item and its notes load in the browser.

/** Back to the list the Item lives in: Thư viện, or Công cụ for a tool (Thư viện does not list tools). */
function Back({ tool = false }: { tool?: boolean }) {
  const t = useT();
  return (
    <Link
      href={tool ? TOOLS_PATH : '/thu-vien/'}
      className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {tool ? t(TOOLS_LABEL) : t('Thư viện')}
    </Link>
  );
}

function NotFound() {
  const t = useT();
  return (
    <EmptyState
      icon={<SearchX aria-hidden />}
      title={t('Không tìm thấy item này')}
      description={t('Có thể item đã bị xóa hoặc link đã cũ. Quay lại Thư viện để chọn item khác.')}
    />
  );
}

/** Loading at the page's geometry (D27): picture, title, the property rows, the notes heading. */
function ItemSkeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true" aria-label={t('Đang tải')}>
      <div className="flex flex-col gap-4" aria-hidden>
        <div className="flex items-start gap-4">
          <Skeleton className="aspect-[2/3] w-16 rounded-md sm:w-20" />
          <Skeleton className="h-9 w-2/3 max-w-xl rounded-md" />
        </div>
        <div className="flex max-w-md flex-col gap-2.5">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-8 w-40 rounded-lg" />
      </div>
      <Skeleton className="h-6 w-24" aria-hidden />
    </div>
  );
}

function ItemPageBody({ id }: { id: number }) {
  const router = useRouter();
  const res = useApi<ApiItem>(`item:${id}`, () => api.getItem(id));
  // A tool belongs to Công cụ: its sidebar row is the current one while its page shows (not Thư viện's, as the path)
  const tool = res.data?.type === 'tool';
  useEffect(() => {
    if (!tool) return;
    setNavCurrent(TOOLS_PATH);
    return () => setNavCurrent(null);
  }, [tool]);
  if (res.error && !res.data)
    return (
      <>
        <Back />
        {res.error.status === 404 && res.error.reachable ? (
          <NotFound />
        ) : (
          <ApiErrorState error={res.error} onRetry={res.reload} />
        )}
      </>
    );
  // The way back names the Item's list, known once it loads: a line of its size meanwhile (D27; ItemSkeleton says
  // "Đang tải")
  if (!res.data)
    return (
      <>
        <Skeleton className="h-5 w-20 self-start" aria-hidden />
        <ItemSkeleton />
      </>
    );
  return (
    <>
      <Back tool={tool} />
      <ItemDetail
        item={res.data}
        variant="page"
        onItemChange={(item) => res.mutate(() => item)}
        onDeleted={() => router.push(tool ? TOOLS_PATH : '/thu-vien/')}
      />
    </>
  );
}

export function ItemPageView() {
  const raw = useSearchParams().get('id');
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  return (
    // Same gutters and top padding as PageHeader, so the title sits where every page title sits; a reading width
    // (DESIGN.md §3: notes get air)
    <div className="flex w-full flex-col px-4 pt-10 pb-12 sm:px-8 md:pt-12">
      <div className="flex w-full max-w-3xl flex-col gap-4">
        {id === null ? (
          <>
            <Back />
            <NotFound />
          </>
        ) : (
          <ItemPageBody key={id} id={id} />
        )}
      </div>
    </div>
  );
}
