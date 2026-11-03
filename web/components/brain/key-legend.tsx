'use client';
import { useEffect, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/**
 * The full keyboard legend of a keyboard-driven page behind one "Phím tắt" control (DESIGN.md §6, D24): a small
 * dialog, also opened with "?". Hidden on touch screens and below md, where the keys do not apply.
 */
export function KeyLegend({ keys, title = 'Phím tắt' }: { keys: [string, string][]; title?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
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
        Phím tắt
        <Kbd>?</Kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="max-w-sm" closeProps={{ 'aria-label': 'Đóng' }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              {keys.map(([k, label]) => (
                <div key={k} className="contents">
                  <dt className="flex justify-end">
                    <Kbd>{k}</Kbd>
                  </dt>
                  <dd className="text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
