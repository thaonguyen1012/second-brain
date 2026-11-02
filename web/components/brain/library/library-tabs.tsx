'use client';
import Link from 'next/link';
import { Library, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tabs = [
  { key: 'items', href: '/thu-vien/', label: 'Item', icon: Library },
  { key: 'notes', href: '/thu-vien/ghi-chu/', label: 'Ghi chú', icon: NotebookPen },
] as const;

/** Switch between the two halves of Thư viện (DECISIONS 9.3: item + ghi chú). */
export function LibraryTabs({ current }: { current: (typeof tabs)[number]['key'] }) {
  return (
    <nav aria-label="Thư viện" className="flex flex-wrap gap-2">
      {tabs.map(({ key, href, label, icon: Icon }) => (
        <Button
          key={key}
          size="sm"
          variant={current === key ? 'default' : 'outline'}
          render={<Link href={href} aria-current={current === key ? 'page' : undefined} />}
        >
          <Icon aria-hidden />
          {label}
        </Button>
      ))}
    </nav>
  );
}
