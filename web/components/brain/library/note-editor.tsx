'use client';
import './note-editor.css';
import { shift } from '@floating-ui/dom';
import {
  Editor,
  EditorStatus,
  commandsCtx,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  rootAttrsCtx,
  rootCtx,
  schemaCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { gapCursorPlugin } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { SlashProvider, slashFactory } from '@milkdown/kit/plugin/slash';
import { trailing, trailingConfig } from '@milkdown/kit/plugin/trailing';
import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  commonmark,
  createCodeBlockCommand,
  hardbreakSchema,
  hrSchema,
  imageSchema,
  insertHrCommand,
  insertHrInputRule,
  linkSchema,
  listItemSchema,
  paragraphSchema,
  splitListItemCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { gfm, insertTableCommand, tableSchema } from '@milkdown/kit/preset/gfm';
import { customInputRulesKey, isTextOnlySlice } from '@milkdown/kit/prose';
import { lift } from '@milkdown/kit/prose/commands';
import { closeHistory } from '@milkdown/kit/prose/history';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import { liftListItem } from '@milkdown/kit/prose/schema-list';
import { DOMParser, DOMSerializer, Fragment, Slice, type NodeType } from '@milkdown/kit/prose/model';
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type PluginSpec,
  type Transaction,
} from '@milkdown/kit/prose/state';
import { Transform, canJoin, findWrapping } from '@milkdown/kit/prose/transform';
import { Decoration, DecorationSet, type EditorView, type NodeViewConstructor } from '@milkdown/kit/prose/view';
import {
  $command,
  $inputRule,
  $prose,
  $useKeymap,
  $view,
  callCommand,
  getMarkdown,
  type $Command,
} from '@milkdown/kit/utils';
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@/lib/i18n/client';
import { noteImageSrc } from '@/lib/item-notes';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { noteEditorFrame, type NoteEditorHandle, type NoteEditorProps } from './note-editor-types';
import { LinkPicker, LinkPickerList } from './note-link-picker';

// The note editor (DECISIONS 9.8, PROMPT-item-notes step 4): Milkdown 7.23 (commonmark + gfm + listener + history),
// markdown in and markdown out, so a note stays one markdown text (4.1, 4.7). Bullets are saved as `-`; Milkdown's
// empty-line plugin stays on, so an empty list item is saved as `- <br />` (lib/item-notes.ts and the renderer read it
// back as an empty line). On top of the presets:
// - "/" opens a block menu (headings, lists, tasks, quote, code, divider, table), labels in the UI language;
// - `#`, `-`, `1.`, `>` and "```" turn a line into that block as they are typed (the presets), `[]` into a task;
// - a task's box ticks with the mouse or Cmd/Ctrl+Enter; Enter after a ticked task starts an unticked one;
// - "[[" opens a picker over Items, notes, opportunities and skills (the ?q= searches, lib/api/search.ts); a pick
//   writes a readable link to the record's page, `[Atomic Habits](/thu-vien/item/?id=12)` (lib/note-links.ts), which
//   the backend reads into the note's links on save (backend/library/links.py).
// The editor is its own chunk (note-editor-lazy.tsx) with its CSS; Hôm nay never loads it.

/* -------------------------------------------------------------------------------------------------------------------
 * Placeholder: a node decoration (class + data-placeholder) on the empty paragraph, drawn by CSS (::before); no widget,
 * so nothing is inserted next to text an IME is composing. The whole note empty: always; otherwise the empty top-level
 * paragraph holding the caret (only while the editor has focus, see the CSS).
 * ---------------------------------------------------------------------------------------------------------------- */
function placeholderPlugin(text: string) {
  return $prose(
    () =>
      new Plugin({
        key: new PluginKey('NOTE_PLACEHOLDER'),
        props: {
          decorations: (state) => {
            const { doc, selection } = state;
            const only = doc.childCount === 1 ? doc.firstChild : null;
            if (only && only.type.name === 'paragraph' && only.content.size === 0)
              return DecorationSet.create(doc, [
                Decoration.node(0, only.nodeSize, { class: 'is-empty', 'data-placeholder': text }),
              ]);
            const { $from, empty } = selection;
            const block = $from.parent;
            if (!empty || $from.depth !== 1 || block.type.name !== 'paragraph' || block.content.size > 0) return null;
            const pos = $from.before();
            return DecorationSet.create(doc, [
              Decoration.node(pos, pos + block.nodeSize, { class: 'is-empty is-current', 'data-placeholder': text }),
            ]);
          },
        },
      }),
  );
}

/* -------------------------------------------------------------------------------------------------------------------
 * Tasks from markdown habits. GFM's own rule only works inside a list item ('- ' then '[ ] '); this one also takes
 * '[] ', '[ ] ' and '[x] ' at the start of any paragraph: inside a list item it makes that item a task, elsewhere it
 * wraps the paragraph in a bullet list with one task (joined to a bullet list right above, like the '- ' rule).
 * ---------------------------------------------------------------------------------------------------------------- */
