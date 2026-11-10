import type { ReactNode } from 'react';
import { navRow, type AreaKey, type NavHref } from '@/lib/app-nav';
import { cn } from '@/lib/utils';

/**
 * Pages that sit on the header band (DESIGN.md §9a): the five areas with sidebar groups. Owner 07/11/2026: one
 * neutral band (the well) for all of them, no colour per area. Hôm nay has none (it gathers every area), nor do pages
 * without a row (Inbox, capture, Giới thiệu, Hướng dẫn).
 */
const banded: ReadonlySet<AreaKey> = new Set(['week', 'growth', 'library', 'opportunity', 'work']);

/**
 * The page's sidebar row icon before the title (DESIGN.md §5): ink colour like the title, no tile, 28px with a 1.5px
 * line (absolute, so it matches the sidebar's 16px icons), centred on the title's 36px first line. Kỹ năng shows the
 * Kỹ năng icon, not one icon for all of Phát triển.
 */
export function AreaTile({ nav, className }: { nav: NavHref; className?: string }) {
  const row = navRow(nav);
  if (!row) return null;
  const Icon = row.icon;
  return (
    <span aria-hidden className={cn('flex h-9 shrink-0 items-center', className)}>
      <Icon className="size-7 text-foreground forced-colors:text-inherit" strokeWidth={1.5} absoluteStrokeWidth />
    </span>
  );
}

/**
 * Title block shared by the app pages (same spacing as the home and roadmap headers). `nav` is the page's sidebar row
 * href: its icon goes before the title, on its first line; pages outside the six areas pass none. On the five areas
 * with groups the block sits on the neutral header band (full-bleed, `border-b`, 24px above the content), its text
 * capped at `max-w-7xl` like the content below it.
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
  const band = row ? banded.has(row.area) : false;
  const body = (
    <>
      {nav ? (
        <div className="flex items-start gap-2.5">
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
  if (!band) return <section className={block}>{body}</section>;
  return (
    <section className="mb-6 border-b bg-well">
      <div className={cn(block, 'max-w-7xl')}>{body}</div>
    </section>
  );
}
