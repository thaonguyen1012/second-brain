'use client';
import { useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toApiError } from '@/lib/api/use-api';
import { firstFieldError } from '@/lib/labels';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { describeApiError } from './api-state';
import { lastRowMenuTrigger } from './row-menu';

/**
 * The text for a failed DELETE: 409 carries the backend's own message (a project with time entries), anything else
 * falls back to the shared API error titles.
 */
function deleteError(err: unknown, t: T): string {
  const e = toApiError(err);
  if (e.reachable && e.status === 409)
    return firstFieldError(e.body, t) ?? t('Chưa xóa được: mục này còn dữ liệu liên kết.');
  if (e.reachable && e.status !== 401 && e.status !== 403)
    return t('Chưa xóa được (lỗi {status}). Thử lại sau.', { status: e.status });
  return describeApiError(e, t).title;
}

/** A row of a list (its controls go with it), and the controls that can take the focus after a delete. */
const ROW = 'li, article';
const CONTROL = 'button:not([disabled]), a[href]';

/**
 * Where the focus goes once the row holding `from` is deleted (WCAG 2.4.3): the first control of the next row, else
 * of the previous one (each in turn: a tool listed under two stages goes from both), else the heading of each section
 * around the list, innermost first (a board lane, the list's own section), else the page's h1. A list split into
 * groups that go with their last row (Giờ's days, "Theo item", Công cụ's stages) marks their container
 * `data-row-groups`, so its rows count as one list. Collected while the row is still there; `focusTarget` then picks
 * the first one still in the document.
 */
