'use client';
import type { ReactNode } from 'react';
import { CircleAlert, History, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { newNoteQuery } from '@/lib/note-copies';
import { useNewNoteCopies, useUnsavedCopy, type NoteText, type SaveState } from './use-note-autosave';

/**
 * The autosave's state beside a note being edited (AFFiNE's "Saved"): nothing until something changes, "Đang lưu…"
 * while a change waits or goes, "Đã lưu" once the server has it, and on a failure the reason with "Thử lại" (the text
 * stays in the editor and in this browser's copy meanwhile). "Đã lưu" and a failure are read out (a polite live
 * region, the focus stays in the text); "Đang lưu…" is not, or every pause in typing would be announced twice.
 * Without `onRetry` (the text itself cannot be saved: empty, too long) there is no "Thử lại"; `action` stands beside
 * the reason instead (the Item page: "Xóa ghi chú" for an emptied note).
 */
export function SaveStatus({
  state,
  error,
  onRetry,
  action,
  className,
}: {
  state: SaveState;
  error: string | null;
  onRetry?: () => void;
  action?: ReactNode;
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
            {/* error-foreground: AA on the page (destructive-foreground is 3.8:1 on white) */}
            <span className="text-error-foreground">{t('Chưa lưu được: {reason}', { reason: error ?? '' })}</span>
          </>
        )}
      </span>
      {state === 'error' && onRetry && (
        <Button size="xs" variant="outline" onClick={onRetry}>
          {t('Thử lại')}
        </Button>
      )}
      {state === 'error' && action}
    </span>
  );
}

/**
 * The reading view's word that this browser keeps unsaved text of a note (or of a new one, `text` null): the editor
 * offers it back. Shown until the copy is restored, dropped or saved. A copy written over a version the note was saved
 * after since (`text.updatedAt`) is not called unsaved: it may be on the server already. `name`: the note's, where
 * several notes can each show this line (the Item page); the link's name then ends with it.
 */
export function UnsavedCopyHint({
  copyKey,
  text,
  name,
  onOpen,
}: {
  copyKey: string;
  text: (NoteText & { updatedAt?: string }) | null;
  name?: string;
  onOpen: () => void;
}) {
  const t = useT();
  const offer = useUnsavedCopy(copyKey, text);
  if (!offer) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <History className="size-3.5 shrink-0" aria-hidden />
      {offer === 'older'
        ? t('Có bản nháp viết trên bản cũ hơn của ghi chú')
        : t('Có bản nháp chưa lưu trong trình duyệt này')}
      {/* underlined at rest: inside this line of text its blue alone would not mark it (WCAG 1.4.1) */}
      <Button
        variant="link"
        size="xs"
        className="h-auto p-0 text-xs underline"
        aria-label={
          name === undefined
            ? undefined
            : offer === 'older'
              ? t('Mở để xem “{title}”', { title: name })
              : t('Mở để khôi phục “{title}”', { title: name })
        }
        onClick={onOpen}
      >
        {offer === 'older' ? t('Mở để xem') : t('Mở để khôi phục')}
      </Button>
    </p>
  );
}

/**
 * The notes list's word that this browser keeps a new note's unsaved text: one line per place it was written (the
 * notes page, a new note of an Item), each opening that place, where the editor offers it back.
 */
export function NewNoteCopyHints({ onOpen }: { onOpen: (query: string) => void }) {
  const t = useT();
  const keys = useNewNoteCopies();
  return keys.map((key) => {
    const query = newNoteQuery(key);
    if (!query) return null;
    return (
      <p key={key} className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <History className="size-3.5 shrink-0" aria-hidden />
        {t('Có bản nháp chưa lưu trong trình duyệt này')}
        <Button variant="link" size="xs" className="h-auto p-0 text-xs underline" onClick={() => onOpen(query)}>
          {t('Mở để khôi phục')}
        </Button>
      </p>
    );
  });
}
