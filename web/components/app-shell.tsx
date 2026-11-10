'use client';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { Moon, PanelLeftClose, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { appNav, navMatch, navRows, otherNav, type NavLink, type NavRow } from '@/lib/app-nav';
import type { ApiCounts } from '@/lib/api/client';
import { InboxButton } from '@/components/brain/inbox-count';
import { refreshNavCounts, useNavCounts } from '@/components/brain/nav-counts';
import { LazyTooltip } from '@/components/lazy-tooltip';
import { BrandMark } from '@/components/brand-mark';
import { appName } from '@/lib/shared';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { useAppPathname } from '@/lib/use-app-pathname';
import { LanguageSwitch } from '@/components/language-switch';

const [daily, ...areas] = appNav;
/** The one row that depends on a file of the owner: hidden while there is no roadmap (AppShell `roadmap`). */
const ROADMAP_HREF = '/lo-trinh/';

/**
 * The current row is a darker grey (owner, 06/11/2026, DESIGN.md §4): `--sidebar-current`, one step past the hover
 * fill (the zinc-800 step in dark), with the medium weight of the button's own active style; it keeps its fill under
 * the pointer. Row icons take the row's text colour.
 */
const currentRow = 'data-[active=true]:bg-sidebar-current data-[active=true]:hover:bg-sidebar-current';

/** A hairline between the sidebar's tiers, inset to the icons' edge; a border, so it stays in forced colours. */
function TierLine({ className }: { className?: string }) {
  return <div aria-hidden className={cn('mx-4 border-t border-sidebar-border', className)} />;
}

interface RowEnd {
  mark: ReactNode;
  spoken: string;
}

/**
 * The end of a row: its count in muted digits (99+, nothing for 0) or Giờ's red "now" dot while a timer runs, and
 * how a screen reader says it. The marks are aria-hidden and the link takes the whole name as its aria-label
 * ("Tuần, còn 2 mục tiêu"), so the name does not depend on how a browser joins the spans.
 */
function rowEnd(row: NavRow, counts: ApiCounts | null, t: T): RowEnd | null {
  if (!counts) return null;
  if (row.timerDot) {
    if (!counts.timerRunning) return null;
    return {
      // Forced colours drop backgrounds: the dot takes the text colour there
      mark: (
        <span
          aria-hidden
          className="ms-auto size-2 shrink-0 rounded-full bg-bw-red forced-colors:bg-[CanvasText] forced-colors:forced-color-adjust-none"
        />
      ),
      spoken: t('đồng hồ đang chạy'),
    };
  }
  const n = row.count ? counts[row.count.key] : 0;
  if (!row.count || n === 0) return null;
  return {
    mark: (
      <span aria-hidden className="ms-auto text-xs text-muted-foreground tabular-nums">
        {n > 99 ? '99+' : n}
      </span>
    ),
    spoken: t(row.count.label, { n }),
  };
}

/**
 * One sidebar row: icon, title and, for an area row, its count or dot. A quiet row (Khác) is muted until it is
 * hovered or current.
 */
function Row({ link, active, end, quiet }: { link: NavLink; active: boolean; end?: RowEnd | null; quiet?: boolean }) {
  const t = useT();
  const Icon = link.icon;
  const title = t(link.title);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        className={cn(currentRow, quiet && 'text-muted-foreground')}
        render={
          <Link
            href={link.href}
            aria-current={active ? 'page' : undefined}
            aria-label={end ? `${title}, ${end.spoken}` : undefined}
          />
        }
      >
        <Icon aria-hidden />
        <span className="truncate">{title}</span>
        {end?.mark}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Moves focus after a toggle, once the new state has rendered (the button pressed is hidden or off screen). */
function focusLater(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

/**
 * Space UI sidebar laid out like the owner's reference (04/11/2026): a header with the app's mark and a button that
 * hides the sidebar, then the groups of lib/app-nav.ts, each row with its icon and, where it has one, its count.
 * Hidden on desktop, it is inert, so its links leave the tab order.
 */
function AppSidebar({ roadmap }: { roadmap: boolean }) {
  const t = useT();
  const raw = useAppPathname();
  const pathname = raw.endsWith('/') ? raw : `${raw}/`;
  const { setOpenMobile, toggleSidebar, isMobile, state } = useSidebar();
  const counts = useNavCounts();
  // The mobile drawer does not close on navigation by itself; the counts follow every page change; a current row
  // below the fold (Khác on a 720px-high screen) scrolls into view.
  useEffect(() => {
    setOpenMobile(false);
    refreshNavCounts();
    document
      .querySelector('[data-slot=sidebar-container] [aria-current=page]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [pathname, setOpenMobile]);
  const current = navMatch([...navRows, ...otherNav.links], pathname)?.href;
  const hide = () => {
    toggleSidebar();
    // Desktop: this button slides away with the sidebar; the top bar's trigger shows in its place
    if (!isMobile) focusLater('[data-sidebar=trigger]');
  };

  return (
    <Sidebar collapsible="offcanvas" inert={!isMobile && state === 'collapsed' ? true : undefined}>
      {/* h-16 + border: one line with the top bar's bottom border */}
      <SidebarHeader className="h-16 flex-row items-center gap-2 border-b border-sidebar-border px-4">
        {/* -m-1 p-1: room for the focus ring around the mark (no tile since 07/11/2026) */}
        <Link
          href="/"
          className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <BrandMark className="size-7 shrink-0" />
          <span className="truncate font-heading text-sm font-semibold tracking-tight">{appName}</span>
        </Link>
        <LazyTooltip label={t('Ẩn menu')}>
          {/* The glyph's right edge lines up with the row counts: the button is 32px with an 18px glyph below sm */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('Ẩn menu')}
            data-sidebar-hide=""
            className="-me-2 sm:-me-1.5"
            onClick={hide}
          >
            <PanelLeftClose aria-hidden />
          </Button>
        </LazyTooltip>
      </SidebarHeader>
      <SidebarContent className="py-2">
        {/* Three tiers (owner's second reference, 06/11/2026): the daily pages; a hairline; the areas under their
            labels, more space above a label than between rows; Khác pushed to the bottom (mt-auto; it scrolls with
            the rest on a short screen) after another hairline, muted and without a label */}
        <nav aria-label="Menu" className="flex flex-1 flex-col">
          <SidebarGroup className="py-1.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {daily.rows.map((row: NavRow) => (
                  <Row key={row.href} link={row} active={current === row.href} end={rowEnd(row, counts, t)} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <TierLine className="my-1.5" />
          {areas.map((group, i) => (
            <SidebarGroup key={group.label.msgid} className="pt-2.5 pb-0">
              <SidebarGroupLabel
                id={`nav-group-${i}`}
                className="h-7 font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t(group.label)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                {/* The label names its list, so "Item" is heard as part of Thư viện */}
                <SidebarMenu aria-labelledby={`nav-group-${i}`}>
                  {group.rows
                    .filter((row: NavRow) => roadmap || row.href !== ROADMAP_HREF)
                    .map((row: NavRow) => (
                      <Row key={row.href} link={row} active={current === row.href} end={rowEnd(row, counts, t)} />
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          <div className="mt-auto pt-5">
            <TierLine />
            <SidebarGroup className="py-1.5">
              <SidebarGroupContent>
                <SidebarMenu aria-label={t(otherNav.label)}>
                  {otherNav.links.map((link) => (
                    <Row key={link.href} link={link} active={current === link.href} quiet />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * The top bar's menu button: on phones it opens the drawer; on desktop it only shows while the sidebar is hidden
 * (the sidebar's own "Ẩn menu" hides it), and after opening it hands focus to "Ẩn menu", since it hides itself.
 * -ms-1.5 / sm:-ms-2: the glyph, not its hover box, lines up with the page title's left edge.
 */
function MenuTrigger() {
  const t = useT();
  const { isMobile, state } = useSidebar();
  return (
    <SidebarTrigger
      aria-label={t('Mở hoặc đóng menu')}
      className="-ms-1.5 sm:-ms-2 md:group-has-[[data-slot=sidebar][data-state=expanded]]/sidebar-wrapper:hidden"
      onClick={() => {
        if (!isMobile && state === 'collapsed') focusLater('[data-sidebar-hide]');
      }}
    />
  );
}

/**
 * Opens the search dialog (components/search-dialog.tsx): handbooks and the second brain. The accessible name stays
 * "Tìm mọi thứ" at every width. Below sm the visible label shortens to "Tìm…" and shows whole or not at all: the
 * span is one line tall (h-6, the 24 px line of text-base; not h-lh, Firefox before 120 has no lh) and its empty
 * ::before holds that line, so a label that does not fit beside the Inbox button (its count arrives after hydration)
 * and the EN/VI switch wraps to the clipped second line (overflow-clip: not a scroll container, so find in page cannot
 * scroll it into view) and leaves the magnifier alone, never a stub like "Se…" (DESIGN.md §6). The key hint is hidden on touch and small screens (DESIGN.md D24).
 */
function SearchButton() {
  const t = useT();
  const { setOpenSearch } = useSearchContext();
  return (
    <Button
      variant="outline"
      aria-label={t('Tìm mọi thứ')}
      onClick={() => setOpenSearch(true)}
      className="w-full min-w-0 max-w-[280px] shrink justify-start font-normal text-muted-foreground"
    >
      <Search aria-hidden />
      <span className="flex h-6 min-w-0 flex-1 flex-wrap overflow-clip before:h-6 sm:hidden">{t('Tìm…')}</span>
      <span className="max-sm:hidden">{t('Tìm mọi thứ...')}</span>
      <Kbd className="ms-auto max-sm:hidden pointer-coarse:hidden">⌘ K</Kbd>
    </Button>
  );
}

/**
 * Light/dark switch (next-themes, shared with the lesson pages). Both icons are rendered and CSS shows the right
 * one, so the server markup never depends on the theme (no hydration mismatch). e2e/theme.spec.ts clicks
 * `button[data-theme-toggle]`.
 */
function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <LazyTooltip label={t('Đổi giao diện')}>
      <Button
        variant="ghost"
        size="icon"
        data-theme-toggle=""
        aria-label={t('Đổi giao diện sáng/tối')}
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      >
        <Sun aria-hidden className="dark:hidden" />
        <Moon aria-hidden className="hidden dark:block" />
      </Button>
    </LazyTooltip>
  );
}

/**
 * App frame for non-lesson pages: sidebar (drawer on mobile) and a sticky top bar with search, inbox and theme.
 * `roadmap`: false hides the Lộ trình row (no content/roadmap.json; the layouts read lib/content/roadmap.ts).
 */
export function AppShell({ children, roadmap = true }: { children: ReactNode; roadmap?: boolean }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
      <AppSidebar roadmap={roadmap} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-8">
          <MenuTrigger />
          <SearchButton />
          <div className="ms-auto flex items-center gap-2">
            <InboxButton />
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
