'use client';
import { useState, type ReactElement, type ReactNode } from 'react';
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
import { describeApiError } from './api-state';

/**
 * Vietnamese text for a failed DELETE: 409 carries the backend's own message (a project with time entries),
 * anything else falls back to the shared API error titles.
 */
function deleteError(err: unknown): string {
  const e = toApiError(err);
  if (e.reachable && e.status === 409) return firstFieldError(e.body) ?? 'Chưa xóa được: mục này còn dữ liệu liên kết.';
  if (e.reachable && e.status !== 401 && e.status !== 403) return `Chưa xóa được (lỗi ${e.status}). Thử lại sau.`;
  return describeApiError(e).title;
}

/**
 * Confirmation before a DELETE (Space UI alert dialog; never window.confirm). `action` runs the request; on
 * success, or on 404 (already gone, e.g. deleted in another tab), `onDeleted` updates the page and the dialog
 * closes. Errors stay in the dialog. Either controlled (`open`/`onOpenChange`, for keyboard shortcuts) or with a
 * `trigger` element that opens it. Cancel has the initial focus, so Enter alone never deletes.
 */
export function ConfirmDelete({
  title,
  description,
  confirmLabel = 'Xóa',
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
  const [innerOpen, setInnerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpen = open ?? innerOpen;

  const change = (next: boolean) => {
    if (busy) return;
    if (next) setError(null);
    setInnerOpen(next);
    onOpenChange?.(next);
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
        setError(deleteError(err));
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    onDeleted();
    setInnerOpen(false);
    onOpenChange?.(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={change}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      {/* Page shortcuts listen on window: keys typed here (J, E, [ ...) must not reach them. */}
      <AlertDialogPopup onKeyDown={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? 'Không hoàn tác được.'}</AlertDialogDescription>
          {error && (
            <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
              {error}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" type="button" disabled={busy} />}>Hủy</AlertDialogClose>
          <Button variant="destructive" type="button" onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

/** The small "Xóa" button used on cards and rows; pass it as `trigger` or wire its onClick. */
export function DeleteButton({
  label = 'Xóa',
  className,
  children,
  ...props
}: { label?: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button size="xs" variant="ghost" className={cn('text-destructive-foreground', className)} {...props}>
      <Trash2 aria-hidden />
      {children ?? label}
    </Button>
  );
}
