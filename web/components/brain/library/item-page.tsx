'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { api, type ApiItem } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState, EmptyState } from '../api-state';
import { ItemDetail } from './item-detail';

// /thu-vien/item/?id=N: the Item page in full (DECISIONS 9.8 point 1). A query parameter instead of a dynamic segment
// keeps the route a static shell (like /co-hoi/?id=N); the Item and its notes load in the browser.

const back = (
  <Link
    href="/thu-vien/"
    className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-4" aria-hidden />
    Thư viện
  </Link>
);

function NotFound() {
  return (
    <EmptyState
      icon={<SearchX aria-hidden />}
      title="Không tìm thấy item này"
      description="Có thể item đã bị xóa hoặc link đã cũ. Quay lại Thư viện để chọn item khác."
    />
  );
}

/** Loading at the page's geometry (D27): picture, title, the property rows, the notes heading. */
function ItemSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-busy="true" aria-label="Đang tải">
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
  if (res.error && !res.data)
    return res.error.status === 404 && res.error.reachable ? (
      <NotFound />
    ) : (
      <ApiErrorState error={res.error} onRetry={res.reload} />
    );
  if (!res.data) return <ItemSkeleton />;
  return (
    <ItemDetail
      item={res.data}
      variant="page"
      onItemChange={(item) => res.mutate(() => item)}
      onDeleted={() => router.push('/thu-vien/')}
    />
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
        {back}
        {id === null ? <NotFound /> : <ItemPageBody key={id} id={id} />}
      </div>
    </div>
  );
}
