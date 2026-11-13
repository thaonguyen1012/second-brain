'use client';
import { useEffect, useId, useState } from 'react';
import { toApiError } from '@/lib/api/use-api';
import { errorsByField } from '@/lib/labels';
import type { Msg, T } from '@/lib/i18n/translate';

/** What a field's control takes from `field()`: spread it on Input, Textarea, ChoiceSelect or RadioGroup. */
export interface InvalidFieldProps {
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

interface State {
  /** Each failing field's own message, by the API's field name. */
  fields: Record<string, string>;
  /** Move the focus to the first of them once they are shown (a failed save, not a save on blur). */
  focus: boolean;
}

const NONE: State = { fields: {}, focus: false };

/** The id of a field's hidden error copy. */
const errorId = (uid: string, key: string) => `${uid}-${key}-error`;

/** A control's first focusable part: itself, or (a radio group) the radio that takes the tab stop. */
const FOCUSABLE = 'input:not([type="hidden"]), textarea, select, button, [tabindex]';
function focusTarget(el: HTMLElement): HTMLElement | null {
  if (el.matches(FOCUSABLE) && el.tabIndex >= 0) return el;
  return el.querySelector<HTMLElement>('[tabindex="0"]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
}

/**
 * The fields a form's last failed save was about (DESIGN.md §6 "Form errors"; WCAG 3.3.1, 4.1.2). The form keeps its
 * one summary alert as it is; each field the failure names gets aria-invalid and its own message as its description
 * (aria-describedby after the field's hint, on a hidden copy: `copies`, rendered once inside the form), so the only
 * change on screen is the control's invalid border. A failed save also moves the focus to the first such field on the
 * page. Keys are the API's field names, the keys of a DRF 400 body.
 */
export function useInvalidFields() {
  const uid = useId();
  const [state, setState] = useState<State>(NONE);

  useEffect(() => {
    if (!state.focus) return;
    const controls = Object.keys(state.fields)
      .flatMap((key) => [
        ...document.querySelectorAll<HTMLElement>(`[aria-describedby~="${CSS.escape(errorId(uid, key))}"]`),
      ])
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const target = controls[0] && focusTarget(controls[0]);
    if (target && document.activeElement !== target) target.focus();
  }, [state, uid]);

  return {
    /**
     * A check in the browser failed: marks `keys` (falsy ones skipped) with `message` and answers `message`, for the
     * form's summary: `setError(invalid.mark(t('Cần có tiêu đề.'), 'title'))`.
     */
    mark(message: string, ...keys: (string | false | null | undefined)[]): string {
      setState({ fields: Object.fromEntries(keys.filter((k): k is string => !!k).map((k) => [k, message])), focus: true });
      return message;
    },
    /**
     * A request failed: marks the fields its 400 body names, with their own messages (none for any other failure).
     * `focus: false` for a save the user did not ask for (on blur), which must not pull the focus back.
     */
    fromError(err: unknown, t: T, names?: Record<string, Msg>, { focus = true }: { focus?: boolean } = {}) {
      const e = toApiError(err);
      setState(e.status === 400 ? { fields: errorsByField(e.body, t, names), focus } : NONE);
    },
    /** Before a new save, or when the form goes back to its saved state. */
    clear() {
      setState(NONE);
    },
    /** The control's aria-invalid and aria-describedby: its hint id (if any), then its own error. */
    field(key: string, hint?: string): InvalidFieldProps {
      const props: InvalidFieldProps = {};
      const invalid = Object.hasOwn(state.fields, key);
      if (invalid) props['aria-invalid'] = true;
      const describedBy = [hint, invalid ? errorId(uid, key) : null].filter(Boolean).join(' ');
      if (describedBy) props['aria-describedby'] = describedBy;
      return props;
    },
    /** The hidden copies the descriptions point at; render once inside the form. */
    copies: Object.entries(state.fields).map(([key, text]) => (
      <span key={key} id={errorId(uid, key)} hidden>
        {text}
      </span>
    )),
  };
}
