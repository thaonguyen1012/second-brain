'use client';
// Cmd+K "find everything" (DECISIONS 4.4). Fumadocs' default dialog (handbooks, /api/search, SQLite FTS) plus a
// second-brain group from the `?q=` filters of the Django lists. Lazy-loaded by components/provider.tsx, so none
// of this is in the first-load JS. The brain group only loads while the dialog is open and a query is typed;
// without Django it stays silent and the handbook results work as before.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Lightbulb, Library, NotebookPen, Sprout, type LucideIcon } from 'lucide-react';
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
import { ApiError } from '@/lib/api/client';
import { searchBrain, type BrainSearchResults } from '@/lib/api/search';
import { toApiError } from '@/lib/api/use-api';
import { decisionOf, hostOf, inboxStatusOf, itemStatusOf, itemTypeLabel, opportunityHref } from '@/lib/labels';
import { noteTitle } from '@/lib/library-labels';
import { freshness } from '@/components/brain/growth/labels';

/** Shorter queries match too much of everything; the handbook search still runs for them. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 200;
/** The backend trims longer queries to 200 characters anyway. */
const MAX_QUERY = 200;
/** After "Django not reachable" (dev without the proxy, static export) stop asking for a while. */
const OFFLINE_PAUSE_MS = 60_000;
let offlineUntil = 0;

type Kind = 'item' | 'note' | 'inbox' | 'opportunity' | 'skill';

const kinds: Record<Kind, { label: string; icon: LucideIcon }> = {
  item: { label: 'Thư viện', icon: Library },
  note: { label: 'Ghi chú', icon: NotebookPen },
  inbox: { label: 'Inbox', icon: Inbox },
  opportunity: { label: 'Cơ hội', icon: Lightbulb },
  skill: { label: 'Kỹ năng', icon: Sprout },
};

