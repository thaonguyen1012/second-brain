'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    !!target.closest('[role="dialog"],[role="listbox"],[role="menu"]')
  );
}

/** Single-key page shortcuts (no modifier), ignored while typing or inside a dialog. */
export function useShortcuts(keys: Record<string, () => void>) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const fn = ref.current[e.key.toLowerCase()];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** "‹ Tháng 11/2026 ›" style period switcher; `[` and `]` step it from the keyboard (no on-screen hint, DESIGN.md D24). */
export function PeriodStepper({
  label,
  onPrev,
  onNext,
  nextDisabled,
  current,
  onCurrent,
  currentLabel,
  name,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  current: boolean;
  onCurrent: () => void;
  currentLabel: string;
  /** What is stepped, for the button names ("tháng", "tuần"). */
  name: string;
}) {
  useShortcuts({
    '[': onPrev,
    ']': () => !nextDisabled && onNext(),
  });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="icon-sm" variant="outline" onClick={onPrev} aria-label={`${name} trước`}>
        <ChevronLeft aria-hidden />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {label}
      </span>
      <Button
        size="icon-sm"
        variant="outline"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={`${name} sau`}
      >
        <ChevronRight aria-hidden />
      </Button>
      {!current && (
        <Button size="sm" variant="ghost" onClick={onCurrent}>
          {currentLabel}
        </Button>
      )}
    </div>
  );
}

/** Label + control stacked, the form layout of the item dialog. */
export function FormRow({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
      {error}
    </p>
  );
}

/** Section title inside a page body. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{children}</h2>
      {action && <div className="ms-auto flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
