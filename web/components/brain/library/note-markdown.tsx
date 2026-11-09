'use client';
import Link from 'next/link';
import { Children, createContext, isValidElement, use, useMemo, type ComponentProps, type ReactNode } from 'react';
import { Square, SquareCheckBig } from 'lucide-react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { markdownHref, noteImageSrc } from '@/lib/item-notes';
import { cn } from '@/lib/utils';

// A note's markdown as reading text (DECISIONS 9.8, until the block editor lands). Loaded only through note-body.tsx
// (React.lazy), so react-markdown and remark-gfm ship in their own chunk, never on Hôm nay. Safe by construction: raw
// HTML stays visible as text (react-markdown escapes it; no rehype-raw), links go through markdownHref (same-origin
// pages stay in the app, http(s)/mailto open outside, everything else is text), and only local pictures load
// (noteImageSrc):
// an image on another domain becomes a link, so reading a note never makes a request to another site (CLAUDE.md).
// Notes are private: nothing here sends them anywhere.

type Props<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & { node?: unknown };

/** Drops react-markdown's `node` prop before spreading the rest on a DOM element. */
function rest<T extends { node?: unknown }>(props: T): Omit<T, 'node'> {
  const { node: _node, ...others } = props;
  return others;
}

// Type sizes stay inside DESIGN.md §2: a note heading is at most 15px (the card title role), body text 14/23.
// A note sits under the page's h1, the "Ghi chú" h2 and its own h3 title, so its headings start at h4. Each block has
// the editor's size and spacing (note-editor.css), so nothing moves when the editor takes the note's place (the
// pencil on the Item page, the editor's loading state).
const heading = 'font-heading font-semibold tracking-tight text-foreground first:mt-0 last:mb-0';
const headingLarge = cn(heading, 'mt-5 mb-2 text-[15px] leading-5');
const headingSmall = cn(heading, 'mt-4 mb-2 text-sm');
const headingPage = cn(heading, 'mt-5 mb-2 text-[18px] leading-7'); // a note page's first level, as its editor's

/** Where the note is read: inline (the Item page) or as the note page, whose first heading level is larger (still
 *  below the page's title), as in the editor there. */
export type NoteLook = 'inline' | 'page';

/** When the note's pictures load: as they come near the screen (reading), or at once (the editor's loading state:
 *  the editor shows them all at once, and a lazy picture in the Item Sheet waits for the Sheet to scroll to it). */
export type ImageLoading = 'lazy' | 'eager';

// Lists, apart from the renderers below: a done task tells the lists under it from its own text by them
const ul = (p: Props<'ul'>) => (
  <ul {...rest(p)} className="my-2 flex list-disc flex-col gap-1 ps-5 first:mt-0 last:mb-0" />
);
const ol = (p: Props<'ol'>) => (
  <ol {...rest(p)} className="my-2 flex list-decimal flex-col gap-1 ps-5 first:mt-0 last:mb-0" />
);
/** A done task's own text, muted and struck through: each run of what it holds apart from the lists under it (a run
 *  after such a list, a loose task's next paragraph, keeps a paragraph's 0.5rem from it, as in the editor). */
const doneText = (children: ReactNode): ReactNode[] => {
  const out: ReactNode[] = [];
  let run: ReactNode[] = [];
  const flush = () => {
    if (run.some((child) => typeof child !== 'string' || child.trim()))
      out.push(
        <div key={`done-${out.length}`} className="text-muted-foreground line-through [ol+&]:mt-2 [ul+&]:mt-2">
          {run}
        </div>,
      );
    else out.push(...run);
    run = [];
  };
  for (const child of Children.toArray(children)) {
    if (isValidElement(child) && (child.type === ul || child.type === ol)) {
      flush();
      out.push(child);
    } else run.push(child);
  }
  flush();
  return out;
};

/** Inside a link: a picture from another site is that link's text, not a link of its own (an <a> in an <a> opened the
 *  picture's address, not the link's page). */
const InLink = createContext(false);

