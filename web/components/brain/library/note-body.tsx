'use client';
import { lazy, Suspense, useState } from 'react';
import { cn } from '@/lib/utils';

// The renderer (react-markdown + remark-gfm) is its own chunk, fetched with the first note shown on the Item page or
// the notes page; Hôm nay never imports this file (home First Load JS budget, DECISIONS 10.2).
let loaded: typeof import('./note-markdown') | undefined;
const load = () => import('./note-markdown').then((module) => (loaded = module));
const Rendered = lazy(load);

/** Fetches the renderer ahead (the pages that open the editor: its loading state shows the note through it). */
export function preloadNoteBody() {
  load().catch(() => {}); // offline: the first note shown asks again
}

/**
 * A note's markdown as reading text. Until the renderer's chunk arrives the text shows as typed (same words, same
 * place), so a note never flashes empty; once it is in, a note shows rendered at once. `look` "page" is the note
 * page's (a larger first heading level, as its editor); `images` "eager" loads the pictures at once (the editor's
 * loading state), not as they come near the screen. `standIn` "blank": nothing but the box (`className`) until the
 * renderer arrives (the editor's loading state, whose chunk often comes first: the raw text, taller than the note,
 * jumped to the editor).
 */
export function NoteBody({
  markdown,
  look,
  images,
  standIn = 'text',
  className,
}: {
  markdown: string;
  look?: 'inline' | 'page';
  images?: 'lazy' | 'eager';
  standIn?: 'text' | 'blank';
  className?: string;
}) {
  // React.lazy showed the stand-in for a moment even with the chunk in; chosen once per note shown
  const [Loaded] = useState(() => loaded?.default);
  if (Loaded) return <Loaded markdown={markdown} look={look} images={images} className={className} />;
  return (
    <Suspense
      fallback={
        standIn === 'blank' ? (
          <div className={className} />
        ) : (
          <p className={cn('text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground', className)}>
            {markdown}
          </p>
        )
      }
    >
      <Rendered markdown={markdown} look={look} images={images} className={className} />
    </Suspense>
  );
}
