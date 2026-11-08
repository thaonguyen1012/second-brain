'use client';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/client';

/**
 * "Bỏ các thay đổi chưa lưu?" before unsaved note text goes (closing the Item Sheet, leaving the page, Hủy on an edited
 * note), the words NoteDialog uses. Render it inside the overlay it guards, so Base UI treats it as a child dialog and
 * the focus returns there. "Tiếp tục sửa" has the first focus: Enter alone never drops text.
 */
export function DiscardChanges({
  open,
  onKeep,
  onDiscard,
}: {
  open: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const t = useT();
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onKeep()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Bỏ các thay đổi chưa lưu?')}</AlertDialogTitle>
          <AlertDialogDescription>{t('Nội dung vừa gõ trong ghi chú sẽ mất.')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" type="button" />}>{t('Tiếp tục sửa')}</AlertDialogClose>
          <Button variant="destructive" type="button" onClick={onDiscard}>
            {t('Bỏ thay đổi')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
