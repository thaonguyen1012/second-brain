'use client';
import Link from 'next/link';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { useNavCounts } from '../nav-counts';

const tabs = [
  { key: 'items', href: '/thu-vien/', label: 'Item' },
  { key: 'notes', href: '/thu-vien/ghi-chu/', label: 'Ghi chú' },
] as const;

/**
 * Switch between the two halves of Thư viện (DECISIONS 9.3: item + ghi chú): the same segmented Tabs as Tuần and
 * Inbox (DESIGN.md §6, D23), each tab a link to its route, ending in its count as plain muted text (GET /api/counts,
 * the sidebar's numbers; 0 included, nothing while unknown).
 */
export function LibraryTabs({ current }: { current: (typeof tabs)[number]['key'] }) {
  const counts = useNavCounts();
  return (
    <Tabs value={current}>
      <TabsList aria-label="Thư viện">
        {tabs.map(({ key, href, label }) => (
          <TabsTab
            key={key}
            value={key}
            nativeButton={false}
            render={<Link href={href} aria-current={current === key ? 'page' : undefined} />}
          >
            {label}
            {counts && (
              <span className="ms-1.5 text-xs font-normal text-muted-foreground tabular-nums">{counts[key]}</span>
            )}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