function turnIntoTask(tr: Transaction, pos: number, checked: boolean, ctx: Ctx): Transaction | null {
  const $pos = tr.doc.resolve(pos);
  const listItem = listItemSchema.type(ctx);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type !== listItem) continue;
    if (node.attrs.checked != null) return null;
    return tr.setNodeMarkup($pos.before(depth), undefined, { ...node.attrs, checked });
  }
  const bulletList = bulletListSchema.type(ctx);
  const range = $pos.blockRange();
  const wrapping = range && findWrapping(range, bulletList);
  if (!range || !wrapping) return null;
  const item = wrapping[wrapping.length - 1]; // [bullet_list, list_item]
  wrapping[wrapping.length - 1] = { type: item.type, attrs: { ...item.attrs, checked } };
  tr.wrap(range, wrapping);
  const before = tr.doc.resolve(range.start).nodeBefore;
  if (before?.type === bulletList && canJoin(tr.doc, range.start)) tr.join(range.start);
  return tr;
}

const taskInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^\[(\s|x|X)?\]\s$/, (state, match, start, end) =>
      state.doc.resolve(start).parent.type.name === 'paragraph'
        ? turnIntoTask(state.tr.delete(start, end), start, /x/i.test(match[1] ?? ''), ctx)
        : null,
    ),
);

/** The "/" menu's "Việc cần làm" (7.23 has no task list command). */
const wrapInTaskListCommand = $command('WrapInTaskList', (ctx) => () => (state, dispatch) => {
  const tr = turnIntoTask(state.tr, state.selection.from, false, ctx);
  if (!tr) return false;
  dispatch?.(tr.scrollIntoView());
  return true;
});

