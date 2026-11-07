'use client';
import { CircleAlert, NotebookPen, Star } from 'lucide-react';
import type { ApiItem, ApiItemType } from '@/lib/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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

/**
 * Starting text of a new note on an Item, one per type (DECISIONS 4.2: the output each type asks for; 9.8: a template
 * for all five). The same words as the hints below, as headings to fill in.
 */
export const noteTemplates: Record<ApiItemType, string> = {
  book: '## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n',
  film: 'Nhận xét: ',
  course: '## Học được gì\n\n- \n\n## Sẽ áp dụng vào đâu\n\n- \n',
  article: '## Ý chính\n\n- \n\n## Vì sao đáng nhớ\n\n',
  project: '## Kết quả (kèm con số)\n\n- \n\n## Bài học rút ra\n\n- \n',
};

/** The type's template; an unknown type starts empty. */
export const noteTemplateFor = (type: string): string => noteTemplates[type as ApiItemType] ?? '';

/** The new note behind "Viết ghi chú": titled after the Item, linked to it, with the type's template. */
export function noteDraftForItem(item: ApiItem): NoteDraft {
  return { title: item.title.slice(0, 300), markdown: noteTemplateFor(item.type), items: [item.id] };
}

/** The output each type asks for (DECISIONS 4.2). */
const noteHint: Record<string, string> = {
  book: 'Ghi highlights và 3 ý chính.',
  film: 'Ghi một câu nhận xét.',
  course: 'Ghi lại những gì đã học được.',
  article: 'Ghi vài ý chính đáng nhớ.',
  project: 'Ghi kết quả và bài học rút ra.',
};

function hintText(type: string, gap: { note: boolean; rating: boolean }): string {
  if (type === 'film' && gap.note && gap.rating) return 'Ghi một câu nhận xét và chấm điểm 1–10.';
  if (gap.note) return noteHint[type] ?? 'Ghi lại vài dòng về nó.';
  return 'Còn thiếu điểm 1–10.';
}

/** The gap as a short meta phrase for a list row ("Chưa có ghi chú", "Chưa chấm điểm"). */
export function gapLabel(gap: { note: boolean; rating: boolean }): string {
  if (gap.note && gap.rating) return 'Chưa có ghi chú, chưa chấm điểm';
  return gap.note ? 'Chưa có ghi chú' : 'Chưa chấm điểm';
}

/**
 * Gentle reminder on a done Item without its output (the Item page and the Item dialog): no note yet, or a film without
 * a rating (a warning Alert, DESIGN.md §6; no sparkle, D18). `onWriteNote` opens a new note linked to the Item;
 * `onRate` (films) goes to the rating. List rows show `gapLabel()` in their meta line instead.
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
  const actions = (gap.note && onWriteNote) || (gap.rating && onRate);
  return (
    <Alert variant="warning" role="note" className={className}>
      <CircleAlert aria-hidden />
      <AlertTitle>Xong rồi, nhưng chưa có đầu ra.</AlertTitle>
      <AlertDescription>{hintText(type, gap)}</AlertDescription>
      {actions && (
        <div className="col-start-2 mt-2 flex flex-wrap gap-2">
          {gap.note && onWriteNote && (
            <Button size="xs" variant="outline" type="button" onClick={onWriteNote}>
              <NotebookPen aria-hidden />
              Viết ghi chú
            </Button>
          )}
          {gap.rating && onRate && (
            <Button size="xs" variant="outline" type="button" onClick={onRate}>
              <Star aria-hidden />
              Chấm điểm
            </Button>
          )}
        </div>
      )}
    </Alert>
  );
}
