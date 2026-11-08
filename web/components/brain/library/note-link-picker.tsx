'use client';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { SchemaReady, prosePluginsCtx } from '@milkdown/kit/core';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import { closeHistory } from '@milkdown/kit/prose/history';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useEffect, useEffectEvent, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { searchLinkTargets } from '@/lib/api/search';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { linkHref, type LinkKind, type LinkTarget } from '@/lib/note-links';

// The note editor's "[[" picker (DECISIONS 9.8, `[[ ]]`; used by note-editor.tsx, in the editor's chunk).

/* -------------------------------------------------------------------------------------------------------------------
 * The "[[" picker. A small ProseMirror plugin finds "[[query" before the caret (not in code, not across a line break,
 * not starting with a space) and is put first, so its keys win over the list, table and base keymaps. SlashProvider
 * cannot do it (it only looks at the last character, and is debounced). The list lives in an element next to the
 * editor, placed under the caret with floating-ui (absolute: right inside a Sheet's transformed panel, and a press in
 * it is no "outside press" for the Sheet). Escape closes it and keeps the text; "]]", a space right after "[[",
 * moving the caret away or leaving the editor close it too. A pick replaces "[[query" with the record's title
 * carrying a link mark (saved as `[title](href)`), one undo step.
 * ---------------------------------------------------------------------------------------------------------------- */
export interface LinkQuery {
  from: number;
  to: number;
  query: string;
}

interface PickerState {
  match: LinkQuery | null;
  /** Where a "[[" closed with Escape starts; it stays closed while those two brackets exist. */
  dismissedAt: number | null;
}

const MAX_QUERY = 80;
const linkPickerKey = new PluginKey<PickerState>('NOTE_LINK_PICKER');

function findLinkQuery(state: EditorState): LinkQuery | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  const $caret = selection.$from;
  const block = $caret.parent;
  if (!block.isTextblock || block.type.spec.code) return null;
  const start = Math.max(0, $caret.parentOffset - MAX_QUERY - 2);
  // an inline node (hard break, image) counts as one character, so string offsets stay document offsets
  const before = block.textBetween(start, $caret.parentOffset, undefined, '￼');
  const at = before.lastIndexOf('[[');
  if (at < 0) return null;
  const query = before.slice(at + 2);
  if (query.includes(']]') || query.includes('￼') || /^\s/.test(query)) return null;
  const from = $caret.start() + start + at;
  let inCode = false;
  state.doc.nodesBetween(from, $caret.pos, (node) => {
    if (node.marks.some((mark) => mark.type.spec.code)) inCode = true;
  });
  return inCode ? null : { from, to: $caret.pos, query };
}

function hasBrackets(state: EditorState, pos: number): boolean {
  return pos + 2 <= state.doc.content.size && state.doc.textBetween(pos, pos + 2) === '[[';
}

function nextPickerState(tr: Transaction, prev: PickerState, state: EditorState): PickerState {
  const dismiss = tr.getMeta(linkPickerKey) === 'dismiss';
  if (!tr.docChanged && !tr.selectionSet && !dismiss) return prev;
  let dismissedAt = prev.dismissedAt;
  if (dismissedAt !== null && tr.docChanged) {
    const mapped = tr.mapping.mapResult(dismissedAt);
    dismissedAt = mapped.deleted ? null : mapped.pos;
  }
  const found = findLinkQuery(state);
  if (dismiss && found) dismissedAt = found.from;
  if (dismissedAt !== null && !hasBrackets(state, dismissedAt)) dismissedAt = null;
  return { match: found && found.from !== dismissedAt ? found : null, dismissedAt };
}

const sameQuery = (a: LinkQuery | null, b: LinkQuery | null) =>
  a === b || (!!a && !!b && a.from === b.from && a.to === b.to && a.query === b.query);

type KeyHandler = (event: KeyboardEvent) => boolean;

/** One per editor: the Milkdown plugin, the element the list renders into, and the open query for React. */
export class LinkPicker {
  readonly listId: string;
  readonly element: HTMLDivElement;
  private view: EditorView | null = null;
  private open: LinkQuery | null = null;
  private keyHandler: KeyHandler | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(base: string) {
    this.listId = `${base}-links`;
    const el = document.createElement('div');
    el.className = 'note-popover';
    el.dataset.show = 'false';
    Object.assign(el.style, { left: '0', top: '0', visibility: 'hidden' });
    this.element = el;
  }

