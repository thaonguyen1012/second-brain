import type { ReactNode } from 'react';
import { areaIcon, navRow, type AreaKey, type NavHref } from '@/lib/app-nav';
import { cn } from '@/lib/utils';

/**
 * The light tint behind an area icon (the page title tile); the icon keeps >= 3:1 on it. Kept here, not in
 * lib/app-nav.ts, so the client sidebar does not carry it onto every page.
 */
const areaTile: Record<AreaKey, string> = {
  today: 'bg-area-today-soft',
  week: 'bg-area-week-soft',
  growth: 'bg-area-growth-soft',
  library: 'bg-area-library-soft',
  opportunity: 'bg-area-opportunity-soft',
  work: 'bg-area-work-soft',
};

/**
 * The full-bleed band behind an area page's header (DESIGN.md §9a): 6% of the area hue over the page, 10% in dark.
 * Hôm nay has none (it gathers every area), nor do pages without a row (Inbox, capture, Giới thiệu, Hướng dẫn, Tử
 * vi). Deleting this map removes the band everywhere.
 */
const areaWash: Partial<Record<AreaKey, string>> = {
  week: 'bg-area-week-wash',
  growth: 'bg-area-growth-wash',
  library: 'bg-area-library-wash',
  opportunity: 'bg-area-opportunity-wash',
  work: 'bg-area-work-wash',
};

/**
 * The page's sidebar row icon in its area colour on the area tint (DESIGN.md §4, §5); 36px, the page title's line
 * height. Kỹ năng shows the Kỹ năng icon, not one icon for all of Phát triển.
 */
export function AreaTile({ nav, className }: { nav: NavHref; className?: string }) {
  const row = navRow(nav);
  if (!row) return null;
  const Icon = row.icon;
  return (
    <span
      aria-hidden
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', areaTile[row.area], className)}
    >
      <Icon className={cn('size-5', areaIcon[row.area])} />
    </span>
  );
}

/**
 * Title block shared by the app pages (same spacing as the home and roadmap headers). `nav` is the page's sidebar row
 * href: its tile goes before the title, on its first line; pages outside the six areas pass none. On the five hued
 * areas the block sits on the area's wash band (full-bleed, `border-b`, 24px above the content), its text capped at
 * `max-w-7xl` like the content below it.
 */
export function PageHeader({
  title,
  description,
  nav,
  children,
}: {
  title: string;
  description?: ReactNode;
  nav?: NavHref;
  children?: ReactNode;
}) {
  const heading = <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>;
  const row = nav ? navRow(nav) : undefined;
  const wash = row ? areaWash[row.area] : undefined;
  const body = (
    <>
      {nav ? (
        <div className="flex items-start gap-3">
          <AreaTile nav={nav} />
          {heading}
        </div>
      ) : (
        heading
      )}
      {description && (
        <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
      )}
      {children}
    </>
  );
  const block = 'flex flex-col gap-3 px-4 pt-10 pb-6 sm:px-8 md:pt-12';
  if (!wash) return <section className={block}>{body}</section>;
  return (
    <section className={cn('mb-6 border-b', wash)}>
      <div className={cn(block, 'max-w-7xl')}>{body}</div>
    </section>
  );
}
