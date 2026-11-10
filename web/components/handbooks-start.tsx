import Link from 'next/link';
import { BookPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IMPORT_GUIDE_HREF } from '@/lib/import-guide';
import { cn } from '@/lib/utils';
import type { T } from '@/lib/i18n/translate';

/**
 * "Hôm nay" before the first handbook is imported: the resume hero's place and surface (DESIGN.md §9a), saying how
 * handbooks get in, with the page's one filled button to the import guide. Rendered on the server, so the home
 * page's First Load JS carries nothing for it; the first-run panel with the guide beside it is on Sổ tay
 * (components/brain/content-empty.tsx), which "Hôm nay" must not import.
 */
export function HandbooksStart({ t, className }: { t: T; className?: string }) {
  return (
    <section
      aria-labelledby="handbooks-start"
      className={cn('flex flex-col items-start gap-3 rounded-xl border bg-card p-5 shadow-depth-1 sm:p-6', className)}
    >
      <span aria-hidden className="flex h-9 items-center text-muted-foreground">
        <BookPlus className="size-8 forced-colors:text-inherit" strokeWidth={1.5} absoluteStrokeWidth />
      </span>
      <h2 id="handbooks-start" className="font-heading text-lg font-semibold tracking-tight text-balance">
        {t('Chưa có sổ tay nào')}
      </h2>
      <p className="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
        {t(
          'Nhập sổ tay đầu tiên từ file zip GitBook hoặc một file HTML. Bài đang học và tiến độ sẽ hiện ở đây.',
        )}
      </p>
      <Button render={<Link href={IMPORT_GUIDE_HREF} />}>{t('Xem cách nhập sổ tay')}</Button>
    </section>
  );
}