/** "```" or "```lang" then Enter opens a code block (the preset's rule wants a space after the fence). */
const codeFenceKeymap = $useKeymap('noteCodeFence', {
  CodeFenceOnEnter: {
    shortcuts: 'Enter',
    priority: 100,
    command: (ctx) => (state, dispatch) => {
      const { $from, empty } = state.selection;
      const block = $from.parent;
      if (!empty || block.type.name !== 'paragraph' || $from.parentOffset !== block.content.size) return false;
      const fence = /^```([\w+#.-]*)$/.exec(block.textContent);
      const codeBlock = codeBlockSchema.type(ctx);
      if (!fence || !$from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), codeBlock)) return false;
      const start = $from.start();
      dispatch?.(
        state.tr.delete(start, $from.pos).setBlockType(start, start, codeBlock, { language: fence[1] }).scrollIntoView(),
      );
      return true;
    },
  },
});

/** '---', '___ ', '*** ': the rule, then the caret in a paragraph below it. The preset's rule (filtered out below) left
 *  the rule selected at the end of a note, so the next key typed replaced it. */
const hrInputRule = $inputRule(
  (ctx) =>
    new InputRule(/^(?:---|___\s|\*\*\*\s)$/, (state, _match, start, end) => {
      const $start = state.doc.resolve(start);
      if ($start.parent.type !== paragraphSchema.type(ctx)) return null;
      const rest = $start.parent.content.cut(end - $start.start());
      const nodes = [hrSchema.type(ctx).create(), paragraphSchema.type(ctx).create(null, rest)];
      if (!$start.node(-1).canReplace($start.index(-1), $start.indexAfter(-1), Fragment.from(nodes))) return null;
      const from = $start.before();
      const tr = state.tr.replaceWith(from, $start.after(), nodes);
      return tr.setSelection(TextSelection.create(tr.doc, from + nodes[0].nodeSize + 1)).scrollIntoView();
    }),
);

/** What Milkdown's input-rule plugin keeps for undo; `text` is '\n' when Enter fired the rule ('```' Enter). */
interface UndoableRule {
  transform: Transform;
  text: string;
}

/** Backspace right after a rule fired by Enter undoes it without putting the Enter back as a '\n' in the paragraph
 *  (prosemirror's undoInputRule does): '```' + '\n' was saved as an open code fence that turned the rest of the note
 *  into code on the next load. */
const undoEnterRule: Command = (state, dispatch) => {
  const undoable = customInputRulesKey.getState(state) as UndoableRule | null | undefined;
  if (!undoable || undoable.text !== '\n') return false;
  if (dispatch) {
    const tr = state.tr;
    const { steps, docs } = undoable.transform;
    for (let i = steps.length - 1; i >= 0; i--) tr.step(steps[i].invert(docs[i]));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Backspace at the start of a note: an empty code block becomes a paragraph, the first paragraph of a quote leaves
 *  the quote (Milkdown's Backspace only joins textblocks, so with nothing before them they never went away). */
const backspaceAtNoteStart =
  (ctx: Ctx): Command =>
  (state, dispatch) => {
    const { selection } = state;
    const { $from } = selection;
    if (!(selection instanceof TextSelection) || !selection.empty || $from.parentOffset !== 0) return false;
    if (Selection.findFrom(state.doc.resolve($from.before()), -1, true)) return false; // a textblock before: joined
    if ($from.parent.type === codeBlockSchema.type(ctx)) {
      if ($from.parent.content.size > 0) return false;
      if (dispatch) {
        const paragraph = paragraphSchema.type(ctx);
        const tr = state.tr.setNodeMarkup($from.before(), paragraph);
        // the empty paragraph kept after a last code block (trailing) is not needed now; two would save a '<br />'
        const next = tr.doc.resolve($from.after());
        if (
          next.nodeAfter?.type === paragraph &&
          next.nodeAfter.content.size === 0 &&
          next.index() === tr.doc.childCount - 1
        )
          tr.delete(next.pos, next.pos + next.nodeAfter.nodeSize);
        dispatch(tr);
      }
      return true;
    }
    if ($from.depth >= 2 && $from.node(-1).type === blockquoteSchema.type(ctx) && $from.index(-1) === 0)
      return lift(state, dispatch);
    return false;
  };

/** ArrowUp on the first line, or ArrowLeft at the very start, of a code block that opens the note: a paragraph above it
 *  (there was no way to write above it; tables and rules get a gap cursor instead). */
const paragraphAboveCode =
  (key: 'up' | 'left') =>
  (ctx: Ctx): Command =>
  (state, dispatch, view) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.depth !== 1 || $from.index(0) !== 0 || $from.parent.type !== codeBlockSchema.type(ctx))
      return false;
    if (key === 'left' ? $from.parentOffset !== 0 : !view?.endOfTextblock('up')) return false;
    if (dispatch) {
      const tr = state.tr.insert(0, paragraphSchema.type(ctx).create());
      dispatch(tr.setSelection(TextSelection.create(tr.doc, 1)).scrollIntoView());
    }
    return true;
  };

// One command per key in a keymap: the two Backspace commands live in two keymaps.
const undoEnterRuleKeymap = $useKeymap('noteUndoEnterRule', {
  UndoEnterRule: { shortcuts: 'Backspace', priority: 60, command: () => undoEnterRule },
});
const noteStartKeymap = $useKeymap('noteStart', {
  BackspaceAtNoteStart: { shortcuts: 'Backspace', priority: 55, command: backspaceAtNoteStart },
  ParagraphAboveCodeUp: { shortcuts: 'ArrowUp', command: paragraphAboveCode('up') },
  ParagraphAboveCodeLeft: { shortcuts: 'ArrowLeft', command: paragraphAboveCode('left') },
});

/** Plain text pasted (no HTML) is read as markdown, so '- [ ] a' and '## b' become blocks, and each line break stays a
 *  line break (markdown joins a paragraph's lines, so lines pasted from a chat or an email ran together). HTML and
 *  text pasted into code go on as before (Milkdown's clipboard plugin, used after this one). */
const pasteTextAsMarkdown = $prose(
  (ctx) =>
    new Plugin({
      key: new PluginKey('NOTE_PASTE_TEXT'),
      props: {
        handlePaste: (view, event) => {
          const data = event.clipboardData;
          if (!data || !view.editable || data.getData('text/html') || data.getData('vscode-editor-data')) return false;
          const text = data.getData('text/plain');
          if (!text || view.state.selection.$from.parent.type.spec.code) return false;
          const doc = ctx.get(parserCtx)(text);
          if (!doc || typeof doc === 'string') return false;
          const hardbreak = hardbreakSchema.type(ctx);
          const lines = new Transform(doc);
          doc.descendants((node, pos) => {
            if (node.type === hardbreak && node.attrs.isInline) lines.setNodeMarkup(pos, undefined, { isInline: false });
          });
          const schema = ctx.get(schemaCtx);
          const only = lines.doc.childCount === 1 ? lines.doc.firstChild : null;
          if (!text.trim().includes('\n')) {
            if (only?.type === paragraphSchema.type(ctx)) {
              // one line of text: its inline content, with the spaces around it that markdown trims
              const [lead, trail] = [/^\s*/.exec(text)![0], /\s*$/.exec(text)![0]];
              let inline = only.content;
              if (lead) inline = Fragment.from(schema.text(lead)).append(inline);
              if (trail) inline = inline.append(Fragment.from(schema.text(trail)));
              view.dispatch(view.state.tr.replaceSelection(new Slice(inline, 0, 0)).scrollIntoView());
              return true;
            }
            // one line of block syntax ('## a', '- [ ] a') inside a line of text stays as typed: a block only starts
            // a line
            if (view.state.selection.$from.parent.content.size > 0) {
              view.dispatch(view.state.tr.insertText(text).scrollIntoView());
              return true;
            }
          }
          // as the clipboard plugin does: through the DOM, for a slice that joins the text around the caret
          const slice = DOMParser.fromSchema(schema).parseSlice(
            DOMSerializer.fromSchema(schema).serializeFragment(lines.doc.content),
          );
          const node = isTextOnlySlice(slice);
          view.dispatch(
            (node ? view.state.tr.replaceSelectionWith(node, true) : view.state.tr.replaceSelection(slice)).scrollIntoView(),
          );
          return true;
        },
      },
    }),
);

/** Images: only the ones the reading view shows load (the app's own files, noteImageSrc); any other image (pasted
 *  from a web page, ![](https://...), an /api/ address) shows as text, so the editor never asks another site or the
 *  API for anything. The markdown is unchanged. */
function imageView(fallbackAlt: string) {
  return $view(
    imageSchema.node,
    (): NodeViewConstructor => (node) => {
      const src = String(node.attrs.src);
      if (noteImageSrc(src)) return { dom: DOMSerializer.renderSpec(document, node.type.spec.toDOM!(node)).dom };
      const dom = document.createElement('span');
      dom.className = 'note-image-external';
      dom.textContent = `[${String(node.attrs.alt) || fallbackAlt}: ${src}]`;
      return { dom };
    },
  );
}

/* -------------------------------------------------------------------------------------------------------------------
 * Ticking a task: a real checkbox (mouse) in a node view, Cmd/Ctrl+Enter inside a task (keyboard). A tick is its own
 * undo step (closeHistory). Enter in a ticked task: the preset copies the tick into the new item; ours starts unticked.
 * ---------------------------------------------------------------------------------------------------------------- */
const toggleTask: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type.spec.code) return false; // Cmd/Ctrl+Enter in a code block stays "leave the block"
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name !== 'list_item') continue;
    if (node.attrs.checked == null) return false; // the innermost item decides
    dispatch?.(
      closeHistory(state.tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, checked: !node.attrs.checked })),
    );
    return true;
  }
  return false;
};

