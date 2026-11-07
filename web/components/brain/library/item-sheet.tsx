'use client';
import { useRef, useState, type ComponentProps } from 'react';
import type { ApiItem } from '@/lib/api/client';
import { Sheet, SheetPanel, SheetPopup } from '@/components/ui/sheet';
import { DiscardChanges } from './discard-changes';
import { ItemDetail } from './item-detail';

type ChangeDetails = Parameters<NonNullable<ComponentProps<typeof Sheet>['onOpenChange']>>[1];

/**
 * The Item page beside Thư viện (DECISIONS 9.8 point 1, "xem nhanh"): a right-side Sheet over the List or the Board,
 * which stay visible behind it (DESIGN.md §6 Overlays). Escape, the close button and a click outside close it, unless
 * note text is unsaved: then "Bỏ các thay đổi chưa lưu?" asks first. Escape typed inside a note's fields ends that edit
 * instead (the field handles it). `item` stays set while the Sheet animates out.
 */
export function ItemSheet({
  item,
  open,
  compose,
  onOpenChange,
  finalFocus,
  onItemChange,
  onDeleted,
}: {
  item: ApiItem | null;
  open: boolean;
  /** Opened from "Viết ghi chú": the composer starts open and has the first focus. */
  compose: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the focus goes when the Sheet closes (the row or card it was opened from). */
  finalFocus?: ComponentProps<typeof SheetPopup>['finalFocus'];
  onItemChange: (item: ApiItem) => void;
  onDeleted: (item: ApiItem) => void;
}) {
  const dirty = useRef(false);
  const composer = useRef<HTMLTextAreaElement | null>(null);
  const [askClose, setAskClose] = useState(false);

  const change = (next: boolean, details: ChangeDetails) => {
    if (next) return onOpenChange(true);
    const target = details.event?.target;
    if (details.reason === 'escape-key' && target instanceof Element && target.closest('form')) {
      details.cancel();
      return;
    }
    if (dirty.current) {
      details.cancel();
      setAskClose(true);
      return;
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetPopup
        className="max-w-2xl"
        closeProps={{ 'aria-label': 'Đóng' }}
        finalFocus={finalFocus}
        initialFocus={compose ? composer : undefined}
      >
        {item && (
          <SheetPanel>
            <ItemDetail
              key={item.id}
              item={item}
              variant="sheet"
              composeOnOpen={compose}
              composerRef={composer}
              onItemChange={onItemChange}
              onDeleted={onDeleted}
              onDirtyChange={(d) => {
                dirty.current = d;
              }}
            />
          </SheetPanel>
        )}
        <DiscardChanges
          open={askClose}
          onKeep={() => setAskClose(false)}
          onDiscard={() => {
            setAskClose(false);
            dirty.current = false;
            onOpenChange(false);
          }}
        />
      </SheetPopup>
    </Sheet>
  );
}
