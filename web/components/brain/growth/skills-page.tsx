'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Sprout } from 'lucide-react';
import { growthApi, listAll, type ApiFreshness, type ApiSkill, type ApiSkillDetail } from '@/lib/api/growth';
import { useApi } from '@/lib/api/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { ApiErrorState, ApiStaleAlert, EmptyState } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { freshness, freshnessOrder } from './labels';
import { SkillDialog } from './skill-dialog';
import { SkillSheet } from './skill-sheet';
import { useShortcuts } from './shared';

type Filter = ApiFreshness | 'all';
const filterChoices: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Mọi độ mới' },
  ...freshnessOrder.map((f) => ({ value: f, label: freshness[f].label })),
];

const loadSkills = () => listAll(growthApi.listSkills({ limit: 200 }));

/** A matrix tile: colour and fading carry freshness; the word under the name says it for everyone. */
function SkillTile({ skill, onOpen }: { skill: ApiSkill; onOpen: () => void }) {
  const f = freshness[skill.freshness];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex h-full w-full flex-col items-start gap-1 rounded-2xl border p-3 text-start transition-[box-shadow,opacity,filter] duration-200',
          'hover:opacity-100 hover:shadow-popover hover:grayscale-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:grayscale-0',
          f.tile,
        )}
      >
        <span className="font-heading text-[15px] leading-5 font-semibold break-words">{skill.name}</span>
        {skill.aliases.length > 0 && (
          <span className="line-clamp-1 text-xs opacity-80">{skill.aliases.join(', ')}</span>
        )}
        <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-medium">
          <span className={cn('size-2 rounded-full', f.dot)} aria-hidden />
          {f.label}
        </span>
      </button>
    </li>
  );
}

function Legend({ counts }: { counts: Record<ApiFreshness, number> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Chú giải">
      {freshnessOrder.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cn('size-3 rounded border', freshness[k].tile)} aria-hidden />
          <span>
            <span className="font-medium text-foreground">{freshness[k].label}</span> ({freshness[k].hint}):{' '}
            {counts[k]} kỹ năng
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Kỹ năng: the portable skills matrix (DECISIONS 6.5, 9.2). */
export function SkillsPage() {
  const skills = useApi('skills:all', loadSkills);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<ApiSkillDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => skills.data ?? [], [skills.data]);
  const counts = useMemo(() => {
    const c: Record<ApiFreshness, number> = { fresh: 0, aging: 0, faded: 0 };
    for (const s of all) c[s.freshness] += 1;
    return c;
  }, [all]);
  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (s) =>
      (filter === 'all' || s.freshness === filter) &&
      (!q || s.name.toLowerCase().includes(q) || s.aliases.some((a) => a.toLowerCase().includes(q))),
  );

  const create = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useShortcuts({ n: create, '/': () => searchRef.current?.focus() });

  return (
    <div className="flex flex-col gap-5 px-4 pb-12 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceSelect label="Độ mới" value={filter} onChange={setFilter} choices={filterChoices} className="w-auto" />
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={searchRef}
            data-local-search
            type="search"
            aria-label="Tìm kỹ năng"
            placeholder="Tìm theo tên hoặc tên khác"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ps-6"
          />
        </div>
        <Button className="ms-auto" onClick={create}>
          <Plus aria-hidden />
          Thêm kỹ năng <Kbd className="hidden sm:inline-flex">N</Kbd>
        </Button>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={skills} />
      {skills.error && !skills.data ? (
        <ApiErrorState error={skills.error} onRetry={skills.reload} />
      ) : !skills.data ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6" aria-busy="true" aria-label="Đang tải">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </ul>
      ) : all.length === 0 ? (
        <EmptyState
          icon={<Sprout aria-hidden />}
          title="Ma trận còn trống"
          description="Thêm các kỹ năng nền và kỹ năng của vai trò nhắm tới, rồi gắn bằng chứng: thứ đã ship, case study, bài viết."
        >
          <Button onClick={create}>
            <Plus aria-hidden />
            Thêm kỹ năng đầu tiên
          </Button>
        </EmptyState>
      ) : (
        <>
          <Legend counts={counts} />
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Không có kỹ năng nào khớp bộ lọc.</p>
          ) : (
            <ul
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
              aria-label="Ma trận kỹ năng"
            >
              {shown.map((s) => (
                <SkillTile key={s.id} skill={s} onOpen={() => setOpenId(s.id)} />
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Bấm một kỹ năng để xem và gắn bằng chứng. So với tin tuyển dụng ở trang{' '}
            <Link href="/phat-trien/thi-truong/" className="underline underline-offset-4">
              Thị trường
            </Link>
            . Phím <Kbd>/</Kbd> để tìm.
          </p>
        </>
      )}

      <SkillSheet
        skillId={openId}
        version={version}
        onClose={() => setOpenId(null)}
        onEdit={(s) => {
          setEditing(s);
          setDialogOpen(true);
        }}
        onChanged={skills.reload}
      />
      <SkillDialog
        open={dialogOpen}
        skill={editing}
        onOpenChange={setDialogOpen}
        onSaved={(saved, created) => {
          setDialogOpen(false);
          setNotice(created ? `Đã thêm "${saved.name}"` : `Đã lưu "${saved.name}"`);
          skills.reload();
          if (created) setOpenId(saved.id);
          else setVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