const taskKeymap = $useKeymap('noteTask', {
  ToggleTask: { shortcuts: 'Mod-Enter', command: () => toggleTask },
  NewItemUnchecked: {
    shortcuts: 'Enter',
    priority: 60, // before the preset's SplitListItem (50)
    command: (ctx) => (state, dispatch, view) => {
      const { $from } = state.selection;
      if ($from.depth < 2 || $from.node(-1).type.name !== 'list_item' || $from.node(-1).attrs.checked !== true)
        return false;
      const split = ctx.get(commandsCtx).get(splitListItemCommand.key)();
      return split(
        state,
        dispatch &&
          ((tr) => {
            const $caret = tr.selection.$from; // now in the new item
            const item = $caret.depth >= 2 ? $caret.node(-1) : null;
            if (item?.type.name === 'list_item' && item.attrs.checked === true)
              tr.setNodeMarkup($caret.before(-1), undefined, { ...item.attrs, checked: false });
            dispatch(tr);
          }),
        view,
      );
    },
  },
});

function taskItemView(boxLabel: string) {
  return $view(
    listItemSchema.node,
    (): NodeViewConstructor => (initial, view, getPos) => {
      let node = initial;
      if (node.attrs.checked == null) {
        // a plain list item keeps the schema's own DOM
        const { dom, contentDOM } = DOMSerializer.renderSpec(document, node.type.spec.toDOM!(node));
        return {
          dom,
          contentDOM,
          update: (next) => {
            if (!next.sameMarkup(node)) return false; // ProseMirror draws it again (it became a task)
            node = next;
            return true;
          },
        };
      }
      const dom = document.createElement('li');
      const box = dom.appendChild(document.createElement('span'));
      const checkbox = box.appendChild(document.createElement('input'));
      const contentDOM = dom.appendChild(document.createElement('div'));
      box.contentEditable = 'false';
      box.className = 'task-box';
      contentDOM.className = 'task-content';
      checkbox.type = 'checkbox';
      checkbox.tabIndex = -1; // one tab stop for the editor; the keyboard ticks with Cmd/Ctrl+Enter
      checkbox.setAttribute('aria-label', boxLabel);
      const render = () => {
        dom.dataset.itemType = 'task';
        dom.dataset.checked = String(node.attrs.checked);
        dom.dataset.listType = String(node.attrs.listType);
        dom.dataset.label = String(node.attrs.label);
        dom.dataset.spread = String(node.attrs.spread);
        checkbox.checked = node.attrs.checked === true;
      };
      render();
      checkbox.addEventListener('mousedown', (event) => event.preventDefault()); // keep the focus and caret in the text
      checkbox.addEventListener('change', () => {
        const pos = getPos();
        if (!view.editable || pos == null) {
          checkbox.checked = node.attrs.checked === true;
          return;
        }
        view.dispatch(
          closeHistory(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: checkbox.checked })),
        );
      });
      return {
        dom,
        contentDOM,
        update: (next) => {
          if (next.type !== node.type || next.attrs.checked == null) return false;
          node = next;
          render();
          return true;
        },
        stopEvent: (event) => box.contains(event.target as Node | null),
        ignoreMutation: (mutation) => mutation.type !== 'selection' && !contentDOM.contains(mutation.target),
      };
    },
  );
}

/* -------------------------------------------------------------------------------------------------------------------
 * The "/" menu: slashFactory + SlashProvider on our own element (React portals the list into it). It opens on '/' at
 * the start of a paragraph or heading or after a space, outside tables and code; the text after it (up to 32
 * characters, spaces allowed: '/tiêu đề 2') filters the blocks, accents and case ignored. Its keys run before every
 * keymap (Milkdown puts $prose plugins first); ProseMirror does not send them while an IME is composing.
 * ---------------------------------------------------------------------------------------------------------------- */
interface SlashItem {
  id: string;
  label: Msg;
  /** Words that find it in either language. */
  keywords: string;
  /** Each command takes its own payload type. */
  command: $Command<any>;
  payload?: unknown;
  /** For commands that answer true anywhere (divider, table): may the block go here? */
  when?: (state: EditorState, ctx: Ctx) => boolean;
}

interface ShownSlashItem extends Omit<SlashItem, 'label'> {
  label: string;
}

const parentAccepts =
  (schema: { type: (ctx: Ctx) => NodeType }) =>
  (state: EditorState, ctx: Ctx): boolean => {
    const { $from } = state.selection;
    return $from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), schema.type(ctx));
  };