  /** The Milkdown plugin: it puts its ProseMirror plugin first, wherever it is `.use()`d. */
  readonly plugin: MilkdownPlugin = (ctx) => async () => {
    await ctx.wait(SchemaReady);
    const prose = this.createPlugin();
    ctx.update(prosePluginsCtx, (plugins) => [prose, ...plugins]);
    return () => ctx.update(prosePluginsCtx, (plugins) => plugins.filter((p) => p !== prose));
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The open query, or null while closed (also while the editor does not have the focus). */
  getSnapshot = (): LinkQuery | null => this.open;

  /** The list takes ArrowUp, ArrowDown and Enter (no modifiers) while open; true when it used the key. */
  setKeyHandler = (handler: KeyHandler | null): (() => void) => {
    this.keyHandler = handler;
    return () => {
      if (this.keyHandler === handler) this.keyHandler = null;
    };
  };

  /** The active option, for the editor's aria-activedescendant. */
  setActive = (id: string | null) => {
    if (id && this.open) this.view?.dom.setAttribute('aria-activedescendant', id);
    else this.view?.dom.removeAttribute('aria-activedescendant');
  };

  /** Replaces "[[query" with `label` linked to `href`, as its own undo step. */
  choose = (label: string, href: string): boolean => {
    const view = this.view;
    const match = view ? linkPickerKey.getState(view.state)?.match : null;
    if (!view || !match) return false;
    const { state } = view;
    const link = state.schema.marks.link;
    if (!link) return false;
    // the marks the "[[" was typed in (bold, italic) stay, the link joins them
    const marks = state.doc.nodeAt(match.from)?.marks ?? [];
    const tr = state.tr.replaceWith(match.from, match.to, state.schema.text(label, link.create({ href }).addToSet(marks)));
    tr.setSelection(TextSelection.create(tr.doc, match.from + label.length));
    // the link mark is inclusive: without this, the next typed character would join the link
    tr.setStoredMarks(link.removeFromSet(marks));
    view.dispatch(closeHistory(tr).scrollIntoView()); // its own undo step, even right after typing the query
    view.dispatch(closeHistory(view.state.tr)); // typing right after the link starts the next undo step
    view.focus();
    return true;
  };

  /** Closes like Escape: the typed text stays and this "[[" does not open again. */
  dismiss = (): void => {
    const view = this.view;
    if (view && linkPickerKey.getState(view.state)?.match) view.dispatch(view.state.tr.setMeta(linkPickerKey, 'dismiss'));
  };

  /** Places the element under the caret (above when there is no room below). The list calls it after it renders. */
  updatePosition = (): void => {
    const { view, open, element: el } = this;
    if (!view || !open) return;
    const caret = {
      getBoundingClientRect: () => {
        const c = view.coordsAtPos(Math.min(open.to, view.state.doc.content.size));
        return {
          x: c.left,
          y: c.top,
          left: c.left,
          top: c.top,
          right: c.left,
          bottom: c.bottom,
          width: 0,
          height: c.bottom - c.top,
        };
      },
    };
    void computePosition(caret, el, {
      placement: 'bottom-start',
      middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      if (this.open !== open) return; // a newer position is on its way, or the picker closed
      Object.assign(el.style, { left: `${x}px`, top: `${y}px`, visibility: 'visible' });
      el.dataset.show = 'true';
    });
  };

  private createPlugin(): Plugin<PickerState> {
    return new Plugin<PickerState>({
      key: linkPickerKey,
      state: {
        init: (_config, state) => ({ match: findLinkQuery(state), dismissedAt: null }),
        apply: (tr, prev, _old, state) => nextPickerState(tr, prev, state),
      },
      view: (view) => {
        this.sync(view);
        return {
          update: (v) => this.sync(v),
          destroy: () => {
            if (this.view !== view) return;
            this.view = null;
            this.publish(null);
            this.element.remove();
          },
        };
      },
      props: {
        handleKeyDown: (_view, event) => this.handleKey(event),
        handleDOMEvents: {
          focus: (view) => {
            this.sync(view);
            return false;
          },
          blur: (view) => {
            this.sync(view);
            return false;
          },
        },
      },
    });
  }

  private handleKey(event: KeyboardEvent): boolean {
    if (!this.open || event.isComposing) return false;
    if (event.key === 'Escape') {
      event.stopPropagation(); // a Sheet, or the note's own "Escape ends the edit", must not take this Escape too
      this.dismiss();
      return true;
    }
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
    if (plain && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter'))
      return this.keyHandler?.(event) ?? false;
    return false;
  }

  private sync(view: EditorView): void {
    this.view = view;
    const match = linkPickerKey.getState(view.state)?.match ?? null;
    const next = match && view.editable && view.hasFocus() ? match : null;
    this.publish(next);
    if (!next) return;
    const parent = view.dom.parentElement;
    if (parent && this.element.parentElement !== parent) parent.appendChild(this.element);
    this.updatePosition();
  }

  private publish(next: LinkQuery | null): void {
    if (!next) {
      this.element.dataset.show = 'false';
      this.element.style.visibility = 'hidden';
      this.view?.dom.removeAttribute('aria-activedescendant');
    }
    if (sameQuery(this.open, next)) return;
    this.open = next;
    this.listeners.forEach((listener) => listener());
  }
}

const KIND_ORDER: LinkKind[] = ['item', 'note', 'opportunity', 'skill'];
const KIND_LABELS: Record<LinkKind, Msg> = {
  item: msg('Item'),
  note: msg('Ghi chú'),
  opportunity: msg('Cơ hội'),
  skill: msg('Kỹ năng'),
};
const SEARCH_DELAY_MS = 150;

type Found = { query: string } & ({ state: 'loading' } | { state: 'done'; targets: LinkTarget[] } | { state: 'error' });

/** The picker's list: what the ?q= searches answer for the query, grouped by kind, in `picker.element` (a portal). */
export function LinkPickerList({ picker, selfNoteId }: { picker: LinkPicker; selfNoteId?: number }) {
  const t = useT();
  const open = useSyncExternalStore(picker.subscribe, picker.getSnapshot, () => null);
  const query = open?.query.trim() ?? null;
  const [found, setFound] = useState<Found | null>(null);
  // the highlight belongs to one query: a new query starts at the first entry again
  const [highlight, setHighlight] = useState({ key: '', index: 0 });

  useEffect(() => {
    if (query === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setFound({ query, state: 'loading' });
      searchLinkTargets(query, 5, controller.signal, selfNoteId).then(
        (targets) => setFound({ query, state: 'done', targets }),
        () => {
          if (!controller.signal.aborted) setFound({ query, state: 'error' });
        },
      );
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selfNoteId]);

  const targets = found && found.query === query && found.state === 'done' ? found.targets : [];
  const ordered = KIND_ORDER.flatMap((kind) => targets.filter((target) => target.kind === kind));
  const key = open ? `${open.from}:${query}` : '';
  const active = highlight.key === key ? Math.min(highlight.index, ordered.length - 1) : 0;
  const optionId = (target: LinkTarget) => `${picker.listId}-${target.kind}-${target.id}`;
  const titleOf = (target: LinkTarget) => target.title.trim() || t('Không có tiêu đề');

  const onKey = useEffectEvent((event: KeyboardEvent): boolean => {
    const target = ordered[active];
    if (!target) return false; // nothing to choose: the key does what it does in the editor
    if (event.key === 'Enter') return picker.choose(titleOf(target), linkHref(target.kind, target.id));
    const step = event.key === 'ArrowDown' ? 1 : -1;
    setHighlight({ key, index: (active + step + ordered.length) % ordered.length });
    return true;
  });
  useEffect(() => picker.setKeyHandler((event) => onKey(event)), [picker]);
  const activeTarget = ordered[active];
  useLayoutEffect(() => {
    if (open) picker.updatePosition();
    picker.setActive(open && activeTarget ? optionId(activeTarget) : null);
  });

  if (!open) return null;
  const waiting = !found || found.query !== query || found.state === 'loading';
  const failed = found?.query === query && found.state === 'error';
  return createPortal(
    <div
      role="listbox"
      id={picker.listId}
      aria-label={t('Liên kết tới')}
      aria-busy={waiting || undefined}
      className="note-popover-list"
      // the caret stays in the editor: a press on the list must not move the focus
      onMouseDown={(event) => event.preventDefault()}
    >
      {ordered.length === 0 ? (
        <div className="note-popover-empty" role="presentation">
          {waiting
            ? t('Đang tìm…')
            : failed
              ? t('Chưa tìm được, thử lại sau.')
              : query
                ? t('Không tìm thấy “{query}”', { query })
                : t('Gõ để tìm item, ghi chú, cơ hội, kỹ năng')}
        </div>
      ) : (
        KIND_ORDER.map((kind) => {
          const rows = ordered.filter((target) => target.kind === kind);
          if (rows.length === 0) return null;
          const headingId = `${picker.listId}-${kind}`;
          return (
            <div key={kind} role="group" aria-labelledby={headingId} className="note-popover-group">
              <div id={headingId} role="presentation" className="note-popover-heading">
                {t(KIND_LABELS[kind])}
              </div>
              {rows.map((target) => {
                const index = ordered.indexOf(target);
                return (
                  <div
                    key={`${target.kind}-${target.id}`}
                    id={optionId(target)}
                    role="option"
                    aria-selected={index === active}
                    className="note-popover-option"
                    onMouseMove={() => {
                      if (index !== active) setHighlight({ key, index });
                    }}
                    onClick={() => picker.choose(titleOf(target), linkHref(target.kind, target.id))}
                  >
                    <span>{titleOf(target)}</span>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>,
    picker.element,
  );
}

