// The props of NoteEditor (note-editor.tsx, Milkdown) and its frame, apart from the editor itself so that pages and
// the loading placeholder (note-editor-lazy.tsx) can use them without pulling the editor's chunk in.

export interface NoteEditorProps {
  /** The editable's id (labels, focus). */
  id: string;
  /** The markdown it opens with; later changes come from the user only (remount with a new `key` to replace it). */
  defaultMarkdown: string;
  /** Every change, as markdown (the autosave waits for a pause itself). */
  onChange: (markdown: string) => void;
  /** The editable's accessible name. */
  label: string;
  /** Shown in an empty note, and in the empty line holding the caret. */
  placeholder?: string;
  /** > 0 puts the cursor in the text once the editor is ready; each new value does it again (at the end). */
  focusRequest?: number;
  /** Where the first focus puts the cursor: the end, or a template's first blank line. */
  caret?: 'end' | 'first-empty';
  /** Escape with no menu open (ends an inline edit). */
  onEscape?: () => void;
  /** Cmd/Ctrl+Enter outside a task and code (saves now; ends an inline edit). */
  onSubmit?: () => void;
  /** Called at every change of the text, before the (debounced) `onChange`: the page can show "Đang lưu…" at once. */
  onInput?: () => void;
  /** The editor once it is ready (null when it goes): reads its markdown now, without waiting for `onChange`. */
  onReady?: (handle: NoteEditorHandle | null) => void;
  /** The note being edited, left out of the "[[" picker. */
  selfNoteId?: number;
  /** The look: inline (a field-like box on the Item page) or page (the note page, no box). */
  variant?: 'inline' | 'page';
  className?: string;
}

/** Keys typed while the editor was fetched and made, kept by its loading state (note-editor-lazy.tsx). */
export interface EarlyInput {
  /**
   * Hands what was typed to `take` (at once, or when an IME is done composing a word) and stops keeping keys; `focused`:
   * the keys were still kept when the editor got ready (the focus is there, nothing else took it).
   */
  handOff: (take: (typed: { text: string; focused: boolean }) => void) => void;
}

/** The editor itself (note-editor.tsx): the props pages give, and what its loading state kept. */
export interface NoteEditorInnerProps extends NoteEditorProps {
  early?: EarlyInput['handOff'];
}

/** The user is typing in a field (the title, the Item picker, another editor): the focus is never taken from it. */
export function typingElsewhere(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLElement && (active.isContentEditable || active.matches('input, textarea, select'));
}

/**
 * Whether a ready editor asked for the focus may take it: nothing holds it but the page, a dialog (the Sheet) or a
 * place the focus waits on (tabIndex -1, as the notes' heading while an editor opens); never a field, a link, a button
 * or a menu the user went to, and never another editor.
 */
export function focusIsFree(): boolean {
  const active = document.activeElement;
  if (!active || active === document.body || active.getAttribute('role') === 'dialog') return true;
  return (
    active instanceof HTMLElement &&
    active.tabIndex === -1 &&
    !active.isContentEditable &&
    !active.matches('a[href], button, input, textarea, select, [role]')
  );
}

export interface NoteEditorHandle {
  /** The text as markdown now, or null while it is as it was opened (never re-saved just for being opened). */
  markdown: () => string | null;
}

/** The editor's frame: the Textarea's box inline (components/ui/textarea.tsx), bare on the note page. */
export function noteEditorFrame(variant: 'inline' | 'page' = 'inline'): string {
  return variant === 'page'
    ? 'text-base leading-relaxed sm:text-sm sm:leading-[23px]'
    : 'rounded-lg border border-input bg-popover px-3 py-2 text-base leading-relaxed transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring sm:text-sm sm:leading-[23px] dark:bg-input/30 dark:focus-within:border-foreground/70 dark:focus-within:ring-foreground/15';
}