const SLASH_ITEMS: SlashItem[] = [
  { id: 'text', label: msg('Văn bản'), keywords: 'text paragraph van ban doan', command: turnIntoTextCommand },
  { id: 'h1', label: msg('Tiêu đề 1'), keywords: 'h1 heading title tieu de', command: wrapInHeadingCommand, payload: 1 },
  { id: 'h2', label: msg('Tiêu đề 2'), keywords: 'h2 heading title tieu de', command: wrapInHeadingCommand, payload: 2 },
  { id: 'h3', label: msg('Tiêu đề 3'), keywords: 'h3 heading title tieu de', command: wrapInHeadingCommand, payload: 3 },
  { id: 'bullet', label: msg('Danh sách'), keywords: 'bullet list ul danh sach', command: wrapInBulletListCommand },
  {
    id: 'ordered',
    label: msg('Danh sách số'),
    keywords: 'numbered ordered list ol danh sach so',
    command: wrapInOrderedListCommand,
  },
  { id: 'task', label: msg('Việc cần làm'), keywords: 'todo task checkbox viec can lam', command: wrapInTaskListCommand },
  { id: 'quote', label: msg('Trích dẫn'), keywords: 'quote blockquote trich dan', command: wrapInBlockquoteCommand },
  { id: 'code', label: msg('Khối mã'), keywords: 'code block khoi ma', command: createCodeBlockCommand, payload: '' },
  {
    id: 'hr',
    label: msg('Đường kẻ'),
    keywords: 'divider hr rule line duong ke',
    command: insertHrCommand,
    when: parentAccepts(hrSchema),
  },
  {
    id: 'table',
    label: msg('Bảng'),
    keywords: 'table bang',
    command: insertTableCommand,
    payload: { row: 3, col: 3 },
    when: parentAccepts(tableSchema),
  },
];

interface SlashMatch {
  /** Where the '/' is. */
  at: number;
  /** What a chosen block deletes: '/query' and the space before it. */
  from: number;
  /** The caret. */
  to: number;
  query: string;
}

function matchSlash(state: EditorState): SlashMatch | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  const { $from } = selection;
  const block = $from.parent;
  if (block.type.name !== 'paragraph' && block.type.name !== 'heading') return null;
  for (let depth = $from.depth - 1; depth > 0; depth--) if ($from.node(depth).type.spec.tableRole) return null;
  const before = block.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = /(^|\s)\/([^\s/￼][^/￼]{0,31})?$/u.exec(before);
  if (!match) return null;
  const query = match[2] ?? '';
  const at = $from.pos - query.length - 1;
  return { at, from: at - match[1].length, to: $from.pos, query };
}

/** Lower case without accents: "tieu de" finds "Tiêu đề". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/đ/g, 'd');

function canRun(ctx: Ctx, state: EditorState, item: ShownSlashItem): boolean {
  if (item.when && !item.when(state, ctx)) return false;
  try {
    return ctx.get(commandsCtx).get(item.command.key)(item.payload)(state); // a dry run: no dispatch
  } catch {
    return false;
  }
}

/** The caret's line opens a list item (its first paragraph): only a task can take its place there. */
function inListLine(state: EditorState, ctx: Ctx): boolean {
  const { $from } = state.selection;
  return (
    $from.depth >= 2 &&
    $from.parent.type.name === 'paragraph' &&
    $from.node(-1).type === listItemSchema.type(ctx) &&
    $from.index(-1) === 0
  );
}

/**
 * How a block goes on the caret's line: 0 = at once, n = after lifting the line n levels out of its lists (a heading,
 * a quote or code cannot open a list item; "Văn bản" on a list line means leaving the lists), null = not here.
 */
function slashLifts(ctx: Ctx, state: EditorState, item: ShownSlashItem): number | null {
  const onList = inListLine(state, ctx);
  if (!(item.id === 'text' && onList) && canRun(ctx, state, item)) return 0;
  if (!onList) return null;
  const listItem = listItemSchema.type(ctx);
  let now = state;
  for (let level = 1; level <= 8; level++) {
    const from = now;
    const lifted: EditorState[] = [];
    if (!liftListItem(listItem)(from, (tr) => void lifted.push(from.apply(tr))) || lifted.length === 0) return null;
    now = lifted[0];
    if (item.id === 'text' ? !inListLine(now, ctx) : canRun(ctx, now, item)) return level;
  }
  return null;
}

interface SlashSnapshot {
  readonly open: boolean;
  readonly query: string;
  readonly items: readonly ShownSlashItem[];
  readonly index: number;
}

const CLOSED: SlashSnapshot = { open: false, query: '', items: [], index: 0 };
let editorCount = 0;

/** One per editor: the menu's element, a small store for React, and the plugin spec. */
class SlashController {
  readonly element: HTMLDivElement;
  readonly listId: string;
  readonly plugin = slashFactory('NOTE');
  readonly #dismissed = new PluginKey<number | null>('NOTE_SLASH');
  readonly #items: readonly ShownSlashItem[];
  readonly #listeners = new Set<() => void>();
  #snapshot = CLOSED;
  #ctx: Ctx | null = null;
  #view: EditorView | null = null;
  #provider: SlashProvider | null = null;

