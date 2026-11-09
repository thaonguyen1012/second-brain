'use client';
import { lazy, Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { NoteBody, preloadNoteBody } from './note-body';
import { noteEditorFrame, typingElsewhere, type EarlyInput, type NoteEditorProps } from './note-editor-types';

// The block editor (Milkdown) is its own chunk with its CSS; Hôm nay never imports this file (home First Load JS budget,
// DECISIONS 10.2). The pages that import it can open an editor (the Item page and its Sheet, the notes pages): they
// fetch the chunk, and the reading view's that its loading state shows, once they are idle, so the first editor of a
// visit is made at once like the next ones (React.lazy showed its loading state for 300 ms even with the chunk cached).
let loaded: typeof import('./note-editor') | undefined;
const load = () => import('./note-editor').then((module) => (loaded = module));
const LazyEditor = lazy(load);

if (typeof window !== 'undefined') {
  const preload = () => {
    preloadNoteBody();
    load().catch(() => {}); // offline: the editor's first use asks again
  };
  // after the page's own load (a script added before it holds the load event back), when the browser is idle
  const idle = () =>
    'requestIdleCallback' in window ? window.requestIdleCallback(preload, { timeout: 3000 }) : setTimeout(preload, 500);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
}

/**
 * Keys typed while the editor is fetched and made. Asked for the focus (a new note, "Viết ghi chú", the pencil), the
 * editor's place takes it at once (from the page, the Sheet, the heading the focus waits on or the button that asked;
 * never from a field being typed in), in a field that keeps what is typed as typed (an IME composes there, Backspace
 * and Enter work), under the editor's id (the title's Enter and the Item dialog's closing focus find it); the editor
 * takes the text and the focus when it is ready (note-editor.tsx). A click elsewhere meanwhile (the title) leaves the
 * field: what was typed before still goes into the note, and the focus stays where the user put it.
 */
function useEarlyKeys(focusRequest: number, id: string, label: string) {
  const field = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [keeping, setKeeping] = useState(focusRequest > 0);
  const [handedOff, setHandedOff] = useState(false);
  // asked again before the editor is ready (the done hint's "Viết ghi chú" on a composer shown without the focus);
  // once it is ready, it answers each new request itself
  const [asked, setAsked] = useState(focusRequest);
  if (focusRequest !== asked) {
    setAsked(focusRequest);
    if (focusRequest > asked && !handedOff) setKeeping(true);
  }
  useLayoutEffect(() => {
    // before the browser paints the new editor's place, so no key typed after the click that opened it is lost
    if (keeping && !typingElsewhere()) field.current?.focus({ preventScroll: true });
  }, [keeping, asked]);
  const handOff = useCallback<EarlyInput['handOff']>((take) => {
    const give = () => {
      const el = field.current;
      take({ text: el?.value ?? '', focused: el !== null && document.activeElement === el });
      setKeeping(false);
      setHandedOff(true);
    };
    // a word an IME is still composing is typed whole: the field gives it up once it is done
    if (field.current && composing.current)
      field.current.addEventListener('compositionend', () => setTimeout(give), { once: true });
    else give();
  }, []);
  const element = keeping && (
    // out of the flow (no gap in the page's column), 16px so a phone does not zoom in on it
    // the editor's own element comes first in the page, so the id finds it once it is there
    <textarea
      ref={field}
      id={id}
      tabIndex={-1}
      aria-label={label}
      autoComplete="off"
      className="sr-only text-base"
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
      }}
    />
  );
  return { handOff, element };
}

/**
 * The note editor, loaded on first use. Until its chunk arrives the note shows as it reads (NoteBody: each block at the
 * editor's size and spacing, the editor's text size and height, its pictures loaded at once as the editor's are), in
 * the frame the editor will take, so nothing jumps; it cannot be clicked into meanwhile, and keys typed are kept.
 */
export function NoteEditor(props: NoteEditorProps) {
  const t = useT();
  const page = props.variant === 'page';
  // the editor's module once fetched (a page's preload, an earlier editor): made at once, without the loading state;
  // chosen once, so an editor in use is never made again when the module arrives
  const [Loaded] = useState(() => loaded?.default);
  const early = useEarlyKeys(props.focusRequest ?? 0, props.id, t('Đang mở trình soạn thảo'));
  return (
    <>
      {Loaded ? (
        <Loaded {...props} early={early.handOff} />
      ) : (
        <Suspense
          fallback={
            <div aria-busy="true" inert className={cn(noteEditorFrame(props.variant), props.className)}>
              <NoteBody
                markdown={props.defaultMarkdown}
                look={page ? 'page' : 'inline'}
                images="eager"
                standIn="blank"
                // the frame's text size and line height again (NoteMarkdown sets its own), the editor's least height
                className={cn('text-base leading-relaxed sm:text-sm sm:leading-[23px]', page ? 'min-h-64' : 'min-h-30')}
              />
            </div>
          }
        >
          <LazyEditor {...props} early={early.handOff} />
        </Suspense>
      )}
      {early.element}
    </>
  );
}
