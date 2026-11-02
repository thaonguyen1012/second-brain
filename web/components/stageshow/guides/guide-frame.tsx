'use client';
import { useState, useSyncExternalStore, type ComponentType } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * The frame around a guide in a page's empty state: a title, "Xem lại" (replay a guide that plays once) and
 * "Ẩn hướng dẫn" / "Hiện hướng dẫn". The choice is remembered per guide in localStorage; every access is in
 * try/catch (private windows, blocked storage), with an in-memory copy so the toggle still works for the
 * session when storage is unavailable. This file never imports the kit: the guide itself arrives as a
 * next/dynamic component from lazy.tsx.
 */

const KEY = 'alex-brain:guide-hidden:';
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

function readHidden(id: string): boolean {
  try {
    const v = window.localStorage.getItem(KEY + id);
    if (v !== null) return v === '1';
  } catch {
    // storage blocked: fall back to this session's memory
  }
  return memory.get(id) ?? false;
}

function writeHidden(id: string, hidden: boolean) {
  memory.set(id, hidden);
  try {
    if (hidden) window.localStorage.setItem(KEY + id, '1');
    else window.localStorage.removeItem(KEY + id);
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

export function GuideFrame({
  id,
  title,
  Guide,
  replay,
  className,
}: {
  /** Storage key part, one per guide */
  id: string;
  /** What the guide shows, after "Hướng dẫn: " */
  title: string;
  Guide: ComponentType<{ className?: string }>;
  /** Offer "Xem lại" (guides that play once) */
  replay?: boolean;
  className?: string;
}) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => readHidden(id),
    () => false,
  );
  const [run, setRun] = useState(0);
  const headingId = `guide-${id}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn('mx-auto flex w-full max-w-[600px] flex-col gap-2', className)}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 id={headingId} className="text-sm font-medium">
          Hướng dẫn: {title}
        </h2>
        <div className="ms-auto flex items-center gap-1">
          {!hidden && replay && (
            <Button size="xs" variant="ghost" onClick={() => setRun((r) => r + 1)}>
              <RotateCcw aria-hidden />
              Xem lại
            </Button>
          )}
          <Button size="xs" variant="ghost" aria-expanded={!hidden} onClick={() => writeHidden(id, !hidden)}>
            {hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
            {hidden ? 'Hiện hướng dẫn' : 'Ẩn hướng dẫn'}
          </Button>
        </div>
      </div>
      {!hidden && <Guide key={run} className="w-full" />}
    </section>
  );
}
