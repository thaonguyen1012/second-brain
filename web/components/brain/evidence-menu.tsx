'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { api, type ApiStance } from '@/lib/api/client';
import { useApi, toApiError } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { describeApiError } from './api-state';
import { loadOpenOpportunities } from './open-opportunities';

const stances: { value: ApiStance; label: Msg }[] = [
  { value: 'supports', label: msg('Ủng hộ') },
  { value: 'contradicts', label: msg('Phản bác') },
];

/**
 * Overflow of a morning-brief card (DESIGN.md §6 "Row actions": ghost icon-sm MoreHorizontal + tooltip): records
 * the news item as evidence for an open opportunity (DECISIONS 9.2). Sits at the end of the card's action row.
 */
export default function EvidenceMenu({ newsItem }: { newsItem: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const opps = useApi(open ? 'open-opportunities' : null, loadOpenOpportunities);

  const attach = async (id: number, title: string, stance: ApiStance) => {
    setStatus(t('Đang lưu…'));
    try {
      const res = await api.attachNewsEvidence(id, { newsItem, stance });
      setStatus(t(res.created ? 'Đã thêm vào "{title}"' : 'Đã có trong "{title}"', { title }));
    } catch (err) {
      setStatus(describeApiError(toApiError(err), t).title);
    }
  };

  return (
    <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
      {status && (
        <span className="text-xs text-muted-foreground" role="status">
          {status}
        </span>
      )}
      <Menu open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={<Button size="icon-sm" variant="ghost" aria-label={t('Thêm làm bằng chứng cho cơ hội')} />}
              />
            }
          >
            <MoreHorizontal aria-hidden />
          </TooltipTrigger>
          <TooltipPopup>{t('Thêm làm bằng chứng')}</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end" className="w-72">
          <MenuGroup>
            <MenuGroupLabel>{t('Cơ hội đang mở')}</MenuGroupLabel>
            {opps.error && <MenuItem disabled>{describeApiError(opps.error, t).title}</MenuItem>}
            {!opps.error && !opps.data && <MenuItem disabled>{t('Đang tải…')}</MenuItem>}
            {opps.data?.length === 0 && (
              <MenuItem render={<Link href="/co-hoi/" />}>{t('Chưa có cơ hội nào, tạo ở trang Cơ hội')}</MenuItem>
            )}
            {opps.data?.map((o) => (
              <MenuSub key={o.id}>
                <MenuSubTrigger>
                  <span className="truncate">{o.title}</span>
                </MenuSubTrigger>
                <MenuSubPopup>
                  {stances.map((s) => (
                    <MenuItem key={s.value} onClick={() => void attach(o.id, o.title, s.value)}>
                      {t(s.label)}
                    </MenuItem>
                  ))}
                </MenuSubPopup>
              </MenuSub>
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>
    </div>
  );
}
