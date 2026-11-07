'use client';
import { List, SquareKanban } from 'lucide-react';
import type { BoardView } from '@/lib/status-board';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';

/**
 * The List/Board switch of a page with a board (DESIGN.md §6 "View switch"): first in the toolbar, at the Tabs' own
 * icon size. The view itself lives in the URL and the remembered choice (useBoardView).
 */
export function ViewSwitch({ view, onChange }: { view: BoardView; onChange: (view: BoardView) => void }) {
  return (
    <Tabs value={view} onValueChange={(v) => onChange(v as BoardView)}>
      <TabsList aria-label="Kiểu xem">
        <TabsTab value="list">
          <List aria-hidden />
          Danh sách
        </TabsTab>
        <TabsTab value="board">
          <SquareKanban aria-hidden />
          Bảng
        </TabsTab>
      </TabsList>
    </Tabs>
  );
}
