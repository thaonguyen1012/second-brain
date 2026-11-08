'use client';
// Cmd+K "find everything" (DECISIONS 4.4). Fumadocs' default dialog (handbooks, /api/search, SQLite FTS) plus a
// second-brain group from the `?q=` filters of the Django lists. Lazy-loaded by components/provider.tsx, so none
// of this is in the first-load JS. The brain group only loads while the dialog is open and a query is typed;
// without Django it stays silent and the handbook results work as before.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BriefcaseBusiness,
  Inbox,
  Lightbulb,
  Library,
  Newspaper,
  NotebookPen,
  Scale,
  Sprout,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useFetchSearch, useHighlightQuery, type SearchResultItem } from 'fumadocs-core/search/client';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import type { SearchLink, SharedProps } from 'fumadocs-ui/contexts/search';
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogListItem,
  SearchDialogOverlay,
  useSearch,
  type SearchItemType,
} from 'fumadocs-ui/components/dialog/search';
import { getBook } from '@/lib/books';
import { ApiError, isAbort } from '@/lib/api/client';
import { searchBrain, type BrainSearchResults } from '@/lib/api/search';
import { toApiError } from '@/lib/api/use-api';
import { decisionOf, hostOf, inboxStatusOf, itemStatusOf, itemTypeLabel, opportunityHref } from '@/lib/labels';
import { formatDay, freshness, monthLabel, outcomeOf } from '@/components/brain/growth/labels';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';

/** Shorter queries match too much of everything; the handbook search still runs for them. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 200;
/** The backend trims longer queries to 200 characters anyway. */
const MAX_QUERY = 200;
/** After "Django not reachable" (dev without the proxy, static export) stop asking for a while. */
const OFFLINE_PAUSE_MS = 60_000;
let offlineUntil = 0;

type Kind = 'item' | 'note' | 'inbox' | 'opportunity' | 'skill' | 'achievement' | 'prediction' | 'jobAd' | 'news';

const kinds: Record<Kind, { label: Msg; icon: LucideIcon }> = {
  item: { label: msg('Thư viện'), icon: Library },
  note: { label: msg('Ghi chú'), icon: NotebookPen },
  inbox: { label: msg('Inbox'), icon: Inbox },
  opportunity: { label: msg('Cơ hội'), icon: Lightbulb },
  skill: { label: msg('Kỹ năng'), icon: Sprout },
  achievement: { label: msg('Thành tựu'), icon: Trophy },
  prediction: { label: msg('Dự đoán'), icon: Scale },
  jobAd: { label: msg('Tuyển dụng'), icon: BriefcaseBusiness },
  news: { label: msg('Bản tin'), icon: Newspaper },
};