  constructor(items: readonly ShownSlashItem[], base: string) {
    this.#items = items;
    this.listId = `${base}-blocks`;
    this.element = document.createElement('div');
    this.element.className = 'note-popover';
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = () => this.#snapshot;

  optionId = (item: ShownSlashItem) => `${this.listId}-${item.id}`;

  setIndex = (index: number) => this.#set({ index });

  /** Deletes '/query' (and the space before it), then runs the block's command. */
  choose = (index = this.#snapshot.index): boolean => {
    const view = this.#view;
    const ctx = this.#ctx;
    const active = view && this.#active(view);
    const item = active?.items[index];
    if (!view || !ctx || !active || !item) return false;
    view.dispatch(closeHistory(view.state.tr.delete(active.from, active.to))); // Cmd/Ctrl+Z brings '/query' back
    // a list line leaves its lists first (in the same undo step)
    const lifts = slashLifts(ctx, view.state, item) ?? 0;
    for (let i = 0; i < lifts; i++) liftListItem(listItemSchema.type(ctx))(view.state, view.dispatch);
    const done = item.id === 'text' && lifts > 0 ? true : callCommand(item.command.key, item.payload)(ctx);
    this.#provider?.hide();
    view.focus();
    return done;
  };

  /** The ProseMirror plugin spec for slashFactory's slice (set in Editor.config). */
  spec(ctx: Ctx): PluginSpec<number | null> {
    return {
      key: this.#dismissed, // the factory's key replaced; the state is the '/' closed with Escape
      state: {
        init: () => null,
        apply: (tr, dismissedAt, _old, state) => {
          const meta: unknown = tr.getMeta(this.#dismissed);
          if (typeof meta === 'number') return meta;
          if (dismissedAt == null) return null;
          const at = tr.mapping.map(dismissedAt);
          return matchSlash(state)?.at === at ? at : null;
        },
      },
      props: {
        handleKeyDown: (view, event) => this.#onKey(view, event),
        handleDOMEvents: {
          blur: (_view, event) => {
            if (!this.element.contains(event.relatedTarget as Node | null)) this.#provider?.hide();
            return false;
          },
          // Back in the editor with a '/query' before the caret: the menu shows again (a focus makes no transaction,
          // so it stayed hidden while Enter and the arrows still acted on it)
          focus: (view) => {
            this.#provider?.update(view);
            return false;
          },
          // The provider skips updates while composing, and the state may not change at compositionend
          compositionend: (view) => {
            setTimeout(() => this.#provider?.update(view));
            return false;
          },
        },
      },
      view: (view) => {
        this.#ctx = ctx;
        this.#view = view;
        const provider = new SlashProvider({
          content: this.element,
          debounce: 20,
          offset: 6,
          middleware: [shift({ padding: 8 })],
          shouldShow: (v) => (v.hasFocus() || this.element.contains(document.activeElement)) && this.#active(v) != null,
        });
        provider.onShow = () => this.#set({ open: true });
        provider.onHide = () => this.#set({ open: false });
        this.#provider = provider;
        return {
          update: (v) => {
            this.#refresh(v);
            provider.update(v); // no prevState: looked at again every time (debounced)
          },
          destroy: () => {
            provider.destroy();
            this.element.remove(); // the provider leaves its element in place
            this.#provider = null;
            this.#view = null;
            this.#ctx = null;
            this.#set(CLOSED);
          },
        };
      },
    };
  }

  #active(view: EditorView): (SlashMatch & { items: ShownSlashItem[] }) | null {
    const ctx = this.#ctx;
    if (!ctx || !view.editable) return null;
    const match = matchSlash(view.state);
    if (!match || this.#dismissed.getState(view.state) === match.at) return null;
    const query = fold(match.query);
    const items = this.#items.filter(
      (item) => fold(`${item.label} ${item.keywords}`).includes(query) && slashLifts(ctx, view.state, item) !== null,
    );
    return items.length > 0 ? { ...match, items } : null;
  }

  #refresh(view: EditorView) {
    const active = this.#active(view);
    const items = active?.items ?? CLOSED.items;
    const query = active?.query ?? '';
    const prev = this.#snapshot;
    if (query === prev.query && items.length === prev.items.length && items.every((item, i) => item === prev.items[i]))
      return;
    this.#set({ query, items, index: 0 });
  }

  #onKey(view: EditorView, event: KeyboardEvent): boolean {
    if (event.isComposing || event.keyCode === 229) return false;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) return false;
    const active = this.#active(view); // now, not the debounced visibility
    if (!active) return false;
    if (event.key === 'Escape') {
      // the menu closes; a Sheet or the note's own "Escape ends the edit" must not take this Escape too
      event.stopPropagation();
      view.dispatch(view.state.tr.setMeta(this.#dismissed, active.at));
      this.#provider?.hide();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      this.choose();
    } else {
      const count = active.items.length;
      this.#set({ index: (this.#snapshot.index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count });
    }
    return true; // handled: ProseMirror prevents the default, the caret stays
  }

  #set(patch: Partial<SlashSnapshot>) {
    const prev = this.#snapshot;
    const next = { ...prev, ...patch };
    if (next.open === prev.open && next.query === prev.query && next.items === prev.items && next.index === prev.index)
      return;
    this.#snapshot = next;
    const active = next.open ? next.items[next.index] : undefined;
    if (active) this.#view?.dom.setAttribute('aria-activedescendant', this.optionId(active));
    else this.#view?.dom.removeAttribute('aria-activedescendant');
    this.#listeners.forEach((listener) => listener());
  }
}

