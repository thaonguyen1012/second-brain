'use client';
import { NotebookPen, Sparkles, Star } from 'lucide-react';
import type { ApiItem, ApiItemType } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
const noteTemplates: Partial<Record<ApiItemType, string>> = {
  book: '## Highlights\n\n- \n\n## 3 ý chính\n\n1. \n2. \n3. \n',
  film: 'Nhận xét: ',
};

/** The new note behind "Viết ghi chú": titled after the Item, linked to it, with the type's template. */
export function noteDraftForItem(item: ApiItem): NoteDraft {
  return { title: item.title.slice(0, 300), markdown: noteTemplates[item.type] ?? '', items: [item.id] };
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

/**
 * Gentle reminder on a done Item without its output: no note yet, or a film without a rating. `onWriteNote`
 * opens a new note linked to the Item; `onRate` (films) opens or focuses the rating.
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
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-warning-foreground/20 bg-warning/40 px-3 py-2 text-[13px] leading-snug',
        className,
      )}
    >
      <p className="flex min-w-0 flex-1 basis-48 items-start gap-2">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden />
        <span>
          <span className="font-medium">Xong rồi, nhưng chưa có đầu ra.</span>{' '}
          <span className="text-muted-foreground">{hintText(type, gap)}</span>
        </span>
      </p>
      <span className="flex flex-wrap gap-1.5">
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
      </span>
    </div>
  );
}
