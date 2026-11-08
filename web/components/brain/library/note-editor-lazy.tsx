'use client';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { NoteBody } from './note-body';
import { noteEditorFrame, type NoteEditorProps } from './note-editor-types';

// The block editor (Milkdown) is its own chunk with its CSS, fetched when a note is first written; Hôm nay never imports
// this file (home First Load JS budget, DECISIONS 10.2).
const Editor = lazy(() => import('./note-editor'));

/**
 * The note editor, loaded on first use. Until its chunk arrives the note shows as it reads (NoteBody: the blocks the
 * editor draws, at its text size), in the frame the editor will take, so nothing jumps; it cannot be used meanwhile.
 */
export function NoteEditor(props: NoteEditorProps) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" inert className={cn(noteEditorFrame(props.variant), props.className)}>
          <NoteBody
            markdown={props.defaultMarkdown}
            className={cn(
              'text-base sm:text-sm sm:leading-[23px]',
              props.variant === 'page' ? 'min-h-64' : 'min-h-30',
            )}
          />
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
