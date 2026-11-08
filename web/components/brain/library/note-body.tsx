'use client';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';

// The renderer (react-markdown + remark-gfm) is its own chunk, fetched with the first note shown on the Item page or
// the notes page; Hôm nay never imports this file (home First Load JS budget, DECISIONS 10.2).
const Rendered = lazy(() => import('./note-markdown'));

/**
 * A note's markdown as reading text. Until the renderer's chunk arrives the text shows as typed (same words, same
 * place), so a note never flashes empty. `look` "page" is the note page's (a larger first heading level, as its editor).
 */
export function NoteBody({
  markdown,
  look,
  className,
}: {
  markdown: string;
  look?: 'inline' | 'page';
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <p className={cn('text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground', className)}>
          {markdown}
        </p>
      }
    >
      <Rendered markdown={markdown} look={look} className={className} />
    </Suspense>
  );
}
