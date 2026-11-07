'use client';
import { useLayoutEffect, type Ref } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// The one place a note's markdown is typed on the Item page (DECISIONS 9.8, until the owner picks the block editor):
// an autosized textarea. The editor that comes later replaces this component with the same props (markdown in, markdown
// out, save and cancel keys), so the forms around it stay as they are.

/** Whether the browser grows a textarea with its text by itself (CSS field-sizing; Chrome yes, Safari and Firefox not
 * everywhere yet). */
const fieldSizing = () => typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

export function NoteTextEditor({
  id,
  value,
  onChange,
  label,
  placeholder,
  onSave,
  onCancel,
  textareaRef,
  describedBy,
  disabled,
  className,
}: {
  id: string;
  value: string;
  onChange: (markdown: string) => void;
  /** The textarea's accessible name. */
  label: string;
  placeholder?: string;
  /** Cmd/Ctrl+Enter. */
  onSave: () => void;
  /** Escape (the caller asks before dropping changes). */
  onCancel: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}) {
  // Without field-sizing the height follows the text here: reset, then take the content's height (no inner scroll).
  useLayoutEffect(() => {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLTextAreaElement) || fieldSizing()) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [id, value]);

  return (
    <Textarea
      id={id}
      ref={textareaRef}
      data-note-editor=""
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      aria-describedby={describedBy}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck
      className={cn('[&_textarea]:min-h-32 [&_textarea]:resize-none [&_textarea]:leading-relaxed', className)}
      onKeyDown={(e) => {
        // handled here only: the form around it listens for the same keys from its other fields
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          onSave();
        } else if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
          // handled here: the Sheet around the page must not close on the same key
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}
