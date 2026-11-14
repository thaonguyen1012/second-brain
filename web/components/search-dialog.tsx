'use client';
// Cmd+K "find everything" (DECISIONS 4.4). Fumadocs' default dialog (handbooks, /api/search, SQLite FTS) plus a
// second-brain group from the `?q=` filters of the Django lists. Lazy-loaded by components/provider.tsx, so none
// of this is in the first-load JS. The brain group only loads while the dialog is open and a query is typed;
// without Django it stays silent and the handbook results work as before. One command sits in the list too: single-key
// shortcuts off or on (lib/single-key-shortcuts.ts), so every page and phones reach that switch; it leads the list only
// for a query that names it (lib/search-command.ts).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BriefcaseBusiness,
  Inbox,
  Keyboard,
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
import { useLocale, useT } from '@/lib/i18n/client';
import { contentText } from '@/lib/i18n/content-lang';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import {
  type CommandPlace,
  MIN_QUERY,
  fold,
  matchCommand,
  placeCommand,
  shortcutsCommandTerms,
} from '@/lib/search-command';
import { setSingleKeyShortcuts, singleKeyShortcutsOn, useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';

// Queries shorter than MIN_QUERY skip the second brain (they match too much of everything); the handbook search still
// runs for them.
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
  skill: { label: msg('Kỹ năng', 'kind'), icon: Sprout },
  achievement: { label: msg('Thành tựu', 'kind'), icon: Trophy },
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

/** Id of the list's one command: single-key shortcuts off or on. */
const SHORTCUTS_COMMAND = 'command:single-key-shortcuts';

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
      // a summary says more than a link (a tool's "dùng để làm gì"), and the search matches it too
      detail: join(t(itemTypeLabel(it.type)), t(itemStatusOf(it.status, it.type).label), it.summary || it.source),
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
  /** The query the list was last set for. */
  query: string;
  /** Active row just before `items` or the query changed (before Fumadocs' reset). */
  id: string | null;
  /** Where the command was in the list then. */
  at: CommandPlace;
  /**
   * The switch flipped under the highlighted command of a query naming what it did, and this query has had no row
   * highlighted since: the rows landing later stay unhighlighted too, as long as the command stays off the top (a
   * pick that turns it back, a tap with no pointer move among them, makes the query name it again: first, highlighted).
   */
  held: boolean;
}

/** Scrolls the results list (not the page) so the command's row at its end shows, with its group label. */
function showCommand() {
  const row = document.getElementById(`fd-search-option-${SHORTCUTS_COMMAND}`);
  const list = row?.closest<HTMLElement>('#fd-search-list');
  if (!row || !list) return;
  const box = list.getBoundingClientRect();
  const top = (row.previousElementSibling ?? row).getBoundingClientRect().top - box.top;
  const bottom = row.getBoundingClientRect().bottom - box.top;
  if (bottom > list.clientHeight) list.scrollTop += bottom - list.clientHeight;
  else if (top < 0) list.scrollTop += top;
}

/**
 * Which row is active, the one Enter picks (WCAG 3.2.2, 2.4.3). Fumadocs' SearchDialogList makes the first row active
 * whenever `items` changes, and leaves it alone while only the query changes. For one query the list changes several
 * times, a few hundred ms apart (the second-brain group lands on top, then the handbook results), and each change
 * put the highlight back on the first row, also away from a row the user had just arrowed to: Enter then opened
 * another row, or flipped the shortcut command that leads a query naming it. So:
 * - the same query: the highlighted row stays highlighted while it is still listed, whatever landed around it; once
 *   it is gone, the first row, but never the shortcut command the user had moved off. The one exception is the
 *   command after the switch flipped under it (a pick, or another tab) while a query named what it did ("tắt phím
 *   tắt" with the shortcuts on): that query now asks for the state the switch is in, the command goes after the
 *   results, and no row is highlighted until the user moves (an arrow, the pointer) or types, the command kept in
 *   view, so Enter pressed again, like the rows landing later, never does the opposite of the words typed;
 * - a new query text: the first row (Enter never picks a row arrowed to for an earlier query, like the command at the
 *   end of a weak one), and none while the query's own rows do not lead the list yet (`waiting`): the destinations
 *   standing in for its first results, or another query's rows kept until its own land (Enter opened "Hôm nay", or a
 *   result of the query typed over), so Enter and the arrows wait for them (AppSearchDialog's key handler); the first
 *   of them takes it as they land, and a row the user points at meanwhile stays. A query that names the command has
 *   it first, active at once.
 * ActiveBefore, rendered before the list, notes the active row in its layout effect, which runs before the list's;
 * ActiveAfter, rendered after it, sets the row. A dialog opened again starts at the top.
 */