export function focusCandidates(from: Element | null | undefined): HTMLElement[] {
  const row = from?.closest<HTMLElement>(ROW);
  if (!row) return [];
  const groups = row.parentElement?.closest('[data-row-groups]');
  const rows = groups
    ? Array.from(groups.querySelectorAll<HTMLElement>(ROW)).filter((r) => {
        const outer = r.parentElement?.closest(ROW);
        return !outer || !groups.contains(outer);
      })
    : Array.from(row.parentElement?.children ?? []).filter(
        (r): r is HTMLElement => r instanceof HTMLElement && r.matches(ROW),
      );
  const at = rows.indexOf(row);
  const around = [...rows.slice(at + 1), ...rows.slice(0, Math.max(at, 0)).reverse()];
  const out = around.map((r) => r.querySelector<HTMLElement>(CONTROL));
  for (let s = row.closest('section'); s; s = s.parentElement?.closest('section') ?? null)
    out.push(s.querySelector<HTMLElement>('h1, h2, h3'));
  out.push(document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1'));
  return out.filter((el): el is HTMLElement => el !== null && !row.contains(el));
}

/** The first candidate still in the document; a heading gets tabIndex -1 so it can hold the focus (not tabbable). */
export function focusTarget(candidates: readonly HTMLElement[] | null | undefined): HTMLElement | null {
  const el = candidates?.find((c) => c.isConnected) ?? null;
  if (el && el.tabIndex < 0 && !el.matches(CONTROL)) el.tabIndex = -1;
  return el;
}

/**
 * Confirmation before a DELETE (Space UI alert dialog; never window.confirm). `action` runs the request; on
 * success, or on 404 (already gone, e.g. deleted in another tab), `onDeleted` updates the page and the dialog
 * closes. Errors stay in the dialog. Either controlled (`open`/`onOpenChange`, for keyboard shortcuts) or with a
 * `trigger` element that opens it. Cancel has the initial focus, so Enter alone never deletes.
 * After a delete the control the dialog came from has gone with its row: the focus goes to the row's neighbour
 * (`focusCandidates`) as the dialog closes (back to the control when its row stays), unless the page has placed it
 * already (Tuần's objectives, the Item page's notes). The row is found from the trigger, or (controlled) from what
 * held the focus as the dialog opened: a row menu's item stands for that menu's trigger.
 */
export function ConfirmDelete({
  title,
  description,
  confirmLabel,
  action,
  onDeleted,
  open,
  onOpenChange,
  trigger,
}: {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  action: () => Promise<unknown>;
  onDeleted: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rendered as the trigger (e.g. a Button); omit when controlled. */
  trigger?: ReactElement;
}) {
  const t = useT();
  const [innerOpen, setInnerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Text shown while the popup animates out: controlled callers clear their target as soon as it closes.
  const [closing, setClosing] = useState<{ title: string; description: ReactNode } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isOpen = open ?? innerOpen;
  const controlled = !trigger;
  // Controlled: what held the focus as the dialog opened (a row menu's item: that menu's trigger, in the row)
  const origin = useRef<HTMLElement | null>(null);
  // Set by a delete that went through: the deleted row's neighbours, for the focus once the dialog has closed
  const after = useRef<HTMLElement[] | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !controlled) return;
    const active = document.activeElement;
    origin.current =
      !(active instanceof HTMLElement) || active === document.body
        ? null
        : active.closest('[role="menu"]')
          ? lastRowMenuTrigger()
          : active;
  }, [isOpen, controlled]);

  // finalFocus: Base UI's default (the trigger, or what had the focus before) unless a delete went through from a row.
  // Then the row's neighbour, picked after React's commit: a dialog inside the row closes with it, in the commit that
  // also takes away a heading or a group that went with the row. Nothing when the page has placed the focus itself;
  // a Sheet around the list that took it as a fallback (its popup) has not.
  const returnFocus = () => {
    const next = after.current;
    after.current = null;
    if (!next?.length) return true;
    queueMicrotask(() => {
      const active = document.activeElement;
      const placed =
        active instanceof HTMLElement &&
        active !== document.body &&
        active.isConnected &&
        !active.matches('[role="dialog"]') &&
        !active.closest('[data-slot="alert-dialog-popup"]');
      if (!placed) focusTarget(next)?.focus();
    });
    return false;
  };

  // Every opening starts clean, also a controlled one (Base UI calls onOpenChange only for its own trigger).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setError(null);
      setClosing(null);
    }
  }

  const close = () => {
    setClosing({ title, description });
    setInnerOpen(false);
    onOpenChange?.(false);
  };

  const change = (next: boolean) => {
    if (busy) return;
    if (!next) return close();
    setInnerOpen(true);
    onOpenChange?.(true);
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const e = toApiError(err);
      if (!(e.reachable && e.status === 404)) {
        setError(deleteError(err, t));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    // The row goes with onDeleted: its neighbours are read while it is still there. The control itself comes first:
    // a delete by key (Del on Ghi chú's cursor row) may have left the focus in a row that stays.
    const from = controlled ? origin.current : triggerRef.current;
    const near = focusCandidates(from);
    after.current = from && near.length > 0 ? [from, ...near] : near;
    onDeleted();
    close();
  };

  const shown = !isOpen && closing ? closing : { title, description };

  return (
    <AlertDialog open={isOpen} onOpenChange={change} onOpenChangeComplete={(o) => !o && setClosing(null)}>
      {trigger && <AlertDialogTrigger ref={triggerRef} render={trigger} />}
      {/* Page shortcuts listen on window: keys typed here (J, E, [ ...) must not reach them. */}
      <AlertDialogPopup onKeyDown={(e) => e.stopPropagation()} finalFocus={returnFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{shown.title}</AlertDialogTitle>
          <AlertDialogDescription>{shown.description ?? t('Không hoàn tác được.')}</AlertDialogDescription>
          {error && (
            <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" type="button" disabled={busy} />}>{t('Hủy')}</AlertDialogClose>
          <Button variant="destructive" type="button" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            {confirmLabel ?? t('Xóa')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

/** The small "Xóa" button used on cards and rows; pass it as `trigger` or wire its onClick. */
export function DeleteButton({
  label,
  className,
  children,
  ...props
}: { label?: string } & React.ComponentProps<typeof Button>) {
  const t = useT();
  return (
    <Button size="xs" variant="ghost" className={cn('text-destructive-foreground', className)} {...props}>
      <Trash2 aria-hidden />
      {children ?? label ?? t('Xóa')}
    </Button>
  );
}
