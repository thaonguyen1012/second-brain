'use client';
import { useRef, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Menu, MenuPopup, MenuShortcut, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/client';
import { useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';

/**
 * The trigger of the row menu opened last. Its items live in a portal outside the row, so a delete confirmed from one
 * of them starts from this button: once the row is gone, the focus goes to the row's neighbour (confirm-delete.tsx).
 */
let lastTrigger: HTMLElement | null = null;
export const lastRowMenuTrigger = (): HTMLElement | null => lastTrigger;

/**
 * A menu item's key when the page answers it on its own, without ⌘, Ctrl or Alt (the Inbox's O, T, N and Del): shown
 * only while single-key shortcuts are on (lib/single-key-shortcuts.ts). A focused row's own keys work either way and
 * keep a plain MenuShortcut (an objective's Enter, Alt+↑, Del). Keys that act in one view only are shown by a row that
 * knows its view: Ghi chú's E and Del act on the list view's cursor, so its rows take the switch and the view as one
 * `keys` and show MenuShortcut only then, never in "Theo item".
 */
export function MenuSingleKey({ children }: { children: string }) {
  return useSingleKeyShortcuts() ? <MenuShortcut>{children}</MenuShortcut> : null;
}

/**
 * Overflow actions of one record (DESIGN.md §6 "Row actions"): a ghost icon button with a tooltip that opens a
 * Menu. Children are MenuItem / MenuLinkItem / MenuSeparator, with MenuShortcut (MenuSingleKey for a single key the
 * page listens for) for their keys.
 */
export function RowMenu({ label: given, children }: { label?: string; children: ReactNode }) {
  const t = useT();
  const label = given ?? t('Thao tác khác');
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <Menu
      onOpenChange={(open) => {
        if (open) lastTrigger = trigger.current;
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger ref={trigger} render={<Button size="icon-sm" variant="ghost" aria-label={label} />} />
          }
        >
          <MoreHorizontal aria-hidden />
        </TooltipTrigger>
        <TooltipPopup>{label}</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" className="w-56">
        {children}
      </MenuPopup>
    </Menu>
  );
}
