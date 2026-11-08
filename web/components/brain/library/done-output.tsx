'use client';
import { CircleAlert, NotebookPen, Star } from 'lucide-react';
import type { ApiItem, ApiItemType } from '@/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import type { NoteDraft } from './note-dialog';

/** What a done Item still lacks (DECISIONS 4.2: "xong" needs an output); null when nothing is missing. */
export function missingOutput(item: Pick<ApiItem, 'status' | 'type' | 'rating' | 'noteCount'>): {
  note: boolean;
  rating: boolean;
} | null {
  if (item.status !== 'done') return null;
  const note = item.noteCount === 0;
  const rating = item.type === 'film' && !item.rating;
  return note || rating ? { note, rating } : null;
}

/** Starting text of a note written to close a done Item (DECISIONS 4.2: what each type asks for). */
const noteTemplates: Partial<Record<ApiItemType, Msg>> = {
  book: msg('## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n'),
  film: msg('Nhận xét: '),
};

/** The new note behind "Viết ghi chú": titled after the Item, linked to it, with the type's template. */
export function noteDraftForItem(item: ApiItem, t: T): NoteDraft {
  const template = noteTemplates[item.type];
  return { title: item.title.slice(0, 300), markdown: template ? t(template) : '', items: [item.id] };
}

/** The output each type asks for (DECISIONS 4.2). */
const noteHint: Record<string, Msg> = {
  book: msg('Ghi highlights và 3 ý chính.'),
  film: msg('Ghi một câu nhận xét.'),
  course: msg('Ghi lại những gì đã học được.'),
  article: msg('Ghi vài ý chính đáng nhớ.'),
  project: msg('Ghi kết quả và bài học rút ra.'),
};

function hintText(type: string, gap: { note: boolean; rating: boolean }, t: T): string {
  if (type === 'film' && gap.note && gap.rating) return t('Ghi một câu nhận xét và chấm điểm 1–10.');
  if (gap.note) return noteHint[type] ? t(noteHint[type]) : t('Ghi lại vài dòng về nó.');
  return t('Còn thiếu điểm 1–10.');
}

/** The gap as a short meta phrase for a list row ("Chưa có ghi chú", "Chưa chấm điểm"). */
export function gapLabel(gap: { note: boolean; rating: boolean }, t: T): string {
  if (gap.note && gap.rating) return t('Chưa có ghi chú, chưa chấm điểm');
  return gap.note ? t('Chưa có ghi chú') : t('Chưa chấm điểm', null, 'rating');
}

/**
 * Gentle reminder in the Item dialog on a done Item without its output: no note yet, or a film without a rating
 * (a warning Alert, DESIGN.md §6; no sparkle, D18). `onWriteNote` opens a new note linked to the Item; `onRate`
 * (films) focuses the rating. List rows show `gapLabel()` in their meta line instead.
 */
export function DoneOutputHint({
  type,
  gap,
  onWriteNote,
  onRate,
  className,
}: {
  type: string;
  gap: { note: boolean; rating: boolean };
  onWriteNote?: () => void;
  onRate?: () => void;
  className?: string;
}) {
  const t = useT();
  const actions = (gap.note && onWriteNote) || (gap.rating && onRate);
  return (
    <Alert variant="warning" role="note" className={className}>
      <CircleAlert aria-hidden />
      <AlertTitle>{t('Xong rồi, nhưng chưa có đầu ra.')}</AlertTitle>
      <AlertDescription>{hintText(type, gap, t)}</AlertDescription>
      {actions && (
        <div className="col-start-2 mt-2 flex flex-wrap gap-2">
          {gap.note && onWriteNote && (
            <Button size="xs" variant="outline" type="button" onClick={onWriteNote}>
              <NotebookPen aria-hidden />
              {t('Viết ghi chú')}
            </Button>
          )}
          {gap.rating && onRate && (
            <Button size="xs" variant="outline" type="button" onClick={onRate}>
              <Star aria-hidden />
              {t('Chấm điểm', null, 'rating')}
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
}
