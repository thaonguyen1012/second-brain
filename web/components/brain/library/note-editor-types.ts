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
