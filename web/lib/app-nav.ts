// App sidebar (home, roadmap): groups of links. Add a group here when a new area of the site lands
// (phase 2: second-brain notes, inbox, daily brief). Items without href are shown as "sắp có".
import type { LucideIcon } from 'lucide-react';
import { Briefcase, Cpu, GraduationCap, Inbox, LayoutDashboard, Map, Newspaper, NotebookPen } from 'lucide-react';
import { tracks, type TrackSlug } from './books';

export interface NavItem {
  title: string;
  href?: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const trackIcons: Record<TrackSlug, LucideIcon> = {
  'kinh-doanh': Briefcase,
  it: Cpu,
  'ky-nang': GraduationCap,
};

export const appNav: NavGroup[] = [
  {
    title: 'Học tập',
    items: [
      { title: 'Tổng quan', href: '/', icon: LayoutDashboard },
      { title: 'Lộ trình', href: '/lo-trinh/', icon: Map },
    ],
  },
  {
    title: 'Sổ tay',
    items: tracks.map((t) => ({ title: t.title, href: `/#track-${t.slug}`, icon: trackIcons[t.slug] })),
  },
  {
    title: 'Second brain',
    items: [
      { title: 'Ghi chú', icon: NotebookPen },
      { title: 'Inbox', icon: Inbox },
      { title: 'Bản tin sáng', icon: Newspaper },
    ],
  },
];
