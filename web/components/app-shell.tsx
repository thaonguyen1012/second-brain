'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Brain, Menu, Search, X } from 'lucide-react';
import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import { appNav } from '@/lib/app-nav';
import { appName } from '@/lib/shared';

/** Brainwave "Home Sidebar": logo, then labelled groups of icon links. */
function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-6 overflow-y-auto p-4" aria-label="Điều hướng chính">
      <Link href="/" onClick={onNavigate} className="flex h-10 items-center gap-3 px-1">
        <Brain className="size-7" strokeWidth={1.75} aria-hidden />
        <span className="text-[17px] font-bold tracking-[-0.03em]">{appName}</span>
      </Link>
      {appNav.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-2 pb-1 text-[11px] font-medium leading-4 text-fd-muted-foreground">{group.title}</p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const body = (
              <>
                <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">{item.title}</span>
              </>
            );
            const base = 'flex h-10 items-center gap-3 rounded-xl px-2 text-xs font-semibold tracking-[-0.01em]';
            if (!item.href)
              return (
                <span key={item.title} className={`${base} cursor-default text-fd-muted-foreground`}>
                  {body}
                  <span className="ms-auto rounded-md bg-fd-muted px-1.5 text-[10px] font-medium leading-4">sắp có</span>
                </span>
              );
            const active = item.href === pathname;
            return (
              <Link
                key={item.title}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`${base} transition-colors ${active ? 'bg-fd-muted' : 'hover:bg-fd-muted/60'}`}
              >
                {body}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Brainwave "Search Bar": opens the site search dialog. */
function SearchBar() {
  const { setOpenSearch } = useSearchContext();
  return (
    <button
      type="button"
      onClick={() => setOpenSearch(true)}
      className="flex h-10 w-full max-w-[260px] items-center gap-3 rounded-xl border border-[#e2e2e2] bg-fd-secondary py-1 pr-2.5 pl-1 text-xs font-medium text-fd-muted-foreground dark:border-fd-border"
    >
      <span className="flex size-8 items-center justify-center">
        <Search className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-left">Tìm bài học...</span>
      <kbd className="bw-kbd">⌘ K</kbd>
    </button>
  );
}

/** App frame for non-lesson pages: fixed sidebar (drawer on mobile) and a top bar with search and theme. */
export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r bg-fd-background md:block">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r bg-fd-background shadow-popover">
            <button
              type="button"
              aria-label="Đóng menu"
              onClick={() => setOpen(false)}
              className="absolute top-5 right-3 flex size-8 items-center justify-center rounded-lg hover:bg-fd-muted"
            >
              <X className="size-4" aria-hidden />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-col md:pl-[220px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b bg-fd-background/90 px-4 backdrop-blur sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              aria-label="Mở menu"
              onClick={() => setOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-fd-muted md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <SearchBar />
          </div>
          <ThemeSwitch />
        </header>
        {children}
      </div>
    </div>
  );
}
