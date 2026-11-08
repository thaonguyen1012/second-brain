'use client';
import { useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ApiItem } from '@/lib/api/client';
import { itemTypeLabel } from '@/lib/labels';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

const MAX_OPTIONS = 6;

/** Lowercase without Vietnamese diacritics, so "dac nhan tam" finds "Đắc nhân tâm". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/** What a chosen Item badge needs. */
export interface ItemLabel {
  title: string;
  type: string;
}

/**
 * Links a note to Items: chosen Items as removable badges, plus a combobox that searches titles.
 * Keys in the box: ↑/↓ choose, Enter adds, Backspace on an empty box removes the last link.
 */
export function ItemPicker({
  id,
  items,
  byId,
  value,
  onChange,
  status,
}: {
  id: string;
  items: ApiItem[];
  /** Labels of known Items (the full list, or the labels sent with the rows while it loads). */
  byId: ReadonlyMap<number, ItemLabel>;
  value: number[];
  onChange: (ids: number[]) => void;
  /** Loading or error text for the Item list, shown under the box. */
  status?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const options = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return items.filter((i) => !value.includes(i.id) && fold(i.title).includes(q)).slice(0, MAX_OPTIONS);
  }, [items, query, value]);
  const current = Math.min(active, options.length - 1);

  const add = (item: ApiItem) => {
    onChange([...value, item.id]);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('Item đã liên kết')}>
          {value.map((itemId) => {
            const item = byId.get(itemId);
            const title = item?.title ?? `Item #${itemId}`;
            return (
              // the chip shrinks to its column and cuts a long title (390 px: no sideways scroll)
              <li key={itemId} className="min-w-0 max-w-full">
                <Badge variant="outline" size="lg" className="max-w-full shrink gap-1 pe-0.5">
                  {item && (
                    <span className="shrink-0 text-muted-foreground">{t(itemTypeLabel(item.type))} ·</span>
                  )}
                  <span className="min-w-0 truncate sm:max-w-60">{title}</span>
                  <button
                    type="button"
                    className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-accent pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
                    aria-label={t('Bỏ liên kết {title}', { title })}
                    onClick={() => onChange(value.filter((v) => v !== itemId))}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options.length > 0 ? `${listId}-${current}` : undefined}
          autoComplete="off"
          value={query}
          placeholder={t('Gõ tên sách, phim, khóa học…')}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && options.length) {
              e.preventDefault();
              setActive((current + 1) % options.length);
            } else if (e.key === 'ArrowUp' && options.length) {
              e.preventDefault();
              setActive((current - 1 + options.length) % options.length);
            } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
              // never submit the note form from this box
              e.preventDefault();
              if (options[current]) add(options[current]);
            } else if (e.key === 'Escape' && query) {
              e.stopPropagation();
              setQuery('');
            } else if (e.key === 'Backspace' && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
        {options.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t('Item khớp')}
            className="absolute inset-x-0 top-full z-10 mt-1 flex flex-col overflow-hidden rounded-xl border bg-popover p-1 shadow-popover"
          >
            {options.map((item, i) => (
              <li
                key={item.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className={cn(
                  'flex cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1.5 text-sm',
                  i === current && 'bg-accent text-accent-foreground',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => add(item)}
              >
                <span className="shrink-0 text-xs text-muted-foreground">{t(itemTypeLabel(item.type))}</span>
                <span className="truncate">{item.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {query.trim() && options.length === 0 && !status && (
        <p className="text-xs text-muted-foreground">
          {t('Không có item nào khớp (hoặc đã liên kết hết).')}
        </p>
      )}
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  );
}
