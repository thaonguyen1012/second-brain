'use client';
import { useRef, useState, type ReactElement, type ReactNode } from 'react';
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

/**
 * Where focus goes after a card deleted from its own trigger has unmounted: the first control of the next card,
 * else of the previous one, else the first control of the section (e.g. "Thêm"), else its heading or the page's.
 * Candidates are collected before the delete; the first one still in the document wins.
 */
function focusCandidates(trigger: HTMLElement | null): HTMLElement[] {
  const card = trigger?.closest<HTMLElement>('article, li');
  if (!card) return [];
  const control = 'button:not([disabled]), a[href]';
  const first = (el: Element | null | undefined) => el?.querySelector<HTMLElement>(control) ?? null;
  const section = card.closest('section');
  const sectionControl = section
    ? (Array.from(section.querySelectorAll<HTMLElement>(control)).find((el) => !card.contains(el)) ?? null)
    : null;
  const heading = section?.querySelector<HTMLElement>('h1, h2, h3') ?? null;
  const pageHeading = document.querySelector<HTMLElement>('main h1, h1');
  const all = [first(card.nextElementSibling), first(card.previousElementSibling), sectionControl, heading, pageHeading];
  return all.filter(
    (el): el is HTMLElement => el !== null,
  );
}

function focusFirstConnected(candidates: HTMLElement[]) {
  // after React has removed the card and Base UI has given up returning focus to the vanished trigger
  requestAnimationFrame(() =>
    window.setTimeout(() => {
      const el = candidates.find((c) => c.isConnected);
      if (!el) return;
      if (el.tabIndex < 0 && !el.matches('button, a[href]')) el.tabIndex = -1;
      el.focus();
    }, 0),
  );
}

/**
 * Confirmation before a DELETE (Space UI alert dialog; never window.confirm). `action` runs the request; on
 * success, or on 404 (already gone, e.g. deleted in another tab), `onDeleted` updates the page and the dialog
 * closes. Errors stay in the dialog. Either controlled (`open`/`onOpenChange`, for keyboard shortcuts) or with a
 * `trigger` element that opens it. Cancel has the initial focus, so Enter alone never deletes.
 * `focusNeighbour` (trigger mode, trigger inside the card that onDeleted removes): moves focus to the next card,
 * since the trigger Base UI would return focus to is gone.
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
  focusNeighbour = false,
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
  focusNeighbour?: boolean;
}) {
  const t = useT();
  const [innerOpen, setInnerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Text shown while the popup animates out: controlled callers clear their target as soon as it closes.
  const [closing, setClosing] = useState<{ title: string; description: ReactNode } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isOpen = open ?? innerOpen;

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
    const candidates = focusNeighbour ? focusCandidates(triggerRef.current) : [];
    onDeleted();
    close();
    if (candidates.length > 0) focusFirstConnected(candidates);
  };

  const shown = !isOpen && closing ? closing : { title, description };

  return (
    <AlertDialog open={isOpen} onOpenChange={change} onOpenChangeComplete={(o) => !o && setClosing(null)}>
      {trigger && <AlertDialogTrigger ref={triggerRef} render={trigger} />}
      {/* Page shortcuts listen on window: keys typed here (J, E, [ ...) must not reach them. */}
      <AlertDialogPopup onKeyDown={(e) => e.stopPropagation()}>
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
