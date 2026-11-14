'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { focusShortcutOpener } from '@/lib/shortcut-opener';
import { useT } from '@/lib/i18n/client';
import { setSingleKeyShortcuts, singleKeyShortcut, useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';
import { cn } from '@/lib/utils';

/**
 * One line of a legend: the key as drawn, what it does, and 'always' for a key that works with single-key shortcuts
 * off too (a focused row's own arrows, Enter and Del; a key with ⌘, Ctrl or Alt). The other lines are single keys the
 * switch turns off, and the legend leaves them out while it is off.
 */
export type KeyLine = readonly [key: string, label: string, always?: 'always'];

/**
 * The full keyboard legend of a keyboard-driven page behind one "Phím tắt" control (DESIGN.md §6, D24): a small
 * dialog, also opened with "?". Hidden on touch screens and below md, where the keys do not apply. It ends with the
 * switch for every single-key shortcut of the app (WCAG 2.1.4), remembered in this browser.
 */
export function KeyLegend({ keys, title }: { keys: KeyLine[]; title?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const on = useSingleKeyShortcuts();
  const lines = on ? keys : keys.filter((line) => line[2] === 'always');
  const hintId = useId();
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || !singleKeyShortcut(e)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      focusShortcutOpener('?'); // "Phím tắt", when nothing holds the focus: the legend gives the focus back there
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground max-md:hidden pointer-coarse:hidden"
        onClick={() => setOpen(true)}
      >
        <Keyboard aria-hidden />
        {t('Phím tắt')}
        {on && <Kbd>?</Kbd>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* The focus starts on "Đóng" as before the switch, so Space or Enter after "?" never flips it */}
        <DialogPopup
          className="max-w-sm"
          closeProps={{ 'aria-label': t('Đóng'), ref: closeRef }}
          initialFocus={closeRef}
        >
          <DialogHeader>
            <DialogTitle>{title ?? t('Phím tắt')}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            {/* With the switch off only the keys that still work are listed; with none, the switch stands alone */}
            {lines.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                {lines.map(([k, label]) => (
                  <div key={k} className="contents">
                    <dt className="flex justify-end">
                      <Kbd>{k}</Kbd>
                    </dt>
                    <dd className="text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className={cn('flex flex-col gap-1', lines.length > 0 && 'mt-4 border-t pt-4')}>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={on} onCheckedChange={setSingleKeyShortcuts} aria-describedby={hintId} />
                {t('Phím tắt một phím')}
              </label>
              <p id={hintId} className="ps-6.5 text-xs text-muted-foreground sm:ps-6">
                {t(
                  'Bỏ chọn để các phím bấm riêng như N, J, / hay ? không còn tác dụng trong trình duyệt này. Phím tắt có ⌘, Ctrl hoặc Alt vẫn chạy.',
                )}
              </p>
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
