'use client';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { noteEditorFrame, type NoteEditorProps } from './note-editor-types';

// The block editor (Milkdown) is its own chunk with its CSS, fetched when a note is first written; Hôm nay never imports
// this file (home First Load JS budget, DECISIONS 10.2).
const Editor = lazy(() => import('./note-editor'));

/**
 * The note editor, loaded on first use. Until its chunk arrives the note's text shows as written, in the frame and
 * size the editor will take, so nothing jumps.
 */
export function NoteEditor(props: NoteEditorProps) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className={cn(noteEditorFrame(props.variant), props.className)}>
          <div
            className={cn(
              'break-words whitespace-pre-wrap text-muted-foreground',
              props.variant === 'page' ? 'min-h-64' : 'min-h-30',
            )}
          >
            {props.defaultMarkdown}
          </div>
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
