import {
  Editor,
  SerializerReady,
  parserCtx,
  remarkStringifyOptionsCtx,
  schemaCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Node, Schema } from '@milkdown/kit/prose/model';
import { beforeAll, describe, expect, it } from 'vitest';
import { noteStringifyOptions } from './note-stringify';

// Milkdown's own parser and serializer with the note editor's options (note-editor.tsx), without a view: there is no
// DOM here. Setting the editor up reads `document.body` for the view (which is never made) and waits on window events.
let parse: (markdown: string) => Node;
let serialize: (doc: Node) => string;
let schema: Schema;

beforeAll(async () => {
  const bus = new EventTarget();
  Object.assign(globalThis, {
    document: { body: null },
    addEventListener: bus.addEventListener.bind(bus),
    removeEventListener: bus.removeEventListener.bind(bus),
    dispatchEvent: bus.dispatchEvent.bind(bus),
  });
  const ctx = await new Promise<Ctx>((resolve, reject) => {
    Editor.make()
      .config((c) => c.update(remarkStringifyOptionsCtx, noteStringifyOptions))
      .use(commonmark)
      .use(gfm)
      .use((c) => async () => {
        await c.wait(SerializerReady);
        resolve(c);
      })
      .create()
      // the view cannot be made here; the parser and the serializer are ready before it
      .catch((error: unknown) => (String(error).includes('document') ? undefined : reject(error)));
  });
  parse = ctx.get(parserCtx);
  serialize = ctx.get(serializerCtx);
  schema = ctx.get(schemaCtx);
});

// A paragraph of runs: a string is plain text, [text, mark, attrs] a marked one
type Run = string | [string, string, Record<string, unknown>?] | 'break';
function paragraph(...runs: Run[]): Node {
  return schema.nodes.paragraph.create(
    null,
    runs.map((run) =>
      run === 'break'
        ? schema.nodes.hardbreak.create()
        : typeof run === 'string'
          ? schema.text(run)
          : schema.text(run[0], [schema.marks[run[1]].create(run[2])]),
    ),
  );
}
const doc = (...blocks: Node[]) => schema.nodes.doc.create(null, blocks);
const item = (block: Node, checked: boolean | null = null) =>
  schema.nodes.list_item.create({ checked, listType: 'bullet', label: '•', spread: false }, block);
const bullets = (...items: Node[]) => schema.nodes.bullet_list.create(null, items);
const quote = (block: Node) => schema.nodes.blockquote.create(null, block);

const bold = (text: string): Run => [text, 'strong'];
const link = (text: string): Run => [text, 'link', { href: '/thu-vien/item/?id=12' }];
const code = (text: string): Run => [text, 'inlineCode'];

describe('note-stringify: what the editor writes reads back as typed', () => {
  // Typed in the editor: spaces at the start of a line before a mark, a link or code (V3-1 / F5). Four of them were
  // written raw and came back as an indented code block, the marks and the link lost.
  // (built in each test: the schema is there once the editor is set up)
  const typed: [string, () => Node][] = [
    ['4 spaces + bold', () => doc(paragraph('    ', bold('đậm'), ' thường'))],
    ['4 spaces + link', () => doc(paragraph('    ', link('Sách'), ' xong'))],
    ['4 spaces + code', () => doc(paragraph('    ', code('x = 1')))],
    ['2 spaces + bold', () => doc(paragraph('  ', bold('đậm')))],
    ['3 spaces + link', () => doc(paragraph('   ', link('Sách')))],
    ['a tab + bold', () => doc(paragraph('\t', bold('đậm')))],
    ['8 spaces + bold', () => doc(paragraph('        ', bold('đậm')))],
    ['list item, 4 spaces + link', () => doc(bullets(item(paragraph('    ', link('Sách'), ' xong'))))],
    ['task, 4 spaces + bold', () => doc(bullets(item(paragraph('    ', bold('việc')), false)))],
    ['quote, 4 spaces + link', () => doc(quote(paragraph('    ', link('Sách'))))],
    ['after a hard break, 4 spaces + bold', () => doc(paragraph('dòng một', 'break', '    ', bold('đậm')))],
    ['4 spaces + a hard break', () => doc(paragraph('    ', 'break', 'dòng hai'))],
    ['between two marks', () => doc(paragraph(bold('a'), '    ', bold('b')))],
  ];
  it.each(typed)('%s', (_name, build) => {
    const typedDoc = build();
    const markdown = serialize(typedDoc);
    const back = parse(markdown);
    expect(back.toJSON(), markdown).toEqual(typedDoc.toJSON());
    expect(serialize(back)).toBe(markdown);
  });

  it('writes the first space or tab of such a line as a character reference, the rest as typed', () => {
    expect(serialize(doc(paragraph('    ', bold('đậm'), ' thường')))).toBe('&#x20;   **đậm** thường\n');
    expect(serialize(doc(paragraph('\t', bold('đậm'))))).toBe('&#x9;**đậm**\n');
    expect(serialize(doc(bullets(item(paragraph('    ', link('x'))))))).toBe('- &#x20;   [x](/thu-vien/item/?id=12)\n');
    expect(serialize(doc(quote(paragraph('    ', link('x')))))).toBe('> &#x20;   [x](/thu-vien/item/?id=12)\n');
  });

  it('keeps spaces in the middle and at the end of a line as they are', () => {
    expect(serialize(doc(paragraph(bold('a'), '    ', bold('b'))))).toBe('**a**    **b**\n');
    expect(serialize(doc(paragraph('a ', bold('b'), '   ')))).toBe('a **b**   \n');
    expect(serialize(doc(paragraph('a   ')))).toBe('a   \n');
    // a line of spaces alone is no line of text (and never code)
    expect(serialize(doc(paragraph('a'), paragraph('    '), paragraph('b')))).toBe('a\n\n    \n\nb\n');
  });

  it('still escapes a run that ends in a space before a mark (the earlier fix)', () => {
    expect(serialize(doc(paragraph('# ', bold('y'))))).toBe('\\# **y**\n');
    expect(serialize(doc(paragraph('1. ', bold('y'))))).toBe('1\\. **y**\n');
    expect(serialize(doc(paragraph('Phím ` mở console. ', link('x'))))).toBe(
      'Phím \\` mở console. [x](/thu-vien/item/?id=12)\n',
    );
  });

  // Stored forms that already read back as written stay as they are
  it.each([
    '- một\n- hai\n',
    '- [ ] việc\n- [x] xong\n',
    '1. a\n2. b\n',
    '> trích dẫn\n',
    '# Tiêu đề\n\nĐoạn **đậm** và `mã`.\n',
    '&#x20;   thường\n',
    '&#x20;Ghi **đậm**\n',
    '| a | b |\n| - | - |\n| 1 | 2 |\n',
    'dòng một\\\ndòng hai\n',
    '[Sách](/thu-vien/item/?id=12) xong\n',
  ])('%j round-trips', (markdown) => {
    expect(serialize(parse(markdown))).toBe(markdown);
  });
});
