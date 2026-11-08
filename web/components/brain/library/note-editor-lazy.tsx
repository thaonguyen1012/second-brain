'use client';
import { lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';
import { NoteBody } from './note-body';
import { noteEditorFrame, type NoteEditorProps } from './note-editor-types';

// The block editor (Milkdown) is its own chunk with its CSS, fetched when a note is first written; Hôm nay never imports
// this file (home First Load JS budget, DECISIONS 10.2).
const Editor = lazy(() => import('./note-editor'));

/**
 * The note editor, loaded on first use. Until its chunk arrives the note shows as it reads (NoteBody: each block at the
 * editor's size and spacing, the editor's text size and height, its pictures loaded at once as the editor's are), in
 * the frame the editor will take, so nothing jumps; it cannot be used meanwhile.
 */
export function NoteEditor(props: NoteEditorProps) {
  const page = props.variant === 'page';
  return (
    <Suspense
      fallback={
        <div aria-busy="true" inert className={cn(noteEditorFrame(props.variant), props.className)}>
          <NoteBody
            markdown={props.defaultMarkdown}
            look={page ? 'page' : 'inline'}
            images="eager"
            // the frame's text size and line height again (NoteMarkdown sets its own), the editor's least height
            className={cn('text-base leading-relaxed sm:text-sm sm:leading-[23px]', page ? 'min-h-64' : 'min-h-30')}
          />
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
