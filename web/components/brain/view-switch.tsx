'use client';
import { LayoutGrid, List, SquareKanban, type LucideIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';

/** The one view a page offers beside its list: the board (Dự án, Thư viện) or the grid of cards (Công cụ). */
const ALT_VIEWS = {
  board: { icon: SquareKanban, label: msg('Bảng') },
  grid: { icon: LayoutGrid, label: msg('Lưới') },
} satisfies Record<string, { icon: LucideIcon; label: Msg }>;

export type AltView = keyof typeof ALT_VIEWS;

/**
 * The List/Board switch of a page with a board, or List/Grid on Công cụ (DESIGN.md §6 "View switch"): first in the
 * toolbar, at the Tabs' own icon size. The view itself lives in the URL and the remembered choice (useListView).
 */
export function ViewSwitch<A extends AltView = 'board'>({
  view,
  onChange,
  alt = 'board' as A,
  textOnlyWhenNarrow = false,
}: {
  view: 'list' | A;
  onChange: (view: 'list' | A) => void;
  alt?: A;
  /**
   * In a toolbar (its `@container`) narrower than 28rem the tabs drop their icons and keep their names, like Ghi chú's
   * switch, so a long primary button still fits beside them (Công cụ's "Thêm công cụ" at 390 px).
   */
  textOnlyWhenNarrow?: boolean;
}) {
  const t = useT();
  const { icon: Icon, label } = ALT_VIEWS[alt];
  const iconClass = textOnlyWhenNarrow ? '@max-md:hidden' : undefined;
  return (
    <Tabs value={view} onValueChange={(v) => onChange(v as 'list' | A)}>
      <TabsList aria-label={t('Kiểu xem')}>
        <TabsTab value="list">
          <List aria-hidden className={iconClass} />
          {t('Danh sách')}
        </TabsTab>
        <TabsTab value={alt}>
          <Icon aria-hidden className={iconClass} />
          {t(label)}
        </TabsTab>
      </TabsList>
    </Tabs>
  );
}
