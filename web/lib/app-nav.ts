// App sidebar (DECISIONS 9.3): six items, no more (rule 4.4). Inbox is a top bar button with a count, the
// morning brief lives on "Hôm nay". Sub-items always show under their item, active or not; `match` lists extra
// path prefixes that make an item active.
import type { LucideIcon } from 'lucide-react';
import { Briefcase, CalendarRange, Lightbulb, Library, Sprout, Sun } from 'lucide-react';

/**
 * The six areas of the sidebar; each has one colour, `--area-<key>` in app/global.css (DESIGN.md §4). Hôm nay's is
 * the neutral ink: it gathers every other area.
 */
export type AreaKey = 'today' | 'week' | 'growth' | 'library' | 'opportunity' | 'work';

export interface NavLink {
  title: string;
  href: string;
}

export interface NavItem extends NavLink {
  area: AreaKey;
  icon: LucideIcon;
  match?: string[];
  children?: NavLink[];
}

export const appNav: NavItem[] = [
  { title: 'Hôm nay', href: '/', area: 'today', icon: Sun },
  { title: 'Tuần', href: '/tuan/', area: 'week', icon: CalendarRange },
  {
    title: 'Phát triển',
    href: '/phat-trien/',
    area: 'growth',
    icon: Sprout,
    match: ['/lo-trinh/'],
    children: [
      { title: 'Sổ tay', href: '/phat-trien/' },
      { title: 'Lộ trình', href: '/lo-trinh/' },
      { title: 'Kỹ năng', href: '/phat-trien/ky-nang/' },
      { title: 'Thị trường', href: '/phat-trien/thi-truong/' },
      { title: 'Nhật ký thành tựu', href: '/phat-trien/thanh-tuu/' },
    ],
  },
  {
    title: 'Thư viện',
    href: '/thu-vien/',
    area: 'library',
    icon: Library,
    children: [
      { title: 'Item', href: '/thu-vien/' },
      { title: 'Ghi chú', href: '/thu-vien/ghi-chu/' },
    ],
  },
  { title: 'Cơ hội', href: '/co-hoi/', area: 'opportunity', icon: Lightbulb },
  {
    title: 'Công việc',
    href: '/cong-viec/',
    area: 'work',
    icon: Briefcase,
    children: [
      { title: 'Dự án', href: '/cong-viec/' },
      { title: 'Giờ', href: '/cong-viec/gio/' },
    ],
  },
];

/** The sidebar item of each area (its icon and title), for page title tiles and Hôm nay tiles. */
export const navByArea = Object.fromEntries(appNav.map((item) => [item.area, item])) as Record<AreaKey, NavItem>;

/**
 * Area colour on an icon: the sidebar icon, the page title tile and a Hôm nay tile linking to the area. In forced
 * colours the icon follows its row again (an svg keeps an explicit colour there). Class names are written out in
 * full: Tailwind only generates classes it finds in the source.
 */
export const areaIcon: Record<AreaKey, string> = {
  today: 'text-area-today forced-colors:text-inherit',
  week: 'text-area-week forced-colors:text-inherit',
  growth: 'text-area-growth forced-colors:text-inherit',
  library: 'text-area-library forced-colors:text-inherit',
  opportunity: 'text-area-opportunity forced-colors:text-inherit',
  work: 'text-area-work forced-colors:text-inherit',
};

/** True when `pathname` belongs to the item (its own page, a sub-page, or a `match` prefix). */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return [item.href, ...(item.match ?? [])].some((p) => pathname.startsWith(p));
}
