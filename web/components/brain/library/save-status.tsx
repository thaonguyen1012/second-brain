'use client';
import { CircleAlert, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { SaveState } from './use-note-autosave';

/**
 * The autosave's state beside a note being edited (AFFiNE's "Saved"): nothing until something changes, "Đang lưu…"
 * while a change waits or goes, "Đã lưu" once the server has it, and on a failure the reason with "Thử lại" (the text
 * stays in the editor and in this browser's copy meanwhile). "Đã lưu" and a failure are read out (a polite live
 * region, the focus stays in the text); "Đang lưu…" is not, or every pause in typing would be announced twice.
 */
export function SaveStatus({
  state,
  error,
  onRetry,
  className,
}: {
  state: SaveState;
  error: string | null;
  onRetry: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <span className={cn('inline-flex min-h-6 items-center gap-1.5 text-xs text-muted-foreground', className)}>
      {(state === 'waiting' || state === 'saving') && (
        <>
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
          {t('Đang lưu…')}
        </>
      )}
      <span aria-live="polite" className="inline-flex items-center gap-1.5">
        {state === 'saved' && t('Đã lưu')}
        {state === 'error' && (
          <>
            <CircleAlert className="size-3.5 shrink-0 text-destructive-foreground" aria-hidden />
            <span className="text-destructive-foreground">{t('Chưa lưu được: {reason}', { reason: error ?? '' })}</span>
          </>
        )}
      </span>
      {state === 'error' && (
        <Button size="xs" variant="outline" onClick={onRetry}>
          {t('Thử lại')}
        </Button>
      )}
    </span>
  );
}
