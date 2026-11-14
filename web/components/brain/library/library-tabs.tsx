'use client';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { msg } from '@/lib/i18n/translate';
import { segmentedControlItemLayoutClassName, segmentedControlItemSizeClassNames } from '@/lib/segmented-control';
import { cn } from '@/lib/utils';
import { useNavCounts } from '../nav-counts';

const tabs = [
  { key: 'items', href: '/thu-vien/', label: msg('Item', 'nav') },
  { key: 'notes', href: '/thu-vien/ghi-chu/', label: msg('Ghi chú', 'nav') },
] as const;

/**
 * A segmented tab's count (these links, Inbox's status tabs): plain muted text after the label. The current tab's
 * ground is the indicator's, which in dark (`--input` over `--muted`, #3e3e3e) is lighter than every surface, and
 * muted-foreground there is 4.07:1 (WCAG 1.4.3): the count takes the label's white at 70% (6.2:1, the 6.3:1 it has on
 * the other tabs' ground), still under the label (10.7:1, and larger and bolder). Light keeps muted-foreground.
 */
export const tabCountClass = (current: boolean) =>
  cn('ms-1.5 text-xs font-normal text-muted-foreground tabular-nums', current && 'dark:text-foreground/70');

/**
 * Switch between the two halves of Thư viện (DECISIONS 9.3: item + ghi chú): two links to two routes, so a navigation
 * with `aria-current="page"` on the half shown, not tabs (no panel of theirs is on the page; WCAG 1.3.1, 4.1.2).
 * Drawn as the segmented Tabs of Tuần and Inbox (DESIGN.md §6, D23) with TabsList's and TabsTab's own classes (copies:
 * lib/registry-copies.test.ts fails when the registry's change), the current half in the indicator's colours (plain
 * classes, as weak as `data-active:`, so hover mutes it the same);
 * each ends in its count as plain muted text (GET /api/counts, the sidebar's numbers; 0 included, nothing while
 * unknown).
 */
export function LibraryTabs({ current }: { current: (typeof tabs)[number]['key'] }) {
  const t = useT();
  const counts = useNavCounts();
  return (
    <nav
      aria-label={t('Thư viện')}
      className="flex w-fit items-center justify-center gap-x-0.5 rounded-lg bg-muted p-0.5 text-muted-foreground"
    >
      {tabs.map(({ key, href, label }) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? 'page' : undefined}
          className={cn(
            'relative flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:text-sm',
            segmentedControlItemLayoutClassName,
            segmentedControlItemSizeClassNames.default,
            current === key && 'bg-card text-foreground dark:bg-input',
          )}
        >
          {t(label)}
          {counts && <span className={tabCountClass(current === key)}>{counts[key]}</span>}
        </Link>
      ))}
    </nav>
  );
}
