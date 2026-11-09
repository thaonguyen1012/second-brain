import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ItemPageView } from '@/components/brain/library/item-page';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Item') };
}

export default function Page() {
  return (
    // useSearchParams (?id=) needs a Suspense boundary so the shell still prerenders
    <Suspense fallback={<div className="w-full px-4 pt-10 sm:px-8 md:pt-12" />}>
      <ItemPageView />
    </Suspense>
  );
}