/** A picture: the app's own file is shown; any other is never loaded, its words ("[Ảnh: alt]") stand for it. */
function NoteImage({ src, alt, images, t }: { src: unknown; alt?: string; images: ImageLoading; t: T }) {
  const inLink = use(InLink);
  const url = typeof src === 'string' ? src : '';
  const local = noteImageSrc(url);
  // in its line, as in the editor: a picture is an inline node there, and ProseMirror's cursor helpers beside it
  // (note-editor.css) share its line; drawn as a block it would leave the editor a line taller than when read
  if (local)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a local file of the app; next/image adds nothing here
      <img
        src={local}
        alt={alt ?? ''}
        loading={images}
        decoding="async"
        className="inline-block max-h-96 max-w-full rounded-md align-middle"
      />
    );
  const link = markdownHref(url);
  const label = alt ? t('Ảnh: {alt}', { alt }) : t('Ảnh');
  // never loaded from another domain: the reader opens it on purpose
  return link.kind === 'external' && !inLink ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
      [{label}]
    </a>
  ) : (
    <span className={inLink ? undefined : 'text-muted-foreground'}>[{label}]</span>
  );
}

/** The renderers of each markdown element, with the few words they add in the UI language. */
const makeComponents = (t: T, noteLook: NoteLook, images: ImageLoading): Components => ({
  h1: (p: Props<'h1'>) => <h4 {...rest(p)} className={noteLook === 'page' ? headingPage : headingLarge} />,
  h2: (p: Props<'h2'>) => <h4 {...rest(p)} className={headingLarge} />,
  h3: (p: Props<'h3'>) => <h5 {...rest(p)} className={headingSmall} />,
  h4: (p: Props<'h4'>) => <h6 {...rest(p)} className={headingSmall} />,
  h5: (p: Props<'h5'>) => <h6 {...rest(p)} className={headingSmall} />,
  h6: (p: Props<'h6'>) => <h6 {...rest(p)} className={headingSmall} />,
  p: (p: Props<'p'>) => <p {...rest(p)} className="my-2 first:mt-0 last:mb-0" />,
  ul,
  ol,
  // A task (- [ ] / - [x]) carries its own box at the list's edge instead of a bullet, as in the editor; the other
  // items of the same list keep theirs. A done task reads as done (muted, struck through), as in the editor: its own
  // text, not the open subtasks under it.
  // Inside an item the blocks are spaced as in the editor, whose item text is always a paragraph: a list under the
  // text sits 0.25rem below it, also under bare text (a tight item, where the list is the item's first element and its
  // own first:mt-0 would put it right under the text), and the item's paragraphs have no bottom margin (the next
  // block's top margin parts them: 0.5rem to a paragraph, 0.25rem to a list).
  li: ({ className, node, children, ...p }: Props<'li'>) => {
    const task = className?.includes('task-list-item');
    return (
      <li
        {...p}
        className={cn(
          'marker:text-muted-foreground [&>ol]:my-1 [&>ol:first-child]:mt-1 [&>p]:mb-0 [&>ul]:my-1 [&>ul:first-child]:mt-1',
          task && 'relative -ms-5 list-none ps-6',
        )}
      >
        {task && taskDone(node) ? doneText(children) : children}
      </li>
    );
  },
  // A task box is drawn, not a control: the note is edited as text for now (the block editor will tick boxes). The
  // state is read out in words before the task's text.
  input: ({ type, checked }: Props<'input'>) =>
    type === 'checkbox' ? (
      <>
        {checked ? (
          <SquareCheckBig aria-hidden className="absolute start-0 top-[0.3em] size-4 text-foreground" />
        ) : (
          <Square aria-hidden className="absolute start-0 top-[0.3em] size-4 text-muted-foreground" />
        )}
        <span className="sr-only">{checked ? t('Đã xong: ') : t('Chưa xong: ')}</span>
      </>
    ) : null,
  blockquote: (p: Props<'blockquote'>) => (
    <blockquote {...rest(p)} className="my-3 border-s-2 ps-3 text-muted-foreground first:mt-0 last:mb-0" />
  ),
  hr: () => <hr className="my-4 border-border first:mt-0 last:mb-0" />,
  a: ({ href, children }: Props<'a'>) => {
    const target = markdownHref(href);
    const look = 'text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary break-words';
    const inner = <InLink value>{children}</InLink>;
    if (target.kind === 'internal')
      return (
        <Link href={target.href} prefetch={false} className={look}>
          {inner}
        </Link>
      );
    if (target.kind === 'file')
      return (
        <a href={target.href} className={look}>
          {inner}
        </a>
      );
    if (target.kind === 'external')
      return (
        <a href={target.href} target="_blank" rel="noopener noreferrer" className={look}>
          {inner}
        </a>
      );
    return <span className="break-words">{children}</span>;
  },
  img: ({ src, alt }: Props<'img'>) => <NoteImage src={src} alt={alt} images={images} t={t} />,
  code: ({ className, ...p }: Props<'code'>) => (
    // inside a block (pre > code) the pre draws the ground; inline code gets its own
    <code
      {...rest(p)}
      className={cn(
        'font-mono text-[13px] [pre_&]:bg-transparent [pre_&]:p-0',
        'rounded-sm bg-muted px-1 py-0.5 break-words',
        className,
      )}
    />
  ),
  pre: (p: Props<'pre'>) => (
    <pre {...rest(p)} className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-[13px] leading-relaxed first:mt-0 last:mb-0" />
  ),
  table: (p: Props<'table'>) => (
    // a wide table scrolls inside itself, never the page (no horizontal scroll at 390 px)
    <div className="my-3 overflow-x-auto first:mt-0 last:mb-0">
      <table {...rest(p)} className="w-full border-collapse text-sm" />
    </div>
  ),
  // the editor's cell rules (note-editor.css): the same columns, so pictures in cells keep their size when it comes
  th: (p: Props<'th'>) => (
    <th
      {...rest(p)}
      className="min-w-16 border-b px-2 py-1.5 text-start align-top text-xs font-medium text-muted-foreground"
    />
  ),
  td: (p: Props<'td'>) => <td {...rest(p)} className="min-w-16 border-b px-2 py-1.5 align-top" />,
});

