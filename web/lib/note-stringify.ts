// How the note editor writes markdown (note-editor.tsx): the remark-stringify options it sets on top of Milkdown's.
// Apart from the editor so that a test runs Milkdown's own parser and serializer with them (note-stringify.test.ts).
import type { Nodes } from 'mdast';
import { defaultHandlers, type Handle } from 'mdast-util-to-markdown';
import type { Options } from 'remark-stringify';

/**
 * A text run. Milkdown wrote a run that ends in a space (before a mark, a link or code) as it is, so a "`", "#", "[",
 * "<" or "1." in it came back as code, a heading, a link, HTML or a list on reload: it is escaped as remark does,
 * except the trailing space, which remark would write as `&#x20;`. A run of only spaces stays as it is, unless it
 * starts a line (a paragraph, a list item, a quote line, the line after a hard break) and more follows on that line (a
 * mark, a link, code, a break): four spaces there read as an indented code block on reload, which dropped the marks and
 * the link, and fewer were dropped. Its first space or tab is then a character reference, as remark writes the first
 * space of a line that starts with text.
 */
export const noteText: Handle = (node, _parent, state, info) => {
  const value: string = node.value;
  const body = value.trimEnd();
  const space = value.slice(body.length);
  if (body) return state.safe(body, { ...info, ...(space && { after: space[0] }), encode: [] }) + space;
  const startsLine = /[\r\n]$/.test(info.before);
  const endsLine = /^[\r\n]/.test(info.after);
  if (!startsLine || endsLine || !/^[ \t]/.test(value)) return value;
  return `&#x${value.charCodeAt(0).toString(16).toUpperCase()};${value.slice(1)}`;
};

const MARKS = new Set(['strong', 'emphasis', 'delete']);

/** A bold, italic or struck-through run with nothing but whitespace in it (or nothing at all), marks inside included. */
function blankMark(node: Nodes): boolean {
  return MARKS.has(node.type) && 'children' in node && node.children.every((c) => blankMark(c) || blankText(c));
}

const blankText = (node: Nodes) => node.type === 'text' && !/\S/.test(node.value);

/**
 * Takes the marks that hold only whitespace out of the tree (their text stays in their place), and the empty texts left
 * where they were. Milkdown moves a mark's outer spaces out of it, so a bold space (left after a bold word was deleted)
 * reached remark as an empty mark, written as bare markers: "Một **** sau", and "~~~~ việc" at a line start, which reads
 * back as a code fence that turns the rest of the note into code. A space or tab left at a line start is then written
 * by noteText (an empty text before it would hide that it starts the line).
 */
function dropBlankMarks(node: Nodes): void {
  if (!('children' in node)) return;
  if (node.children.some(blankMark)) {
    const unwrap = (child: Nodes): Nodes[] =>
      blankMark(child) && 'children' in child ? child.children.flatMap(unwrap) : [child];
    node.children = node.children.flatMap(unwrap).filter((c) => !(c.type === 'text' && c.value === '')) as typeof node.children;
  }
  node.children.forEach(dropBlankMarks);
}

/** The whole note: blank marks dropped first (the tree is the serializer's own, made for this one write). */
const noteRoot: Handle = (node, parent, state, info) => {
  dropBlankMarks(node);
  return defaultHandlers.root(node, parent, state, info);
};

/** Milkdown's options with the note's: `-` bullets and `---` rules, as people type them (remark's defaults are `*` and
 *  `***`), and the text and root handlers above. */
export function noteStringifyOptions(prev: Options): Options {
  return { ...prev, bullet: '-', rule: '-', handlers: { ...prev.handlers, root: noteRoot, text: noteText } };
}
