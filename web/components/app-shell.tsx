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
import { appName } from '@/lib/shared';

/** Space UI sidebar: logo, then the six items of lib/app-nav.ts with their sub-items. */
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
          <span className="font-heading text-[17px] font-semibold tracking-tight">{appName}</span>
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
                    {item.children && active && (
                      <SidebarMenuSub>
                        {item.children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton
                              isActive={pathname === child.href}
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
    </Sidebar>
  );
}

/** Opens the search dialog (components/search-dialog.tsx): handbooks and the second brain. */
function SearchButton() {
  const { setOpenSearch } = useSearchContext();
  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="flex h-9 w-full max-w-[280px] items-center gap-2 rounded-lg border border-input bg-popover pr-2 pl-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 dark:bg-input/32"
    >
      <Search className="size-4 opacity-80" aria-hidden />
      <span className="flex-1 truncate text-left">Tìm mọi thứ...</span>
      <Kbd>⌘ K</Kbd>
    </button>
  );
}

/** App frame for non-lesson pages: sidebar (drawer on mobile) and a sticky top bar with search, inbox and theme. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem' } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger aria-label="Mở hoặc đóng menu" />
          <SearchButton />
          <div className="ms-auto flex items-center gap-2">
            <InboxButton />
            <ThemeSwitch />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
