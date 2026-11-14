'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import type { ApiOpportunity, ApiStance } from '@/lib/api/client';
import { useApi } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { singleKeyShortcut, useSingleKeyShortcuts } from '@/lib/single-key-shortcuts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { ApiErrorState } from './api-state';
import { loadOpenOpportunities } from './open-opportunities';

const NONE: ApiOpportunity[] = [];

/**
 * Picks an open opportunity for an inbox entry. Keys: 1–9 = ủng hộ, Shift+1–9 = phản bác (single keys: shown and
 * answered only while single-key shortcuts are on), Esc = close.
 */
export function OpportunityDialog({
  open,
  onOpenChange,
  entryTitle,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryTitle: string;
  onPick: (opportunity: ApiOpportunity, stance: ApiStance) => void;
}) {
  const t = useT();
  const keys = useSingleKeyShortcuts();
  const opps = useApi(open ? 'open-opportunities' : null, loadOpenOpportunities);
  const list = opps.data ?? NONE;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const m = e.code.match(/^Digit([1-9])$/);
      if (!m || !singleKeyShortcut(e)) return;
      const o = list[Number(m[1]) - 1];
      if (!o) return;
      e.preventDefault();
      onPick(o, e.shiftKey ? 'contradicts' : 'supports');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, list, onPick]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }}>
        <DialogHeader>
          <DialogTitle className="pe-6">{t('Bằng chứng cho cơ hội nào?')}</DialogTitle>
          <DialogDescription className="line-clamp-2">{entryTitle}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {opps.error ? (
            <ApiErrorState error={opps.error} onRetry={opps.reload} />
          ) : !opps.data ? (
            <p className="text-sm text-muted-foreground">{t('Đang tải…')}</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.rich('Chưa có cơ hội nào đang mở. <link>Tạo ở trang Cơ hội</link>.', {
                link: (chunks) => (
                  <Link href="/co-hoi/" className="text-primary underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5">
              {list.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                  {keys && i < 9 && <Kbd>{i + 1}</Kbd>}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.title}</span>
                  {/* every row shows both verbs: each name says which opportunity (the visible word first) */}
                  <Button
                    size="xs"
                    aria-label={t('Ủng hộ "{title}"', { title: o.title })}
                    onClick={() => onPick(o, 'supports')}
                  >
                    {t('Ủng hộ')}
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    aria-label={t('Phản bác "{title}"', { title: o.title })}
                    onClick={() => onPick(o, 'contradicts')}
                  >
                    {t('Phản bác')}
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </DialogPanel>
        <DialogFooter className="text-xs text-muted-foreground sm:justify-start">
          <span>
            {keys
              ? t.rich('<k>1</k>–<k>9</k> ủng hộ · <k>Shift</k>+số phản bác · mục inbox được lưu trữ sau khi gắn', {
                  k: (chunks) => <Kbd>{chunks}</Kbd>,
                })
              : t('Mục inbox được lưu trữ sau khi gắn')}
          </span>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
