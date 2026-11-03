'use client';
import Link from 'next/link';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';

const tabs = [
  { key: 'items', href: '/thu-vien/', label: 'Item' },
  { key: 'notes', href: '/thu-vien/ghi-chu/', label: 'Ghi chú' },
] as const;

/**
 * Switch between the two halves of Thư viện (DECISIONS 9.3: item + ghi chú): the same segmented Tabs as Tuần and
 * Inbox (DESIGN.md §6, D23), each tab a link to its route.
 */
export function LibraryTabs({ current }: { current: (typeof tabs)[number]['key'] }) {
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
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  );
}