interface BrainHit {
  /** Unique in the list next to the handbook ids (URLs). */
  id: string;
  kind: Kind;
  title: string;
  detail: string;
  href: string;
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

function toHits(r: BrainSearchResults, q: string): BrainHit[] {
  return [
    ...r.items.map((it) => ({
      id: `brain-item-${it.id}`,
      kind: 'item' as const,
      title: it.title,
      detail: join(itemTypeLabel(it.type), itemStatusOf(it.status).label, it.source),
      href: `/thu-vien/?item=${it.id}`,
    })),
    ...r.notes.map((n) => ({
      id: `brain-note-${n.id}`,
      kind: 'note' as const,
      title: noteTitle(n),
      detail: excerpt(n.markdown, q),
      href: `/thu-vien/ghi-chu/?id=${n.id}`,
    })),
    ...r.inbox.map((e) => ({
      id: `brain-inbox-${e.id}`,
      kind: 'inbox' as const,
      title: oneLine(e.ogTitle || e.text || e.url || `Mục #${e.id}`).slice(0, 160),
      detail: join(inboxStatusOf(e.status).label, e.ogSiteName || hostOf(e.url)),
      href: `/inbox/?status=${e.status}&id=${e.id}`,
    })),
    ...r.opportunities.map((o) => ({
      id: `brain-opportunity-${o.id}`,
      kind: 'opportunity' as const,
      title: o.title,
      detail: join(decisionOf(o.decision).label, excerpt(o.hypothesis, q)),
      href: opportunityHref(o.id),
    })),
    ...r.skills.map((s) => ({
      id: `brain-skill-${s.id}`,
      kind: 'skill' as const,
      title: s.name,
      detail: join(freshness[s.freshness].label, s.aliases.join(', ')),
      href: `/phat-trien/ky-nang/?id=${s.id}`,
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
function useBrainSearch(query: string) {
  const q = query.trim().slice(0, MAX_QUERY);
  const active = q.length >= MIN_QUERY;
  const [state, setState] = useState<BrainState>({ q: '' });

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const timer = setTimeout(() => {
      const search = Date.now() < offlineUntil ? Promise.reject(new ApiError(0, 'offline', false)) : searchBrain(q);
      search.then(
        (r) => alive && setState({ q, hits: toHits(r, q) }),
        (err: unknown) => {
          const error = toApiError(err);
          if (!error.reachable && Date.now() >= offlineUntil) offlineUntil = Date.now() + OFFLINE_PAUSE_MS;
          if (alive) setState({ q, error });
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, active]);

  if (!active) return { hits: NO_HITS, loading: false, error: undefined };
  const related = state.q !== '' && (q.startsWith(state.q) || state.q.startsWith(q));
  return {
    hits: related ? (state.hits ?? NO_HITS) : NO_HITS,
    loading: state.q !== q,
    error: state.q === q ? state.error : undefined,
  };
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div
      role="presentation"
      aria-hidden
      className="px-2.5 pt-2.5 pb-1 text-xs font-medium tracking-wide text-fd-muted-foreground uppercase"
    >
      {children}
    </div>
  );
}

function BrainRow({ hit, item, onClick }: { hit: BrainHit; item: SearchItemType; onClick: () => void }) {
  const { query } = useSearch();
  const highlight = useHighlightQuery(query);
  const kind = kinds[hit.kind];
  const Icon = kind.icon;
  return (
    <SearchDialogListItem item={item} onClick={onClick}>
      <div ref={highlight} className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-fd-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{hit.title}</div>
          {hit.detail && <div className="truncate text-xs text-fd-muted-foreground">{hit.detail}</div>}
        </div>
        <span
          data-highlight-ignore=""
          className="shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] leading-none text-fd-muted-foreground"
        >
          {kind.label}
        </span>
      </div>
    </SearchDialogListItem>
  );
}

const NO_LINKS: SearchLink[] = [];

export default function AppSearchDialog({ links = NO_LINKS, ...props }: SharedProps & { links?: SearchLink[] }) {
  const { locale } = useI18n();
  const router = useRouter();
  const search = useFetchSearch({ locale });
  const brain = useBrainSearch(props.open ? search.search : '');

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
        item: { id: hit.id, type: 'action', node: hit.title, onSelect: () => router.push(hit.href) } as const,
      })),
    [brain.hits, router],
  );
  const byId = useMemo(() => new Map(brain.hits.map((h) => [h.id, h])), [brain.hits]);

  // Second-brain rows first: they are few (at most 5 per kind), the handbook list can run to a hundred rows.
  const handbook: (SearchItemType | SearchResultItem)[] | null = search.data?.items ?? defaultItems;
  const items = useMemo<(SearchItemType | SearchResultItem)[] | null>(
    () => (brainItems.length === 0 ? handbook : [...brainItems.map((b) => b.item), ...(handbook ?? [])]),
    [brainItems, handbook],
  );
  const firstHandbook = brainItems.length > 0 ? handbook?.[0]?.id : undefined;
  const firstBrain = brainItems[0]?.hit.id;

  // Signed out or a server error: one quiet line. Django absent (dev without the proxy, static export): nothing.
  const brainNote = !brain.error?.reachable
    ? null
    : [401, 403].includes(brain.error.status)
      ? 'Chưa đăng nhập: chỉ tìm được trong sổ tay.'
      : `Không tìm được trong bộ não thứ hai (máy chủ trả lỗi ${brain.error.status}).`;

  return (
    <SearchDialog {...search} isLoading={search.isLoading || brain.loading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label="Tìm mọi thứ" placeholder="Tìm sổ tay, thư viện, ghi chú, inbox…" />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList
          items={items}
          Empty={() => (
            <div role="status" className="py-12 text-center text-sm text-fd-muted-foreground">
              {brain.loading ? 'Đang tìm…' : 'Không tìm thấy kết quả'}
            </div>
          )}
          Item={({ item, table, onClick }) => {
            const hit = byId.get(item.id);
            const label =
              hit && hit.id === firstBrain
                ? 'Bộ não thứ hai'
                : !hit && !table && item.id === firstHandbook
                  ? 'Sổ tay'
                  : null;
            return (
              <>
                {label && <GroupLabel>{label}</GroupLabel>}
                {hit ? (
                  <BrainRow hit={hit} item={item} onClick={onClick} />
                ) : (
                  <SearchDialogListItem item={item} table={table} onClick={onClick} />
                )}
              </>
            );
          }}
        />
        {brainNote && (
          <SearchDialogFooter>
            <p role="status" className="text-xs text-fd-muted-foreground">
              {brainNote}
            </p>
          </SearchDialogFooter>
        )}
      </SearchDialogContent>
    </SearchDialog>
  );
}
