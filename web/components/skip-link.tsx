'use client';
import { useT } from '@/lib/i18n/client';

/**
 * "Bỏ qua tới nội dung" (WCAG 2.4.1): the page's first tab stop, out of sight until it has the focus, then a small
 * popover-like button at the top left (Button's default size, radius and focus ring; DESIGN.md §6). It hands the
 * focus to `target`, which takes it with tabIndex -1, without scrolling (a phone's lesson page would slide its first
 * lines under the sticky bar) and without a #hash: a hash entry carries no App Router state, so Back from the next
 * page would land on it with that next page still showing (checked 13/11/2026). Without JavaScript it is a plain
 * in-page link.
 */
export function SkipLink({ target }: { target: string }) {
  const t = useT();
  return (
    <a
      href={`#${target}`}
      onClick={(e) => {
        const el = document.getElementById(target);
        if (!el) return;
        e.preventDefault();
        el.focus({ preventScroll: true });
      }}
      className="fixed start-4 top-4 z-50 inline-flex h-9 items-center rounded-lg border bg-popover px-[calc(--spacing(3)-1px)] text-base font-medium text-popover-foreground shadow-popover outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background not-focus:sr-only sm:h-8 sm:text-sm"
    >
      {t('Bỏ qua tới nội dung')}
    </a>
  );
}