function ActiveBefore({
  items,
  query,
  memoryRef,
}: {
  items: ListItems;
  query: string;
  memoryRef: RefObject<ActiveMemory>;
}) {
  const { getActive } = useSearch();
  const mounted = useRef(false);
  useLayoutEffect(() => {
    // on mount the store still holds the active row of the last time the dialog was open
    memoryRef.current.id = mounted.current ? getActive() : null;
    mounted.current = true;
  }, [items, query, getActive, memoryRef]);
  return null;
}

function ActiveAfter({
  items,
  query,
  at,
  waiting,
  memoryRef,
}: {
  items: ListItems;
  query: string;
  /** Where the command is now (placeCommand). */
  at: CommandPlace;
  waiting: boolean;
  memoryRef: RefObject<ActiveMemory>;
}) {
  const { setActive } = useSearch();
  useLayoutEffect(() => {
    const { id, query: before, at: was, held: wasHeld } = memoryRef.current;
    const held = query === before && wasHeld && at !== 'first';
    const memory: ActiveMemory = { query, id: null, at, held };
    if (query !== before) setActive(waiting ? null : (items?.[0]?.id ?? null));
    // The switch flipped under the highlighted command of a query naming what it did: the query now asks for the
    // state it is in, so the command went after the results; it loses the highlight (Enter again turned the switch
    // back against the words typed) and stays in view with its new action, the rows landing later unhighlighted too
    else if (id === SHORTCUTS_COMMAND && was === 'first' && at !== 'first') {
      setActive(null);
      memory.held = true;
      showCommand();
    } else if (id && items?.some((i) => i.id === id)) setActive(id);
    // Still another query's rows on top (part of this one's landed), or rows landing under a command that lost the
    // highlight as above: Fumadocs' reset made the first of them active
    else if (waiting || (held && !id)) setActive(null);
    // The row the user moved to left the list (a destination, as the results land): the first row again, as Fumadocs
    // does, but never the shortcut command they had moved off, which leads a query naming it (Enter would flip it)
    else if (id && id !== SHORTCUTS_COMMAND && items?.[0]?.id === SHORTCUTS_COMMAND)
      setActive(items.find((i) => i.id !== SHORTCUTS_COMMAND)?.id ?? null);
    memoryRef.current = memory;
  }, [items, query, at, waiting, setActive, memoryRef]);
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
  handbook = false,
  keepFocus = false,
}: {
  item: SearchItemType;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  meta?: string;
  excerpt?: string;
  /** Handbook text (page title, heading, excerpt): its Vietnamese parts get lang="vi" on English pages. */
  handbook?: boolean;
  /**
   * A pick that keeps the dialog open (the shortcut command): a press on the row leaves the focus where it is (the
   * search field), or a click or tap would hand it to the dialog's box and the next typed keys would go nowhere.
   */
  keepFocus?: boolean;
}) {
  // composed like the text it is matched in (a query typed decomposed found nothing to highlight or clip to)
  const query = useSearch().query.normalize('NFC');
  const highlight = useHighlightQuery(query);
  const locale = useLocale();
  const text = (s: string) => (handbook ? contentText(s, locale) : s);
  return (
    <SearchDialogListItem
      item={item}
      onClick={onClick}
      onMouseDown={keepFocus ? (e) => e.preventDefault() : undefined}
    >
      <div ref={highlight} className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="truncate text-sm font-medium">{text(title)}</div>
          {/* The option's name runs title and meta together: a comma parts them for a screen reader ("Tắt phím tắt
              một phím, Đang bật trong trình duyệt này") */}
          {meta && (
            <div className="truncate text-xs text-muted-foreground">
              <span className="sr-only">, </span>
              {text(meta)}
            </div>
          )}
          {excerpt && (
            <div className="line-clamp-1 text-[13px] text-muted-foreground">{text(clipToMatch(excerpt, query))}</div>
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
  // The query as it shows: one typed or pasted decomposed (NFD: a combining-mode IME, a name copied on macOS) is read
  // composed by the second brain's ?q= (Django's icontains has no NFC step, so accented words found nothing) and the
  // command match, and MIN_QUERY counts the letters on screen ("ò" decomposed is two units). The handbook search
  // normalises on the server.
  const query = search.search.normalize('NFC');
  const brain = useBrainSearch(open ? query : '', t);
  const { onSearchChange } = search;
  const keys = useSingleKeyShortcuts();
  // What the shortcut command just did, read out politely (the row itself shows the new state)
  const [announce, setAnnounce] = useState('');
  // Fumadocs closes the dialog after every pick (onOpenChange(false) right after the item's onSelect): the shortcut
  // command changes a setting in place, so the dialog stays open on its new state.
  const stayOpen = useRef(false);
  // The command was picked since the query last changed: it stays listed, even alone (placeCommand's `picked`)
  const [picked, setPicked] = useState(false);
  const onQueryChange = (value: string) => {
    setPicked(false);
    onSearchChange(value);
  };
  // Every opening starts empty (the destinations list), never with the results of the last query.
  const onOpen = (next: boolean) => {
    if (!next && stayOpen.current) {
      stayOpen.current = false;
      return;
    }
    if (!next) {
      onQueryChange('');
      setAnnounce('');
    }
    onOpenChange(next);
  };

  // The command keeps one item, so the list does not jump back to its first row when the command flips.
  const shortcutsCommand = useMemo<SearchItemType>(
    () => ({
      id: SHORTCUTS_COMMAND,
      type: 'action',
      node: null,
      onSelect: () => {
        stayOpen.current = true;
        queueMicrotask(() => {
          stayOpen.current = false;
        });
        const on = !singleKeyShortcutsOn();
        setSingleKeyShortcuts(on);
        setAnnounce(on ? t('Đã bật phím tắt một phím') : t('Đã tắt phím tắt một phím'));
        setPicked(true);
      },
    }),
    [t],
  );
  // What names the command follows what its row does now: "tắt phím tắt" while the shortcuts are on; while they are off
  // it asks for what is already so, and the command goes after the results (lib/search-command.ts). After a pick under
  // such a verb the row moves with the new state, in view, and no row is highlighted until the user moves or types
  // (ActiveAfter): a second Enter does nothing.
  const commandTerms = useMemo(() => shortcutsCommandTerms(t, keys), [t, keys]);

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

  // Second-brain rows first: they are few (at most 5 per kind), the handbook list runs to 20 pages. The shortcut
  // command (placeCommand, lib/search-command.ts) leads only for a query that names what its row does now ("tắt phím
  // tắt" while the shortcuts are on, "single-key shortcuts"), so Enter flips the switch only then. A query that merely
  // uses or starts its words ("ta", "on", "phím tắt", "keyboard shortcuts": the handbook pages about shortcuts are
  // searched so) or asks for the state the switch is already in ("bật phím tắt" while on) gets it at the end, after the
  // results it asked for, and so do the destinations (nothing typed yet, or the first results still on their way);
  // other queries leave it out once their results are there. Never the only row unless named (or just picked, until
  // the query changes, with no row highlighted): Fumadocs makes the first row the active one, so a weak command alone
  // would be Enter's (and stay so as the brain group lands above it, ActiveAfter). At the end only the arrows or the
  // pointer highlight it, a choice the query's late results keep and its next letter ends.
  const handbook: ListItems = collapsed?.list ?? defaultItems;
  const activeMemory = useRef<ActiveMemory>({ query: '', id: null, at: null, held: false });
  const results = useMemo(() => [...brainItems.map((b) => b.item), ...(handbook ?? [])], [brainItems, handbook]);
  const commandAt = placeCommand(matchCommand(query, commandTerms), {
    rows: results.length,
    destinations: !collapsed && brainItems.length === 0,
    picked,
  });
  // A typed query whose own rows do not lead the list yet, so none is active and Enter waits for them: the
  // destinations stand in for its first results, or the rows on top are another query's until this one's land, the
  // brain hits of a query it extends or shortens (useBrainSearch keeps them) or the handbook results of the last one
  // (fumadocs-core's useSearch keeps them: Enter right after typing over a query opened a result of the old one)
  const waiting =
    query.trim() !== '' &&
    commandAt !== 'first' &&
    (brainItems.length > 0 ? brain.loading : search.data?.query !== search.search);
  const items = useMemo<ListItems>(() => {
    if (commandAt === 'first') return [shortcutsCommand, ...results];
    if (commandAt === 'last') return [...results, shortcutsCommand];
    return brainItems.length === 0 ? handbook : results;
  }, [brainItems, handbook, results, commandAt, shortcutsCommand]);
  // Group labels: the brain group, the command and the destinations always say what they are (the destinations
  // under brain rows that came before this query's handbook results too); the handbook results get theirs whenever
  // another group shares the list, the command at either end included, so no group goes unlabelled next to a
  // labelled one.
  const firstHandbook = collapsed && (brainItems.length > 0 || commandAt !== null) ? handbook?.[0]?.id : undefined;
  const firstLink = !collapsed ? defaultItems?.[0]?.id : undefined;
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
      onSearchChange={onQueryChange}
      isLoading={search.isLoading || brain.loading}
      {...props}
      open={open}
      onOpenChange={onOpen}
    >
      <SearchDialogOverlay />
      {/* The dialog fits the screen at any zoom (WCAG 1.4.10): Fumadocs puts it 250px above the middle from md, so a
          short window (a laptop at 175-200%) pushed its top off-screen, and its 460px list ran up to 170px below the
          bottom of a 400px-high one, where the page behind cannot scroll: the last rows, the command among them, and an
          ArrowUp to them stayed out of sight. The top keeps 1rem, and the list (below) leaves 7rem for the top, the
          search field and a bottom margin. Its keys reach this capture handler before Fumadocs' listener on the box:
          a held Enter repeats its keydown and Fumadocs picks the active row on each, so on the command, which keeps
          the dialog open, a held key flipped the switch on and off until it was let go; only its first press picks.
          While the query's own rows are on their way (`waiting`, no row active) the arrows wait with Enter: from no
          active row Fumadocs' ArrowDown and ArrowUp both highlight the first row on screen, a result of the query
          typed over or a destination, and Enter then opened it. */}
      <SearchDialogContent
        className="md:top-[max(1rem,calc(50%-250px))]"
        onKeyDownCapture={(e) => {
          if (e.nativeEvent.isComposing) return;
          const held = e.key === 'Enter' && e.repeat;
          const early = waiting && (e.key === 'ArrowDown' || e.key === 'ArrowUp');
          if (!held && !early) return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label={t('Tìm mọi thứ')} placeholder={t('Tìm sổ tay, ghi chú, inbox…')} />
          {/* The button shows "ESC": its name starts with it (WCAG 2.5.3), then says what it does. Fumadocs answers
              Enter on the whole dialog (it picks the active row and cancels the key), so Enter on this button flipped
              the shortcut command or opened a result instead of closing: the key stops here, before the dialog's
              listener, and the button's own activation closes the dialog (WCAG 2.1.1, 3.2.2). */}
          <SearchDialogClose
            aria-label={t('ESC, đóng tìm kiếm')}
            className="max-sm:hidden pointer-coarse:hidden"
            onKeyDownCapture={(e) => e.key === 'Enter' && e.stopPropagation()}
          />
          <p role="status" className="sr-only">
            {announce}
          </p>
        </SearchDialogHeader>
        <ActiveBefore items={items} query={query} memoryRef={activeMemory} />
        <SearchDialogList
          items={items}
          // Matches read as emphasis, not as links (Fumadocs' default is blue and underlined). The results list is a tab
          // stop while it scrolls (a scroller with no tab stop inside): its focus is the app's 2px ring inside its edge,
          // where the dialog's clipped box cannot cut it off as it did the browser's thin outline (WCAG 2.4.7).
          className="[&_::highlight(fd-search)]:bg-muted-foreground/15 [&_::highlight(fd-search)]:text-foreground [&_::highlight(fd-search)]:no-underline [&_#fd-search-list:focus-visible]:outline-2 [&_#fd-search-list:focus-visible]:-outline-offset-2 [&_#fd-search-list:focus-visible]:outline-ring [&_#fd-search-list]:max-h-[min(460px,calc(100dvh-7rem))]"
          Empty={() => (
            <div role="status" className="py-12 text-center text-sm text-muted-foreground">
              {brain.loading ? t('Đang tìm…') : t('Không tìm thấy kết quả')}
            </div>
          )}
          Item={({ item, table, onClick }) => {
            // The shortcut command: what a pick does, and the state it is in now (a new key when it flips, so the
            // query's highlight is drawn again on the new words)
            if (!table && item.id === SHORTCUTS_COMMAND)
              return (
                <>
                  <GroupLabel>{t('Cài đặt')}</GroupLabel>
                  <ResultRow
                    key={keys ? 'on' : 'off'}
                    item={item}
                    onClick={onClick}
                    icon={Keyboard}
                    title={keys ? t('Tắt phím tắt một phím') : t('Bật phím tắt một phím')}
                    meta={keys ? t('Đang bật trong trình duyệt này') : t('Đang tắt trong trình duyệt này')}
                    keepFocus
                  />
                </>
              );
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
                    handbook
                  />
                ) : (
                  <SearchDialogListItem item={item} table={table} onClick={onClick} />
                )}
              </>
            );
          }}
        />
        <ActiveAfter items={items} query={query} at={commandAt} waiting={waiting} memoryRef={activeMemory} />
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
