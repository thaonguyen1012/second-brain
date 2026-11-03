'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Brain, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { appNav, isNavActive } from '@/lib/app-nav';
import { InboxButton } from '@/components/brain/inbox-count';
import { LazyTooltip } from '@/components/lazy-tooltip';
import { appName } from '@/lib/shared';

/** Space UI sidebar: logo, then the six items of lib/app-nav.ts, each with all of its sub-items. */
const footerLinks = [
  { href: '/gioi-thieu/', label: 'Giới thiệu và case study' },
  { href: '/huong-dan/', label: 'Hướng dẫn' },
];

function AppSidebar() {
  const raw = usePathname();
  const pathname = raw.endsWith('/') ? raw : `${raw}/`;
  const { setOpenMobile } = useSidebar();
  // The mobile drawer does not close on navigation by itself.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-16 justify-center px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Brain className="size-6" strokeWidth={1.75} aria-hidden />
          <span className="font-heading text-base font-semibold tracking-tight">{appName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNav.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item, pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton isActive={active && !item.children} render={<Link href={item.href} />}>
                      <Icon aria-hidden />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {/* Sub-items always show, for every item (owner, 03/11/2026); the current one is highlighted */}
                    {item.children && (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            {/* 32px row like the parent (§3), and the label on the parent label's edge (D10):
                                the registry geometry puts it 1px right, -translate-x-0.5 instead of -px fixes that */}
                            <SidebarMenuSubButton
                              isActive={pathname === child.href}
                              className="-translate-x-0.5 sm:h-8"
                              render={<Link href={child.href} />}
                            >
                              <span>{child.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {/* Not nav items (DECISIONS 4.4): quiet text links to the intro page and the animated guides */}
      <SidebarFooter className="flex-row flex-wrap gap-x-3 gap-y-1 px-4 pb-4">
        {footerLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? 'page' : undefined}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline aria-[current=page]:text-foreground"
          >
            {l.label}
          </Link>
        ))}
      </SidebarFooter>
    </Sidebar>
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
          {/* -ms-1.5: the trigger's glyph, not its hover box, lines up with the page title's left edge */}
          <SidebarTrigger aria-label="Mở hoặc đóng menu" className="-ms-1.5" />
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