interface BrainHit {
  /** Unique in the list next to the handbook ids (URLs). */
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  href: string;
  /** Opens in a new tab (a news story's own page); everything else is an in-app route. */
  external?: boolean;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ');
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** About 120 characters of `text` around the first match of `q` (markdown marks dropped), else its start. */
function excerpt(text: string, q: string): string {
  const flat = oneLine(text.replace(/[#>*_`~[\]]+/g, ' '));
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return flat.slice(0, 120);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? '…' : ''}${flat.slice(start, start + 120)}`;
}

/** Accent- and case-free form of one character, so "khach" finds "khách" (đ -> d). */
const fold = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().charAt(0) || c;

/**
 * The excerpt row shows one line, and the FTS snippet starts several words before the match: at 390 px the match
 * fell past the clamp, so the row did not show why it matched. Start the line a few words before the first query
 * term (accent-free comparison), at a word start, with a leading "…". Table residue ("--- ---") is dropped.
 */
function clipToMatch(text: string, query: string, lead = 24): string {
  const flat = oneLine(text.replace(/(?:\s*\|?\s*-{3,}\s*\|?)+/g, ' '));
  const terms = query
    .split(/\s+/)
    .map((t) => Array.from(t).map(fold).join(''))
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return flat;
  const folded = Array.from(flat).map(fold).join('');
  let at = -1;
  for (const t of terms) {
    const i = folded.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at <= lead) return flat;
  const chars = Array.from(flat);
  let start = at - lead;
  while (start < at && chars[start - 1] !== ' ') start++;
  return `…${chars.slice(start).join('').replace(/^…/, '')}`;
}

function toHits(r: BrainSearchResults, q: string, t: T): BrainHit[] {
  return [
    ...r.items.map((it) => ({
      id: `brain-item-${it.id}`,
      kind: 'item' as const,
      title: it.title,
      detail: join(t(itemTypeLabel(it.type)), t(itemStatusOf(it.status).label), it.source),
      href: `/thu-vien/?item=${it.id}`,
    })),
    ...r.notes.map((n) => ({
      // the server sends title (or first line) and an excerpt around the match, never the body
      id: `brain-note-${n.id}`,
      kind: 'note' as const,
      title: n.title || t('Ghi chú #{id}', { id: n.id }),
      detail: n.excerpt,
      href: `/thu-vien/ghi-chu/?id=${n.id}`,
    })),
    ...r.inbox.map((e) => ({
      id: `brain-inbox-${e.id}`,
      kind: 'inbox' as const,
      title: oneLine(e.ogTitle || e.text || e.url || t('Mục #{id}', { id: e.id })).slice(0, 160),
      detail: join(t(inboxStatusOf(e.status).label), e.ogSiteName || hostOf(e.url)),
      href: `/inbox/?status=${e.status}&id=${e.id}`,
    })),
    ...r.opportunities.map((o) => ({
      id: `brain-opportunity-${o.id}`,
      kind: 'opportunity' as const,
      title: o.title,
      detail: join(t(decisionOf(o.decision).label), excerpt(o.hypothesis, q)),
      href: opportunityHref(o.id),
    })),
    ...r.skills.map((s) => ({
      id: `brain-skill-${s.id}`,
      kind: 'skill' as const,
      title: s.name,
      detail: join(t(freshness[s.freshness].label), s.aliases.join(', ')),
      href: `/phat-trien/ky-nang/?id=${s.id}`,
    })),
    ...r.achievements.map((a) => ({
      id: `brain-achievement-${a.id}`,
      kind: 'achievement' as const,
      title: a.title,
      detail: join(formatDay(a.date), a.impact && excerpt(a.impact, q)),
      href: `/phat-trien/thanh-tuu/?achievement=${a.id}`,
    })),
    ...r.predictions.map((p) => ({
      id: `brain-prediction-${p.id}`,
      kind: 'prediction' as const,
      title: oneLine(p.statement).slice(0, 160),
      detail: join(
        t(outcomeOf(p.outcome).label),
        p.outcome === 'open'
          ? t('chấm lại {date}', { date: formatDay(p.checkOn) })
          : t('ghi {date}', { date: formatDay(p.madeOn) }),
      ),
      href: `/phat-trien/thanh-tuu/?prediction=${p.id}`,
    })),
    ...r.jobAds.map((ad) => ({
      id: `brain-jobad-${ad.id}`,
      kind: 'jobAd' as const,
      title: ad.title,
      detail: join(ad.company, monthLabel(ad.month, t)),
      href: `/phat-trien/thi-truong/?jobAd=${ad.id}`,
    })),
    ...r.news
      .filter((n) => /^https?:\/\//i.test(n.url))
      .map((n) => ({
        id: `brain-news-${n.id}`,
        kind: 'news' as const,
        title: oneLine(n.title).slice(0, 160),
        detail: join(n.source.name, formatDay(n.published ?? n.createdAt), hostOf(n.url)),
        href: n.url,
        external: true,
      })),
  ];
}

/** Stable empty list: SearchDialogList resets the active row whenever its `items` array changes identity. */
const NO_HITS: BrainHit[] = [];

interface BrainState {
  q: string;
  hits?: BrainHit[];
  error?: ApiError;
}

/**
 * Debounced second-brain search for `query` (empty = off). Hits of an earlier query stay shown while the next
 * one loads, as long as one query extends the other (typing on), never those of an unrelated old query.
 */
function useBrainSearch(query: string, t: T) {
  const q = query.trim().slice(0, MAX_QUERY);
  const active = q.length >= MIN_QUERY;
  const [state, setState] = useState<BrainState>({ q: '' });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    // A newer query (or closing the dialog) cancels the requests of this one, so Django only works on the
    // query that is still wanted.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const search =
        Date.now() < offlineUntil
          ? Promise.reject(new ApiError(0, 'offline', false))
          : searchBrain(q, 5, controller.signal);
      search.then(
        (r) => alive && setState({ q, hits: toHits(r, q, t) }),
        (err: unknown) => {
          if (isAbort(err) || controller.signal.aborted) return; // superseded, not offline
          const error = toApiError(err);
          if (!error.reachable && Date.now() >= offlineUntil) offlineUntil = Date.now() + OFFLINE_PAUSE_MS;
          if (alive) setState({ q, error });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, active, t]);

  if (!active) return { hits: NO_HITS, loading: false, error: undefined };
  const related = state.q !== '' && (q.startsWith(state.q) || state.q.startsWith(q));
  return {
    hits: related ? (state.hits ?? NO_HITS) : NO_HITS,
    loading: state.q !== q,
    error: state.q === q ? state.error : undefined,
  };
}

type ListItems = (SearchItemType | SearchResultItem)[] | null;

/** One handbook page of the results: its page row plus the best heading and text hit of that page. */
interface HandbookHit {
  id: string;
  title: string;
  /** "{book title} · {best heading}" */
  meta: string;
  /** One line of matching text; empty when there is none or it only repeats the title. */
  excerpt: string;
}

const NO_HANDBOOK = new Map<string, HandbookHit>();

/** "/docs/<track>/<book>/..." -> the book's title from lib/books.ts, in the page's language. */
function bookTitle(url: string, t: T): string | undefined {
  const slug = url.replace(/^\/docs\//, '').split('/')[1];
  const title = slug ? getBook(slug)?.title : undefined;
  return title && t(title);
}

/**
 * /api/search returns a flat list per page (page row, then up to 3 heading and text hits), and the same id can
 * come twice when a page has several hits without an anchor: React then keeps rows of an older query on screen
 * (stale rows after editing the query). Collapse it to one row per page with a unique id (DESIGN.md §3 "List
 * row"): the page title, its book and best heading as meta, one line of text. The row opens the best hit's
 * anchor when there is one. Tables (none from this index today) pass through to Fumadocs' own renderer.
 */
function collapseHandbook(items: SearchResultItem[], t: T): { list: ListItems; byId: Map<string, HandbookHit> } {
  const pages = new Map<string, { url: string; title: string; heading?: string; text?: string }>();
  const order: (string | SearchResultItem)[] = [];
  for (const item of items) {
    if (item.type === 'table') {
      order.push(item);
      continue;
    }
    const pageUrl = item.url.split('#')[0];
    let page = pages.get(pageUrl);
    if (!page) {
      page = { url: pageUrl, title: item.type === 'page' ? item.content : '' };
      pages.set(pageUrl, page);
      order.push(pageUrl);
    }
    if (item.type === 'page') page.title ||= item.content;
    else if (item.type === 'heading' && page.heading === undefined) {
      page.heading = item.content;
      page.url = item.url; // the best hit's anchor
    } else if (item.type === 'text' && page.text === undefined) page.text = item.content;
  }

  const byId = new Map<string, HandbookHit>();
  const list: NonNullable<ListItems> = [];
  const seen = new Set<string>();
  for (const entry of order) {
    if (typeof entry !== 'string') {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      list.push(entry);
      continue;
    }
    const page = pages.get(entry)!;
    const id = `handbook:${entry}`;
    const title = page.title || page.heading || entry;
    const heading = page.heading && page.heading !== title ? page.heading : undefined;
    const excerpt = page.text ? oneLine(page.text) : '';
    byId.set(id, {
      id,
      title,
      meta: join(bookTitle(entry, t), heading),
      excerpt: excerpt === title ? '' : excerpt,
    });
    seen.add(id);
    list.push({ id, type: 'page', url: page.url, content: title });
  }
  return { list, byId };
}

interface ActiveMemory {
  /** Active row just before `items` changed. */
  id: string | null;
  /** The handbook list `items` was built from, to tell "brain group arrived" from "new query". */
  handbook: ListItems;
  /** True when only the brain group changed since the previous `items`. */
  brainOnly: boolean;
}

/**
 * Fumadocs' SearchDialogList makes the first row active whenever `items` changes. The brain group lands after
 * the handbook results and is put on top, so without help the highlighted row would jump to the first brain
 * row (and Enter would open something else). ActiveBefore, rendered before the list, notes the active row in
 * its layout effect, which runs before the list's; ActiveAfter, rendered after it, puts it back when only the
 * brain group changed. A new query (new handbook list) still starts at the top.
 */
function ActiveBefore({
  items,
  handbook,
  memoryRef,
}: {
  items: ListItems;
  handbook: ListItems;
  memoryRef: RefObject<ActiveMemory>;
}) {
  const { getActive } = useSearch();
  useLayoutEffect(() => {
    const previous = memoryRef.current;
    memoryRef.current = { id: getActive(), handbook, brainOnly: previous.handbook === handbook };
  }, [items, handbook, getActive, memoryRef]);
  return null;
}

function ActiveAfter({ items, memoryRef }: { items: ListItems; memoryRef: RefObject<ActiveMemory> }) {
  const { setActive } = useSearch();
  useLayoutEffect(() => {
    const { id, brainOnly } = memoryRef.current;
    if (brainOnly && id && items?.some((i) => i.id === id)) setActive(id);
  }, [items, setActive, memoryRef]);
  return null;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" aria-hidden className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * One result row, the same anatomy for both groups: icon, title (14px medium), meta (12px muted), optionally one
 * line of matching text (13px). The query is highlighted by Fumadocs' useHighlightQuery (styled on the list).
 */
function ResultRow({
  item,
  onClick,
  icon: Icon,
  title,
  meta,
  excerpt,
}: {
  item: SearchItemType;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  meta?: string;
  excerpt?: string;
}) {
  const { query } = useSearch();
  const highlight = useHighlightQuery(query);
  return (
    <SearchDialogListItem item={item} onClick={onClick}>
      <div ref={highlight} className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-sm font-medium">{title}</div>
          {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
          {excerpt && (
            <div className="line-clamp-1 text-[13px] text-muted-foreground">{clipToMatch(excerpt, query)}</div>
          )}
        </div>
      </div>
    </SearchDialogListItem>
  );
}

const NO_LINKS: SearchLink[] = [];

export default function AppSearchDialog({
  links = NO_LINKS,
  open,
  onOpenChange,
  ...props
}: SharedProps & { links?: SearchLink[] }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const search = useFetchSearch({ locale });
  const brain = useBrainSearch(open ? search.search : '', t);
  const { onSearchChange } = search;
  // Every opening starts empty (the destinations list), never with the results of the last query.
  const onOpen = (next: boolean) => {
    if (!next) onSearchChange('');
    onOpenChange(next);
  };

  const defaultItems = useMemo<SearchItemType[] | null>(
    () =>
      links.length === 0
        ? null
        : links.map(([name, link]) => ({ type: 'page', id: name, content: name, url: link })),
    [links],
  );

  const brainItems = useMemo(
    () =>
      brain.hits.map((hit) => ({
        hit,
        item: {
          id: hit.id,
          type: 'action',
          node: hit.title,
          onSelect: () => (hit.external ? window.open(hit.href, '_blank', 'noopener') : router.push(hit.href)),
        } as const,
      })),
    [brain.hits, router],
  );
  const byId = useMemo(() => new Map(brain.hits.map((h) => [h.id, h])), [brain.hits]);

  const collapsed = useMemo(() => (search.data ? collapseHandbook(search.data.items, t) : null), [search.data, t]);
  const handbookById = collapsed?.byId ?? NO_HANDBOOK;

  // Second-brain rows first: they are few (at most 5 per kind), the handbook list runs to 20 pages.
  const handbook: ListItems = collapsed?.list ?? defaultItems;
  const activeMemory = useRef<ActiveMemory>({ id: null, handbook: null, brainOnly: false });
  const items = useMemo<ListItems>(
    () => (brainItems.length === 0 ? handbook : [...brainItems.map((b) => b.item), ...(handbook ?? [])]),
    [brainItems, handbook],
  );
  const firstHandbook = brainItems.length > 0 && collapsed ? handbook?.[0]?.id : undefined;
  const firstLink = !collapsed && brainItems.length === 0 ? defaultItems?.[0]?.id : undefined;
  const firstBrain = brainItems[0]?.hit.id;

  // Signed out or a server error: one quiet line. Django absent (dev without the proxy, static export): nothing.
  const brainNote = !brain.error?.reachable
    ? null
    : [401, 403].includes(brain.error.status)
      ? t('Chưa đăng nhập: chỉ tìm được trong sổ tay.')
      : t('Không tìm được trong bộ não thứ hai (máy chủ trả lỗi {status}).', { status: brain.error.status });

  return (
    <SearchDialog
      {...search}
      isLoading={search.isLoading || brain.loading}
      {...props}
      open={open}
      onOpenChange={onOpen}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label={t('Tìm mọi thứ')} placeholder={t('Tìm sổ tay, ghi chú, inbox…')} />
          <SearchDialogClose className="max-sm:hidden pointer-coarse:hidden" />
        </SearchDialogHeader>
        <ActiveBefore items={items} handbook={handbook} memoryRef={activeMemory} />
        <SearchDialogList
          items={items}
          // Matches read as emphasis, not as links (Fumadocs' default is blue and underlined)
          className="[&_::highlight(fd-search)]:bg-muted-foreground/15 [&_::highlight(fd-search)]:text-foreground [&_::highlight(fd-search)]:no-underline"
          Empty={() => (
            <div role="status" className="py-12 text-center text-sm text-muted-foreground">
              {brain.loading ? t('Đang tìm…') : t('Không tìm thấy kết quả')}
            </div>
          )}
          Item={({ item, table, onClick }) => {
            // Rows of a table and anything unknown go through Fumadocs' own renderer
            const hit = table ? undefined : byId.get(item.id);
            const page = table || hit ? undefined : handbookById.get(item.id);
            const label =
              hit && hit.id === firstBrain
                ? t('Bộ não thứ hai')
                : !table && item.id === firstHandbook
                  ? t('Sổ tay')
                  : !table && item.id === firstLink
                    ? t('Đi đến')
                    : null;
            return (
              <>
                {label && <GroupLabel>{label}</GroupLabel>}
                {hit ? (
                  <ResultRow
                    item={item}
                    onClick={onClick}
                    icon={kinds[hit.kind].icon}
                    title={hit.title}
                    meta={join(t(kinds[hit.kind].label), hit.detail)}
                  />
                ) : page ? (
                  <ResultRow
                    item={item}
                    onClick={onClick}
                    icon={BookOpen}
                    title={page.title}
                    meta={page.meta}
                    excerpt={page.excerpt}
                  />
                ) : (
                  <SearchDialogListItem item={item} table={table} onClick={onClick} />
                )}
              </>
            );
          }}
        />
        <ActiveAfter items={items} memoryRef={activeMemory} />
        {brainNote && (
          <SearchDialogFooter>
            <p role="status" className="text-xs text-muted-foreground">
              {brainNote}
            </p>
          </SearchDialogFooter>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
