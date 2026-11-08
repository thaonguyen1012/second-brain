'use client';
import Link from 'next/link';
import { useMemo, type ComponentProps } from 'react';
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
// A note sits under the page's h1, the "Ghi chú" h2 and its own h3 title, so its headings start at h4.
const heading = 'font-heading font-semibold tracking-tight text-foreground';

/** The renderers of each markdown element, with the few words they add in the UI language. */
const makeComponents = (t: T): Components => ({
  h1: (p: Props<'h1'>) => <h4 {...rest(p)} className={cn(heading, 'mt-5 mb-2 text-[15px] leading-5 first:mt-0')} />,
  h2: (p: Props<'h2'>) => <h4 {...rest(p)} className={cn(heading, 'mt-5 mb-2 text-[15px] leading-5 first:mt-0')} />,
  h3: (p: Props<'h3'>) => <h5 {...rest(p)} className={cn(heading, 'mt-4 mb-1.5 text-sm first:mt-0')} />,
  h4: (p: Props<'h4'>) => <h6 {...rest(p)} className={cn(heading, 'mt-4 mb-1.5 text-sm first:mt-0')} />,
  h5: (p: Props<'h5'>) => <h6 {...rest(p)} className={cn(heading, 'mt-4 mb-1.5 text-sm first:mt-0')} />,
  h6: (p: Props<'h6'>) => <h6 {...rest(p)} className={cn(heading, 'mt-4 mb-1.5 text-sm first:mt-0')} />,
  p: (p: Props<'p'>) => <p {...rest(p)} className="my-2 first:mt-0 last:mb-0" />,
  ul: ({ className, ...p }: Props<'ul'>) => (
    <ul
      {...rest(p)}
      className={cn(
        'my-2 flex flex-col gap-1 first:mt-0 last:mb-0',
        // GFM task lists (- [ ] / - [x]) carry their own box instead of a bullet
        className?.includes('contains-task-list') ? 'list-none ps-0' : 'list-disc ps-5',
      )}
    />
  ),
  ol: (p: Props<'ol'>) => <ol {...rest(p)} className="my-2 flex list-decimal flex-col gap-1 ps-5 first:mt-0 last:mb-0" />,
  li: ({ className, ...p }: Props<'li'>) => (
    <li
      {...rest(p)}
      className={cn(
        'ps-0.5 marker:text-muted-foreground [&>ol]:my-1 [&>ul]:my-1',
        className?.includes('task-list-item') && 'relative ps-6',
      )}
    />
  ),
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
  hr: () => <hr className="my-4 border-border" />,
  a: ({ href, children }: Props<'a'>) => {
    const target = markdownHref(href);
    const look = 'text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary break-words';
    if (target.kind === 'internal')
      return (
        <Link href={target.href} prefetch={false} className={look}>
          {children}
        </Link>
      );
    if (target.kind === 'file')
      return (
        <a href={target.href} className={look}>
          {children}
        </a>
      );
    if (target.kind === 'external')
      return (
        <a href={target.href} target="_blank" rel="noopener noreferrer" className={look}>
          {children}
        </a>
      );
    return <span className="break-words">{children}</span>;
  },
  img: ({ src, alt }: Props<'img'>) => {
    const url = typeof src === 'string' ? src : '';
    const local = noteImageSrc(url);
    if (local)
      // eslint-disable-next-line @next/next/no-img-element -- a local file of the app; next/image adds nothing here
      return <img src={local} alt={alt ?? ''} loading="lazy" decoding="async" className="my-2 max-h-96 max-w-full rounded-md" />;
    const link = markdownHref(url);
    const label = alt ? t('Ảnh: {alt}', { alt }) : t('Ảnh');
    // never loaded from another domain: the reader opens it on purpose
    return link.kind === 'external' ? (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
        [{label}]
      </a>
    ) : (
      <span className="text-muted-foreground">[{label}]</span>
    );
  },
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
  th: (p: Props<'th'>) => (
    <th {...rest(p)} className="border-b px-2 py-1.5 text-start text-xs font-medium text-muted-foreground" />
  ),
  td: (p: Props<'td'>) => <td {...rest(p)} className="border-b px-2 py-1.5 align-top" />,
});

const plugins = [remarkGfm];

/** Renders `markdown` (GFM: tables, task lists, strikethrough, autolinks) as the note's reading text. */
export default function NoteMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  const t = useT();
  const components = useMemo(() => makeComponents(t), [t]);
  return (
    <div className={cn('min-w-0 text-sm leading-relaxed break-words text-foreground', className)}>
      <Markdown remarkPlugins={plugins} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
