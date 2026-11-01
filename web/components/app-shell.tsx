'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Brain, Search } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { appNav } from '@/lib/app-nav';
import { appName } from '@/lib/shared';

/** Space UI sidebar with the Brainwave layout: logo, then labelled groups of icon links (lib/app-nav.ts). */
function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  // The mobile drawer does not close on navigation by itself.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-16 justify-center px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Brain className="size-6" strokeWidth={1.75} aria-hidden />
          <span className="font-heading text-[17px] font-semibold tracking-tight">{appName}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {appNav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      {item.href ? (
                        <SidebarMenuButton
                          isActive={pathname === item.href}
                          render={<Link href={item.href} />}
                        >
                          <Icon aria-hidden />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton disabled className="opacity-60">
                          <Icon aria-hidden />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      )}
                      {!item.href && <SidebarMenuBadge className="text-[10px]">sắp có</SidebarMenuBadge>}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

/** Opens the site search dialog (Fumadocs, SQLite FTS). */
function SearchButton() {
  const { setOpenSearch } = useSearchContext();
  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-lg border border-input bg-popover pr-2 pl-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 dark:bg-input/32"
    >
      <Search className="size-4 opacity-80" aria-hidden />
      <span className="flex-1 text-left">Tìm bài học...</span>
      <Kbd>⌘ K</Kbd>
    </button>
  );
}

/** App frame for non-lesson pages: sidebar (drawer on mobile) and a sticky top bar with search and theme switch. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger aria-label="Mở hoặc đóng menu" />
          <SearchButton />
          <div className="ms-auto">
            <ThemeSwitch />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
