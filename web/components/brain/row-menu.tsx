'use client';
import type { ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Menu, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/client';

/**
 * Overflow actions of one record (DESIGN.md §6 "Row actions"): a ghost icon button with a tooltip that opens a
 * Menu. Children are MenuItem / MenuLinkItem / MenuSeparator, with MenuShortcut for their keys.
 */
export function RowMenu({ label: given, children }: { label?: string; children: ReactNode }) {
  const t = useT();
  const label = given ?? t('Thao tác khác');
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={<MenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={label} />} />}
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
