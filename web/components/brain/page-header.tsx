import type { ReactNode } from 'react';
import { areaIcon, navByArea, type AreaKey } from '@/lib/app-nav';
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

/** An area's nav icon in its colour on its tint (DESIGN.md §4, §5); 36px, the page title's line height. */
export function AreaTile({ area, className }: { area: AreaKey; className?: string }) {
  const Icon = navByArea[area].icon;
  return (
    <span
      aria-hidden
      className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', areaTile[area], className)}
    >
      <Icon className={cn('size-5', areaIcon[area])} />
    </span>
  );
}

/**
 * Title block shared by the app pages (same spacing as the home and roadmap headers). `area` puts the tile of the
 * sidebar area the page belongs to before the title, on its first line; pages outside the six areas pass none.
 */
export function PageHeader({
  title,
  description,
  area,
  children,
}: {
  title: string;
  description?: ReactNode;
  area?: AreaKey;
  children?: ReactNode;
}) {
  const heading = <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>;
  return (
    <section className="flex flex-col gap-3 px-4 pt-10 pb-6 sm:px-8 md:pt-12">
      {area ? (
        <div className="flex items-start gap-3">
          <AreaTile area={area} />
          {heading}
        </div>
      ) : (
        heading
      )}
      {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
