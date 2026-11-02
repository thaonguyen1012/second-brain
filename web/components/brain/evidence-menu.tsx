'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { api, type ApiStance } from '@/lib/api/client';
import { useApi, toApiError } from '@/lib/api/use-api';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from '@/components/ui/menu';
import { describeApiError } from './api-state';
import { loadOpenOpportunities } from './open-opportunities';

const stances: { value: ApiStance; label: string }[] = [
  { value: 'supports', label: 'Ủng hộ' },
  { value: 'contradicts', label: 'Phản bác' },
];

/** Morning-brief button "bằng chứng cho cơ hội…": records the news item as evidence (DECISIONS 9.2). */
export default function EvidenceMenu({ newsItem }: { newsItem: number }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const opps = useApi(open ? 'open-opportunities' : null, loadOpenOpportunities);

  const attach = async (id: number, title: string, stance: ApiStance) => {
    setStatus('Đang lưu…');
    try {
      const res = await api.attachNewsEvidence(id, { newsItem, stance });
      setStatus(res.created ? `Đã thêm vào "${title}"` : `Đã có trong "${title}"`);
    } catch (err) {
      setStatus(describeApiError(toApiError(err)).title);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Menu open={open} onOpenChange={setOpen}>
        <MenuTrigger render={<Button size="xs" variant="outline" />}>
          <Lightbulb aria-hidden />
          Bằng chứng cho cơ hội…
        </MenuTrigger>
        <MenuPopup align="start" className="w-72">
          <MenuGroupLabel>Cơ hội đang mở</MenuGroupLabel>
          {opps.error && <MenuItem disabled>{describeApiError(opps.error).title}</MenuItem>}
          {!opps.error && !opps.data && <MenuItem disabled>Đang tải…</MenuItem>}
          {opps.data?.length === 0 && (
            <MenuItem render={<Link href="/co-hoi/" />}>Chưa có cơ hội nào, tạo ở trang Cơ hội</MenuItem>
          )}
          {opps.data?.map((o) => (
            <MenuSub key={o.id}>
              <MenuSubTrigger>
                <span className="truncate">{o.title}</span>
              </MenuSubTrigger>
              <MenuSubPopup>
                {stances.map((s) => (
                  <MenuItem key={s.value} onClick={() => void attach(o.id, o.title, s.value)}>
                    {s.label}
                  </MenuItem>
                ))}
              </MenuSubPopup>
            </MenuSub>
          ))}
        </MenuPopup>
      </Menu>
      {status && (
        <span className="text-xs text-muted-foreground" role="status">
          {status}
        </span>
      )}
    </div>
  );
}