interface HastNode {
  type?: string;
  tagName?: string;
  properties?: { checked?: unknown };
  children?: HastNode[];
}

/** Whether a task item's box is ticked: its checkbox, first in the item or in the item's first paragraph (loose). */
function taskDone(node: unknown): boolean {
  for (const child of (node as HastNode | undefined)?.children ?? []) {
    if (child.type !== 'element') continue;
    if (child.tagName === 'input') return Boolean(child.properties?.checked);
    return child.tagName === 'p' && taskDone(child);
  }
  return false;
}

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

/**
 * The editor (Milkdown) saves an empty paragraph or list item as the raw HTML `<br />` (so it survives the next load).
 * Raw HTML is otherwise shown as text here; this one placeholder becomes what it means, an empty line.
 */
function remarkEmptyLines() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    node.children = node.children.map((child): MdNode => {
      if (child.type === 'html' && /^<br\s*\/?>$/i.test((child.value ?? '').trim())) {
        // an inline placeholder (inside a paragraph or a list item's paragraph) is a line break; a block one an empty
        // paragraph with a break, so it keeps its height
        return node.type === 'paragraph' ? { type: 'break' } : { type: 'paragraph', children: [{ type: 'break' }] };
      }
      walk(child);
      return child;
    });
  };
  return (tree: MdNode) => walk(tree);
}

const plugins = [remarkGfm, remarkEmptyLines];

/** Renders `markdown` (GFM: tables, task lists, strikethrough, autolinks) as the note's reading text. */
export default function NoteMarkdown({
  markdown,
  look = 'inline',
  images = 'lazy',
  className,
}: {
  markdown: string;
  look?: NoteLook;
  images?: ImageLoading;
  className?: string;
}) {
  const t = useT();
  const components = useMemo(() => makeComponents(t, look, images), [t, look, images]);
  return (
    <div className={cn('min-w-0 text-sm leading-relaxed break-words text-foreground', className)}>
      <Markdown remarkPlugins={plugins} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
