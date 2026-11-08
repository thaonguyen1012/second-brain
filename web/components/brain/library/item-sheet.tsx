'use client';
import { useRef, type ComponentProps } from 'react';
import type { ApiItem } from '@/lib/api/client';
import { useT } from '@/lib/i18n/client';
import { Sheet, SheetPanel, SheetPopup } from '@/components/ui/sheet';
import { ItemDetail } from './item-detail';

type ChangeDetails = Parameters<NonNullable<ComponentProps<typeof Sheet>['onOpenChange']>>[1];

/**
 * The Item page beside Thư viện (DECISIONS 9.8 point 1, "xem nhanh"): a right-side Sheet over the List or the Board,
 * which stay visible behind it (DESIGN.md §6 Overlays). Escape, the close button and a click outside close it; notes
 * being written save by themselves as it closes (use-note-autosave.ts), so nothing asks first. Escape typed inside a
 * note being written ends that edit instead (the editor handles it). `item` stays set while the Sheet animates out.
 */
export function ItemSheet({
  item,
  open,
  compose,
  onOpenChange,
  finalFocus,
  onItemChange,
  onOtherCounts,
  onDeleted,
}: {
  item: ApiItem | null;
  open: boolean;
  /** Opened from "Viết ghi chú": the composer starts open and takes the focus once its editor is ready. */
  compose: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the focus goes when the Sheet closes (the row or card it was opened from). */
  finalFocus?: ComponentProps<typeof SheetPopup>['finalFocus'];
  onItemChange: (item: ApiItem) => void;
  /** Other Items whose note count changed (a deleted note was linked to them too). */
  onOtherCounts?: (items: readonly number[], delta: number) => void;
  onDeleted: (item: ApiItem) => void;
}) {
  const t = useT();
  const title = useRef<HTMLHeadingElement | null>(null);

  const change = (next: boolean, details: ChangeDetails) => {
    if (next) return onOpenChange(true);
    const target = details.event?.target;
    if (details.reason === 'escape-key' && target instanceof Element && target.closest('[data-note-editing]')) {
      details.cancel();
      return;
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetPopup
        className="max-w-2xl"
        closeProps={{ 'aria-label': t('Đóng') }}
        finalFocus={finalFocus}
        initialFocus={title}
      >
        {item && (
          <SheetPanel>
            <ItemDetail
              key={item.id}
              item={item}
              variant="sheet"
              composeOnOpen={compose}
              titleRef={title}
              onItemChange={onItemChange}
              onOtherCounts={onOtherCounts}
              onDeleted={onDeleted}
            />
          </SheetPanel>
        )}
      </SheetPopup>
    </Sheet>
  );
}
