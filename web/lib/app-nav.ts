// App sidebar (DECISIONS 9.3): the six areas, no more (rule 4.4). Owner, 04/11/2026: laid out like their reference
// sidebar, as labelled groups of rows, every row with its own icon. Hôm nay and Tuần open the list without a label;
// Phát triển, Thư viện, Cơ hội and Công việc are group labels over their pages (each area's old link was its first
// page, so no page lost its row); "Khác" closes the list. Inbox is a top bar button with a count, the morning brief
// lives on "Hôm nay".
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Briefcase,
  CalendarRange,
  CircleHelp,
  Clock,
  Dumbbell,
  Info,
  Library,
  Lightbulb,
  NotebookPen,
  Route,
  Sun,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import type { ApiCounts } from '@/lib/api/client';

/**
 * The six areas of the sidebar; each has one colour, `--area-<key>` in app/global.css (DESIGN.md §4). Hôm nay's is
 * the neutral ink: it gathers every other area.
 */
export type AreaKey = 'today' | 'week' | 'growth' | 'library' | 'opportunity' | 'work';

/** A number of GET /api/counts shown at the end of a row; `timerRunning` is a dot, not a number. */
export type CountKey = Exclude<keyof ApiCounts, 'timerRunning'>;

export interface NavLink {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavRow extends NavLink {
  area: AreaKey;
  /** The row's count and how a screen reader says it ("Tuần, còn 2 mục tiêu"). */
  count?: { key: CountKey; label: (n: number) => string };
  /** Giờ: the "now" dot while a timer runs. */
  timerDot?: boolean;
}

export interface NavGroup {
  /** None for the first group (Hôm nay, Tuần). */
  label?: string;
  rows: readonly NavRow[];
}

export const appNav = [
  {
    rows: [
      { title: 'Hôm nay', href: '/', area: 'today', icon: Sun },
      {
        title: 'Tuần',
        href: '/tuan/',
        area: 'week',
        icon: CalendarRange,
        count: { key: 'objectivesOpen', label: (n) => `còn ${n} mục tiêu` },
      },
    ],
  },
  {
    label: 'Phát triển',
    rows: [
      { title: 'Sổ tay', href: '/phat-trien/', area: 'growth', icon: BookOpen },
      { title: 'Lộ trình', href: '/lo-trinh/', area: 'growth', icon: Route },
      {
        title: 'Kỹ năng',
        href: '/phat-trien/ky-nang/',
        area: 'growth',
        icon: Dumbbell,
        count: { key: 'skills', label: (n) => `${n} kỹ năng` },
      },
      {
        title: 'Thị trường',
        href: '/phat-trien/thi-truong/',
        area: 'growth',
        icon: TrendingUp,
        count: { key: 'jobAds', label: (n) => `${n} tin tuyển dụng tháng này` },
      },
      {
        title: 'Nhật ký thành tựu',
        href: '/phat-trien/thanh-tuu/',
        area: 'growth',
        icon: Trophy,
        count: { key: 'achievements', label: (n) => `${n} thành tựu tuần này` },
      },
    ],
  },
  {
    label: 'Thư viện',
    rows: [
      {
        title: 'Item',
        href: '/thu-vien/',
        area: 'library',
        icon: Library,
        count: { key: 'items', label: (n) => `${n} item` },
      },
      {
        title: 'Ghi chú',
        href: '/thu-vien/ghi-chu/',
        area: 'library',
        icon: NotebookPen,
        count: { key: 'notes', label: (n) => `${n} ghi chú` },
      },
    ],
  },
  {
    label: 'Cơ hội',
    rows: [
      {
        title: 'Cơ hội',
        href: '/co-hoi/',
        area: 'opportunity',
        icon: Lightbulb,
        count: { key: 'opportunities', label: (n) => `${n} cơ hội` },
      },
    ],
  },
  {
    label: 'Công việc',
    rows: [
      {
        title: 'Dự án',
        href: '/cong-viec/',
        area: 'work',
        icon: Briefcase,
        count: { key: 'projects', label: (n) => `${n} dự án` },
      },
      { title: 'Giờ', href: '/cong-viec/gio/', area: 'work', icon: Clock, timerDot: true },
    ],
  },
] as const satisfies readonly NavGroup[];

/** Not an area (DECISIONS 4.4): the intro page and the animated guides, last in the sidebar. */
export const otherNav = {
  label: 'Khác',
  links: [
    { title: 'Giới thiệu', href: '/gioi-thieu/', icon: Info },
    { title: 'Hướng dẫn', href: '/huong-dan/', icon: CircleHelp },
  ],
} as const satisfies { label: string; links: readonly NavLink[] };

/** Every area page with a sidebar row; what `PageHeader nav` takes. */
export type NavHref = (typeof appNav)[number]['rows'][number]['href'];

export const navRows: readonly NavRow[] = appNav.flatMap((g): readonly NavRow[] => g.rows);

/**
 * The six areas in sidebar order, each with the page it opens (a labelled group opens its first row): what Cmd+K
 * lists before anything is typed.
 */
export const navAreas: readonly NavLink[] = appNav.flatMap((g: NavGroup): NavLink[] =>
  g.label ? [{ title: g.label, href: g.rows[0].href, icon: g.rows[0].icon }] : [...g.rows],
);

/**
 * The row a path belongs to: the longest row href that starts it ('/' only matches itself), so /phat-trien/ky-nang/
 * is Kỹ năng, not Sổ tay. A query or hash is ignored. Undefined for pages without a row (Inbox, personal page).
 */
export function navMatch<T extends NavLink>(links: readonly T[], path: string): T | undefined {
  const pathname = path.replace(/[?#].*$/, '');
  let best: T | undefined;
  for (const link of links) {
    const hit = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
    if (hit && (!best || link.href.length > best.href.length)) best = link;
  }
  return best;
}

/** The row of an area page, by its href (PageHeader's title icon, a Hôm nay tile's heading icon). */
export function navRow(href: string): NavRow | undefined {
  return navMatch(navRows, href);
}