function SlashMenu({ slash }: { slash: SlashController }) {
  const t = useT();
  const { open, items, index } = useSyncExternalStore(slash.subscribe, slash.getSnapshot, slash.getSnapshot);
  const active = open ? items[index] : undefined;
  useEffect(() => {
    if (active) document.getElementById(slash.optionId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active, slash]);
  // In the page whenever there are blocks to offer (hidden until the menu shows): the menu is placed by its real
  // size, so near the bottom of the screen it opens above the caret
  if (items.length === 0) return null;
  return (
    // a press anywhere on the list (padding, scrollbar too) keeps the focus in the editor and the menu open
    <ul
      role="listbox"
      id={slash.listId}
      aria-label={t('Chèn khối')}
      className="note-popover-list"
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map((item, i) => (
        <li
          key={item.id}
          id={slash.optionId(item)}
          role="option"
          aria-selected={i === index}
          className="note-popover-option"
          onMouseEnter={() => slash.setIndex(i)}
          onClick={() => slash.choose(i)}
        >
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Links in the note are edited, not followed: a click (also with Ctrl/Cmd, Shift or the middle button) stays here. */
const linkClickGuard = $prose(
  () =>
    new Plugin({
      key: new PluginKey('NOTE_LINK_CLICK_GUARD'),
      props: {
        handleDOMEvents: {
          click: (_view, event) => preventLinkNavigation(event),
          auxclick: (_view, event) => preventLinkNavigation(event),
        },
      },
    }),
);

function preventLinkNavigation(event: MouseEvent): boolean {
  if (event.target instanceof Element && event.target.closest('a[href]')) event.preventDefault();
  return false; // ProseMirror still puts the caret where the click landed
}

/* -------------------------------------------------------------------------------------------------------------------
 * The page's own keys, after the menus (they take Escape and Enter while open): Escape ends an inline edit, Cmd/Ctrl+
 * Enter saves now (except inside a task, which it ticks, or code, which it leaves).
 * ---------------------------------------------------------------------------------------------------------------- */
function pageKeys(keys: { current: { onEscape?: () => void; onSubmit?: () => void } }) {
  return $prose(
    () =>
      new Plugin({
        key: new PluginKey('NOTE_PAGE_KEYS'),
        props: {
          handleKeyDown: (view, event) => {
            if (event.isComposing) return false;
            if (event.key === 'Escape' && keys.current.onEscape) {
              // Ending the edit removes the editor before the key reaches the Sheet around it, which would then take
              // the Escape as its own (the target no longer inside the note): the key stops here
              event.stopPropagation();
              keys.current.onEscape();
              return true;
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && keys.current.onSubmit) {
              if (toggleTask(view.state) || view.state.selection.$from.parent.type.spec.code) return false;
              keys.current.onSubmit();
              return true;
            }
            return false;
          },
        },
      }),
  );
}

/**
 * Tells the page at once that the text changed (Milkdown's listener reports the markdown 200 ms later). Changes made by
 * plugins on their own (the trailing paragraph after a last code block) are no input.
 */
function inputSignal(onInput: () => void) {
  const key = new PluginKey<number>('NOTE_INPUT');
  return $prose(
    () =>
      new Plugin<number>({
        key,
        state: {
          init: () => 0,
          apply: (tr, count) => (tr.docChanged && !tr.getMeta('appendedTransaction') ? count + 1 : count),
        },
        view: () => ({
          update: (view, prev) => {
            if (key.getState(view.state) !== key.getState(prev)) onInput();
          },
        }),
      }),
  );
}

/** The caret at the end of the note, or in its first empty line (a template's first blank). */
function placeCaret(view: EditorView, at: 'end' | 'first-empty') {
  const { doc } = view.state;
  let pos = -1;
  if (at === 'first-empty')
    doc.descendants((node, p) => {
      if (pos >= 0) return false;
      if (node.isTextblock && node.content.size === 0) {
        pos = p + 1;
        return false;
      }
      return true;
    });
  const selection = pos >= 0 ? TextSelection.create(doc, pos) : Selection.atEnd(doc);
  view.focus();
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
}

interface Ready {
  slash: SlashController;
  picker: LinkPicker;
  focus: (at: 'end' | 'first-empty') => void;
}

function slashItems(t: T): ShownSlashItem[] {
  return SLASH_ITEMS.map((item) => ({ ...item, label: t(item.label) }));
}

/**
 * The note editor. Uncontrolled: it opens with `defaultMarkdown` and reports every change (remount with a new `key`
 * to load other text). One Milkdown editor per mount, on its own child element, so React's double effect in
 * development never meets a half-destroyed one.
 */
export default function NoteEditor({
  id,
  defaultMarkdown,
  onChange,
  label,
  placeholder,
  focusRequest = 0,
  caret = 'end',
  onEscape,
  onSubmit,
  onInput,
  onReady,
  selfNoteId,
  variant = 'inline',
  className,
}: NoteEditorProps) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const [opening] = useState(() => ({
    label,
    placeholder: placeholder ?? '',
    items: slashItems(t),
    taskLabel: t('Đã xong'),
    imageLabel: t('Ảnh'),
  }));
  // The text as last reported: an effect that runs again on this component (Fast Refresh, <Activity>) makes its editor
  // from it, not from the first render's text, which would drop what was typed since
  const latest = useRef(defaultMarkdown);
  const [ready, setReady] = useState<Ready | null>(null);
  const keys = useRef<{ onEscape?: () => void; onSubmit?: () => void }>({});
  useEffect(() => {
    keys.current = { onEscape, onSubmit };
  });
  const emitChange = useEffectEvent((markdown: string) => onChange(markdown));
  const emitInput = useEffectEvent(() => onInput?.());
  const emitReady = useEffectEvent((handle: NoteEditorHandle | null) => onReady?.(handle));
  // the focus request answered last: the one the editor found when it was ready, then each new one
  const handledFocus = useRef(0);
  const firstFocus = useEffectEvent(() => {
    handledFocus.current = focusRequest;
    return focusRequest;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const base = `note-editor-${++editorCount}`;
    const root = host.appendChild(document.createElement('div'));
    const slash = new SlashController(opening.items, base);
    const picker = new LinkPicker(base);
    // The text as last reported. Once the editor is ready it is the note as Milkdown writes it (`*` bullets as `-`,
    // for one): a note that is only opened is never reported, so never saved again
    let last = latest.current;
    let opened = false;
    const report = (next: string) => {
      if (next === last) return;
      last = next;
      latest.current = next;
      emitChange(next);
    };
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, latest.current);
        ctx.set(rootAttrsCtx, { class: 'milkdown note-editor-root' });
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: {
            id,
            class: 'note-editor',
            'data-variant': variant,
            'aria-label': opening.label,
            'aria-multiline': 'true',
            ...(opening.placeholder && { 'aria-placeholder': opening.placeholder }),
            spellcheck: 'true',
          },
        }));
        // Text typed at either end of a link stays outside it (the preset's link mark is inclusive, so the next
        // character, an IME composition, or text after undo joined the link)
        ctx.update(linkSchema.key, (prev) => (c) => ({ ...prev(c), inclusive: false }));
        // `-` bullets and `---` rules, as people type them (remark's defaults are `*` and `***`)
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          bullet: '-' as const,
          rule: '-' as const,
          handlers: {
            ...prev.handlers,
            // Milkdown writes a text run that ends in a space (before a mark, a link or code) as it is, so a "`", "#",
            // "[", "<" or "1." in it came back as code, a heading, a link, HTML or a list on reload. Escaped as remark
            // does, except the trailing space, which remark would write as `&#x20;`.
            text: (node, _parent, state, info) => {
              const value: string = node.value;
              const body = value.trimEnd();
              const space = value.slice(body.length);
              if (!body) return value;
              return state.safe(body, { ...info, ...(space && { after: space[0] }), encode: [] }) + space;
            },
          },
        }));
        ctx.get(listenerCtx).markdownUpdated((_ctx, next) => report(next));
        ctx.set(slash.plugin.key, slash.spec(ctx));
        // A paragraph after a code block that ends the note, to click or arrow into (Enter only adds lines to the
        // code). Only there: after a list or a quote Enter twice already leaves, and a second empty paragraph would be
        // saved as '<br />'. The last empty paragraph itself is never saved.
        ctx.update(trailingConfig.key, (prev) => ({
          ...prev,
          shouldAppend: (lastNode) => lastNode?.type.name === 'code_block',
        }));
      })
      .use(commonmark.filter((plugin) => plugin !== insertHrInputRule))
      .use(gfm)
      .use(listener)
      .use(history)
      .use(pasteTextAsMarkdown) // before the clipboard plugin: plain text keeps its line breaks
      .use(clipboard) // markdown in text/plain: pasted as blocks, copied as markdown
      .use(trailing)
      .use(taskInputRule)
      .use(hrInputRule)
      .use(wrapInTaskListCommand)
      .use(codeFenceKeymap)
      .use(undoEnterRuleKeymap)
      .use(noteStartKeymap)
      .use(taskKeymap)
      .use(taskItemView(opening.taskLabel))
      .use(imageView(opening.imageLabel))
      .use(placeholderPlugin(opening.placeholder))
      .use(slash.plugin)
      .use(gapCursorPlugin) // a caret before or after a table or a rule at either end of the note (after the menu's keys)
      .use(picker.plugin)
      .use(linkClickGuard)
      .use(pageKeys(keys))
      .use(inputSignal(() => emitInput()));
    let alive = true;
    editor.create().then(
      () => {
        if (!alive) return;
        last = editor.action(getMarkdown());
        opened = true;
        const focus = (at: 'end' | 'first-empty') => editor.action((ctx) => placeCaret(ctx.get(editorViewCtx), at));
        setReady({ slash, picker, focus });
        emitReady({
          markdown: () => {
            if (editor.status !== EditorStatus.Created) return null;
            const now = editor.action(getMarkdown());
            return now === last ? null : now;
          },
        });
        if (firstFocus() > 0) focus(caret);
      },
      (error: unknown) => console.error(error),
    );
    return () => {
      alive = false;
      root.hidden = true;
      // markdownUpdated waits 200 ms: what was typed in that time is reported now
      if (opened && editor.status === EditorStatus.Created) report(editor.action(getMarkdown()));
      emitReady(null);
      // no setState here: React would keep the update queued on the unmounted component
      void editor.destroy().then(() => root.remove());
    };
    // the editor is made once per mount: later props are read through refs and effect events
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new focus request once the editor is ready (the composer asked again): the caret goes to the end
  useEffect(() => {
    if (!ready || focusRequest === handledFocus.current) return;
    handledFocus.current = focusRequest;
    if (focusRequest > 0) ready.focus('end');
  }, [focusRequest, ready]);

  return (
    <div ref={hostRef} className={cn(noteEditorFrame(variant), className)}>
      {ready && createPortal(<SlashMenu slash={ready.slash} />, ready.slash.element)}
      {ready && <LinkPickerList picker={ready.picker} selfNoteId={selfNoteId} />}
    </div>
  );
}
