'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Brain, Moon, PanelLeftClose, Search, Sun } from 'lucide-react';
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
import { appName } from '@/lib/shared';

/**
 * The current row is a raised chip (owner, 04/11/2026, DESIGN.md §4): `--sidebar-current` (white on the grey
 * sidebar, the zinc-800 step in dark, above the hover fill), a 1px border drawn as a ring (no layout shift) and the
 * depth-1 shadow; it keeps its colour under the pointer, and the focus ring keeps its blue over the border ring.
 */
const currentRow =
  'data-[active=true]:bg-sidebar-current data-[active=true]:shadow-depth-1 data-[active=true]:ring-1 data-[active=true]:ring-sidebar-border data-[active=true]:hover:bg-sidebar-current data-[active=true]:focus-visible:ring-2 data-[active=true]:focus-visible:ring-sidebar-ring';

/**
 * Every row icon is the one primary blue (owner, 04/11/2026: an area colour per icon looked messy; DESIGN.md §4).
 * In forced colours the icon follows its row again (an svg keeps an explicit colour there).
 */
const rowIcon = 'text-primary forced-colors:text-inherit';

interface RowEnd {
  mark: ReactNode;
  spoken: string;
}

/**
 * The end of a row: its count in muted digits (99+, nothing for 0) or Giờ's red "now" dot while a timer runs, and
 * how a screen reader says it. The marks are aria-hidden and the link takes the whole name as its aria-label
 * ("Tuần, còn 2 mục tiêu"), so the name does not depend on how a browser joins the spans.
 */
function rowEnd(row: NavRow, counts: ApiCounts | null): RowEnd | null {
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
      spoken: 'đồng hồ đang chạy',
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
    spoken: row.count.label(n),
  };
}

/** One sidebar row: icon, title and, for an area row, its count or dot. */
function Row({ link, active, end }: { link: NavLink; active: boolean; end?: RowEnd | null }) {
  const Icon = link.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        className={currentRow}
        render={
          <Link
            href={link.href}
            aria-current={active ? 'page' : undefined}
            aria-label={end ? `${link.title}, ${end.spoken}` : undefined}
          />
        }
      >
        <Icon aria-hidden className={rowIcon} />
        <span className="truncate">{link.title}</span>
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
function AppSidebar() {
  const raw = usePathname();
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
        {/* -m-1 p-1: the focus ring clears the tile's border */}
        <Link
          href="/"
          className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card">
            <Brain className="size-5" strokeWidth={1.75} />
          </span>
          <span className="truncate font-heading text-sm font-semibold tracking-tight">{appName}</span>
        </Link>
        <LazyTooltip label="Ẩn menu">
          {/* The glyph's right edge lines up with the row counts: the button is 32px with an 18px glyph below sm */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ẩn menu"
            data-sidebar-hide=""
            className="-me-2 sm:-me-1.5"
            onClick={hide}
          >
            <PanelLeftClose aria-hidden />
          </Button>
        </LazyTooltip>
      </SidebarHeader>
      <SidebarContent className="py-2">
        <nav aria-label="Menu">
          {appNav.map((group, i) => (
            <SidebarGroup key={group.rows[0].href} className="py-1.5">
              {'label' in group && (
                <SidebarGroupLabel id={`nav-group-${i}`} className="text-muted-foreground">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                {/* The label names its list, so "Item" is heard as part of Thư viện */}
                <SidebarMenu aria-labelledby={'label' in group ? `nav-group-${i}` : undefined}>
                  {group.rows.map((row: NavRow) => (
                    <Row key={row.href} link={row} active={current === row.href} end={rowEnd(row, counts)} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
          <SidebarGroup className="py-1.5">
            <SidebarGroupLabel id="nav-group-other" className="text-muted-foreground">
              {otherNav.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby="nav-group-other">
                {otherNav.links.map((link) => (
                  <Row key={link.href} link={link} active={current === link.href} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
  const { isMobile, state } = useSidebar();
  return (
    <SidebarTrigger
      aria-label="Mở hoặc đóng menu"
      className="-ms-1.5 sm:-ms-2 md:group-has-[[data-slot=sidebar][data-state=expanded]]/sidebar-wrapper:hidden"
      onClick={() => {
        if (!isMobile && state === 'collapsed') focusLater('[data-sidebar-hide]');
      }}
    />
  );
}

/**
 * Opens the search dialog (components/search-dialog.tsx): handbooks and the second brain. The accessible name stays
 * "Tìm mọi thứ" at every width; the visible label shortens below sm so it never truncates, and the key hint is
 * hidden on touch and small screens (DESIGN.md D24).
 */
function SearchButton() {
  const { setOpenSearch } = useSearchContext();
  return (
    <Button
      variant="outline"
      aria-label="Tìm mọi thứ"
      onClick={() => setOpenSearch(true)}
      className="w-full min-w-0 max-w-[280px] shrink justify-start font-normal text-muted-foreground"
    >
      <Search aria-hidden />
      <span className="sm:hidden">Tìm…</span>
      <span className="max-sm:hidden">Tìm mọi thứ...</span>
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
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <LazyTooltip label="Đổi giao diện">
      <Button
        variant="ghost"
        size="icon"
        data-theme-toggle=""
        aria-label="Đổi giao diện sáng/tối"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      >
        <Sun aria-hidden className="dark:hidden" />
        <Moon aria-hidden className="hidden dark:block" />
      </Button>
    </LazyTooltip>
  );
}

/** App frame for non-lesson pages: sidebar (drawer on mobile) and a sticky top bar with search, inbox and theme. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-8">
          <MenuTrigger />
          <SearchButton />
          <div className="ms-auto flex items-center gap-2">
            <InboxButton />
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
