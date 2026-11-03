'use client';
import { useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/*
 * The frame around a guide in a page's empty state: a title, "Xem lại" (replay a guide that plays once) and
 * "Ẩn hướng dẫn" / "Xem hướng dẫn". Under an empty state the guide starts closed (`defaultHidden`), so the
 * empty state stays the one focal point (DESIGN.md D1, D26); /huong-dan/ starts open. Once the owner opens or
 * hides a guide, that choice wins everywhere. It is remembered per guide in localStorage; every access is in
 * try/catch (private windows, blocked storage), with an in-memory copy so the toggle still works for the
 * session when storage is unavailable. On /huong-dan/ the frame is not hideable (`hideable={false}`: always
 * open, only "Xem lại") and uses the page variant (an 18px section title without the "Hướng dẫn: " prefix). The
 * frame aligns to the page gutter (no mx-auto) like every other block (DESIGN.md D8). Below sm the controls are
 * icon-only with a tooltip, so the title keeps one line. This file never imports the kit: the guide itself
 * arrives as a next/dynamic component from lazy.tsx.
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
function sentence(text: string): string {
  return text.charAt(0).toLocaleUpperCase('vi') + text.slice(1);
}

export function GuideFrame({
  id,
  title,
  Guide,
  replay,
  defaultHidden = false,
  hideable = true,
  variant = 'empty',
  className,
}: {
  /** Storage key part, one per guide */
  id: string;
  /** What the guide shows, after "Hướng dẫn: " (the page variant capitalises it instead) */
  title: string;
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
  /** 'empty' under an empty state (quiet 14px title); 'page' as a section of /huong-dan/ (18px title) */
  variant?: 'empty' | 'page';
  className?: string;
}) {
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
  return (
    <section aria-labelledby={headingId} className={cn('flex w-full max-w-[600px] flex-col gap-2', className)}>
      <div className="flex flex-nowrap items-center gap-2">
        <h2
          id={headingId}
          className={cn(
            // closed under an empty state, the toggle follows the title instead of floating 600px away
            'min-w-0 truncate',
            variant === 'empty' && hidden ? 'flex-initial' : 'flex-1',
            variant === 'page'
              ? 'font-heading text-lg font-semibold tracking-tight'
              : cn('text-sm font-medium', hidden && 'font-normal text-muted-foreground'),
          )}
        >
          {variant === 'page' ? sentence(title) : `Hướng dẫn: ${title}`}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {!hidden && replay && (
            <FrameControl label="Xem lại" icon={<RotateCcw aria-hidden />} onClick={() => setRun((r) => r + 1)} />
          )}
          {stoppable && (
            <FrameControl
              label={hidden ? 'Xem hướng dẫn' : 'Ẩn hướng dẫn'}
              icon={hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              expanded={!hidden}
              onClick={() => (hideable ? writeHidden(id, !hidden) : setHiddenHere(!hidden))}
            />
          )}
        </div>
      </div>
      {!hidden && <Guide key={run} className="w-full" />}
    </section>
  );
}
