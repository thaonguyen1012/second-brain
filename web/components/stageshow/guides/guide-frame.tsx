'use client';
import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import type { Msg } from '@/lib/i18n/translate';

/*
 * The frame around a guide in a page's empty state: a title, "Xem lại" (replay a guide that plays once) and
 * "Ẩn hướng dẫn" / "Xem hướng dẫn". Under a plain empty state (Giờ, Tuần) the guide starts closed (`defaultHidden`),
 * so the empty state stays the one focal point (DESIGN.md D1); in a first-run panel's slot (flush, below) and on
 * /huong-dan/ it starts open (DESIGN.md §9a "The guide in the slot" for the D2/D12/D28 exceptions). Once the owner opens or
 * hides a guide, that choice wins everywhere. It is remembered per guide in localStorage; every access is in
 * try/catch (private windows, blocked storage), with an in-memory copy so the toggle still works for the
 * session when storage is unavailable. On /huong-dan/ the frame is not hideable (`hideable={false}`: always
 * open, only "Xem lại") and uses the page variant (an 18px section title without the "Hướng dẫn: " prefix). The
 * frame aligns to the page gutter (no mx-auto) like every other block (DESIGN.md D8). The flush variant fills the
 * right slot of a first-run empty panel (components/brain/empty-panel.tsx, DESIGN.md §9a): open unless the owner
 * hid it, the stage without a ground, edge or radius of its own (the slot's well is its ground), and `fallback`
 * (ghost rows) in its place while hidden. Below sm the controls are icon-only with a tooltip, so the title keeps one
 * line. This file never imports the kit: the guide itself arrives as a next/dynamic component from lazy.tsx.
 */

const KEY = 'alex-brain:guide-hidden:';
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

function readHidden(id: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(KEY + id);
    if (v !== null) return v === '1';
  } catch {
    // storage blocked: fall back to this session's memory
  }
  return memory.get(id) ?? fallback;
}

function writeHidden(id: string, hidden: boolean) {
  memory.set(id, hidden);
  try {
    window.localStorage.setItem(KEY + id, hidden ? '1' : '0');
  } catch {
    // storage blocked: the memory copy above keeps the choice for this session
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
}

/** "Xem lại" etc.: a labelled ghost xs button from sm, an icon-only one with a tooltip below sm. */
function FrameControl({
  label,
  icon,
  onClick,
  expanded,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  expanded?: boolean;
}) {
  return (
    <>
      <Button size="xs" variant="ghost" aria-expanded={expanded} onClick={onClick} className="max-sm:hidden">
        {icon}
        {label}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={label}
              aria-expanded={expanded}
              onClick={onClick}
              className="sm:hidden"
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipPopup>{label}</TooltipPopup>
      </Tooltip>
    </>
  );
}

/** Sentence case for a page-variant title ("thu thập..." -> "Thu thập..."). */
function sentence(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

export function GuideFrame({
  id,
  title,
  Guide,
  replay,
  defaultHidden = false,
  hideable = true,
  variant = 'empty',
  fallback,
  className,
}: {
  /** Storage key part, one per guide */
  id: string;
  /** What the guide shows, after "Hướng dẫn: " (the page variant capitalises it instead) */
  title: Msg;
  Guide: ComponentType<{ className?: string }>;
  /** Offer "Xem lại" (guides that play once) */
  replay?: boolean;
  /** Closed until the owner opens it (empty states); a stored choice overrides this */
  defaultHidden?: boolean;
  /**
   * false (/huong-dan/): starts open whatever was stored and offers only "Xem lại". A looping guide (no replay)
   * still gets "Ẩn hướng dẫn" for this visit only, never stored, so its motion can be stopped (WCAG 2.2.2).
   */
  hideable?: boolean;
  /**
   * 'empty' under an empty state (quiet 14px title); 'page' as a section of /huong-dan/ (18px title); 'flush' fills
   * an empty panel's slot (its stage has no frame of its own, see above)
   */
  variant?: 'empty' | 'page' | 'flush';
  /** Flush only: shown under the header while the guide is hidden (the empty panel's ghost rows) */
  fallback?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const stored = useSyncExternalStore(
    subscribe,
    () => readHidden(id, defaultHidden),
    () => defaultHidden,
  );
  const [hiddenHere, setHiddenHere] = useState(false);
  const stoppable = hideable || !replay;
  const hidden = hideable ? stored : stoppable && hiddenHere;
  const [run, setRun] = useState(0);
  const headingId = `guide-${id}`;
  const flush = variant === 'flush';
  return (
    <section
      aria-labelledby={headingId}
      data-guide-flush={flush || undefined}
      className={cn(
        'flex w-full flex-col',
        flush
          ? // the slot's well is the ground: no radius, ground or border of the stage's own (guide CSS is unlayered,
            // hence the important flags); lazy.tsx's placeholders follow data-guide-flush
            '[&_.ss-fit]:after:hidden! [&_.ss-stage]:rounded-none! [&_.ss-stage]:bg-transparent!'
          : 'max-w-[600px] gap-2',
        className,
      )}
    >
      <div className={cn('flex flex-nowrap items-center gap-2', flush && 'min-h-12 px-4 py-2')}>
        <h2
          id={headingId}
          className={cn(
            // closed under an empty state, the toggle follows the title instead of floating 600px away
            'min-w-0',
            flush ? 'text-pretty' : 'truncate',
            variant === 'empty' && hidden ? 'flex-initial' : 'flex-1',
            variant === 'page'
              ? 'font-heading text-lg font-semibold tracking-tight'
              : cn('text-sm font-medium', hidden && 'font-normal text-muted-foreground'),
          )}
        >
          {variant === 'page' ? sentence(t(title), t.intl) : t('Hướng dẫn: {title}', { title: t(title) })}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {!hidden && replay && (
            <FrameControl label={t('Xem lại')} icon={<RotateCcw aria-hidden />} onClick={() => setRun((r) => r + 1)} />
          )}
          {stoppable && (
            <FrameControl
              label={hidden ? t('Xem hướng dẫn') : t('Ẩn hướng dẫn')}
              icon={hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              expanded={!hidden}
              onClick={() => (hideable ? writeHidden(id, !hidden) : setHiddenHere(!hidden))}
            />
          )}
        </div>
      </div>
      {!hidden && <Guide key={run} className="w-full" />}
      {flush && hidden && fallback && <div className="px-6 pt-2 pb-6">{fallback}</div>}
    </section>
  );
}
