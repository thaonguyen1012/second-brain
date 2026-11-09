'use client';
import { useId } from 'react';
import Link from 'next/link';
import { getItemMentions, notesApi, type ApiItemMentions, type ApiNoteMentions } from '@/lib/api/library';
import { useApi } from '@/lib/api/use-api';
import { formatDay } from '@/lib/dates';
import { formatDate } from '@/lib/labels';
import { linkHref } from '@/lib/note-links';
import { useT } from '@/lib/i18n/client';
import { decisionOf, opportunityHref } from '@/lib/labels';
import type { T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiErrorState } from '../api-state';
import { StatusBadge } from '../brain-card';
import { freshness } from '../growth/labels';
import { stanceOf } from '../opportunities/labels';

// "Được nhắc tới ở" at the end of the Item page (DECISIONS 9.8 point 2): the opportunities that use the Item as
// evidence, with the stance of each row in words, the skills that do, with their freshness (the Kỹ năng words and
// dot), and the notes whose text links it (`[[ ]]`, 9.8 order point 3). The note page shows its own backlinks the
// same way (NoteBacklinks). Rows in one container per kind (DESIGN.md §3), each a link to its page.

const row = 'flex min-h-14 items-center gap-3 px-3 py-2';
const linkClass =
  'w-fit max-w-full truncate rounded-sm text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </h3>
      <ul aria-labelledby={id} className="divide-y overflow-hidden rounded-xl border bg-card">
        {children}
      </ul>
    </div>
  );
}

export function ItemMentions({ itemId }: { itemId: number }) {
  const t = useT();
  const headingId = useId();
  const res = useApi<ApiItemMentions>(`item-mentions:${itemId}`, () => getItemMentions(itemId));
  const data = res.data;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="font-heading text-lg font-semibold tracking-tight">
        {t('Được nhắc tới ở')}
      </h2>
      {res.error && !data ? (
        <ApiErrorState error={res.error} onRetry={res.reload} />
      ) : !data ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={t('Đang tải')}>
          <Skeleton className="h-3.5 w-1/2 motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-1/3 motion-reduce:animate-none" />
        </div>
      ) : data.opportunities.length === 0 && data.skills.length === 0 && data.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('Chưa có cơ hội, kỹ năng hay ghi chú nào nhắc tới item này.')}
        </p>
      ) : (
        <>
          {data.opportunities.length > 0 && (
            <Group label={t('Cơ hội', null, 'nav')}>
              {data.opportunities.map((o) => {
                const d = decisionOf(o.decision);
                return (
                  <li key={o.id} className={row}>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={opportunityHref(o.id)} className={linkClass}>
                        {o.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.evidence.map((e, i) => (
                          <span key={e.id}>
                            {i > 0 && '; '}
                            <span className="font-medium text-foreground">{t(stanceOf(e.stance).label)}</span>
                            {` · ${formatDay(e.date)}`}
                          </span>
                        ))}
                      </p>
                    </div>
                    <StatusBadge tone={d.tone}>{t(d.label)}</StatusBadge>
                  </li>
                );
              })}
            </Group>
          )}
          {data.skills.length > 0 && (
            <Group label={t('Kỹ năng')}>
              {data.skills.map((s) => {
                const f = freshness[s.freshness];
                return (
                  <li key={s.id} className={row}>
                    <span className={cn('size-2 shrink-0 rounded-full', f.dot)} aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={`/phat-trien/ky-nang/?id=${s.id}`} className={linkClass}>
                        {s.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {t('{freshness} · bằng chứng {dates}', {
                          freshness: t(f.label),
                          dates: s.evidence.map((e) => formatDay(e.date)).join(', '),
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </Group>
          )}
          {data.notes.length > 0 && <NoteRows notes={data.notes} t={t} />}
        </>
      )}
    </section>
  );
}

/** The notes whose text links the record, newest change first: their title as a link, the day of the change. */
function NoteRows({ notes, t }: { notes: ApiNoteMentions['notes']; t: T }) {
  return (
    <Group label={t('Ghi chú', null, 'nav')}>
      {notes.map((n) => (
        <li key={n.id} className={row}>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link href={linkHref('note', n.id)} className={linkClass}>
              {n.title || t('Ghi chú #{id}', { id: n.id })}
            </Link>
            <p className="truncate text-xs text-muted-foreground">{formatDate(n.updatedAt, t)}</p>
          </div>
        </li>
      ))}
    </Group>
  );
}

/** "Được nhắc tới ở" at the end of a note's page: the notes whose text links this one (its backlinks). */
export function NoteBacklinks({ noteId }: { noteId: number }) {
  const t = useT();
  const headingId = useId();
  const res = useApi<ApiNoteMentions>(`note-mentions:${noteId}`, () => notesApi.mentions(noteId));
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="font-heading text-lg font-semibold tracking-tight">
        {t('Được nhắc tới ở')}
      </h2>
      {res.error && !res.data ? (
        <ApiErrorState error={res.error} onRetry={res.reload} />
      ) : !res.data ? (
        <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={t('Đang tải')}>
          <Skeleton className="h-3.5 w-1/2 motion-reduce:animate-none" />
        </div>
      ) : res.data.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('Chưa có ghi chú nào nhắc tới ghi chú này.')}</p>
      ) : (
        <NoteRows notes={res.data.notes} t={t} />
      )}
    </section>
  );
}
