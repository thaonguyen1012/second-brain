// App sidebar (DECISIONS 9.3): six items, no more (rule 4.4). Inbox is a top bar button with a count, the
// morning brief lives on "Hôm nay". Sub-items show under their item; `match` lists extra path prefixes that
// make an item active.
import type { LucideIcon } from 'lucide-react';
import { Briefcase, CalendarRange, Lightbulb, Library, Sprout, Sun } from 'lucide-react';

export interface NavLink {
  title: string;
  href: string;
}

export interface NavItem extends NavLink {
  icon: LucideIcon;
  match?: string[];
  children?: NavLink[];
}

export const appNav: NavItem[] = [
  { title: 'Hôm nay', href: '/', icon: Sun },
  { title: 'Tuần', href: '/tuan/', icon: CalendarRange },
  {
    title: 'Phát triển',
    href: '/phat-trien/',
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
  { title: 'Thư viện', href: '/thu-vien/', icon: Library },
  { title: 'Cơ hội', href: '/co-hoi/', icon: Lightbulb },
  {
    title: 'Công việc',
    href: '/cong-viec/',
    icon: Briefcase,
    children: [
      { title: 'Dự án', href: '/cong-viec/' },
      { title: 'Giờ', href: '/cong-viec/gio/' },
    ],
  },
];

/** True when `pathname` belongs to the item (its own page, a sub-page, or a `match` prefix). */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return [item.href, ...(item.match ?? [])].some((p) => pathname.startsWith(p));
}
