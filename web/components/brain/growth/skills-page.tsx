'use client';
import { useMemo, useRef, useState } from 'react';
import { ListChecks, Plus, Search } from 'lucide-react';
import { growthApi, listAll, type ApiFreshness, type ApiSkill, type ApiSkillDetail } from '@/lib/api/growth';
import { toApiError, useApi } from '@/lib/api/use-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useOpenFromUrl } from '@/lib/use-open-from-url';
import { ApiErrorState, ApiStaleAlert, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ChoiceSelect } from '../choice-select';
import { EmptyPanel, useToolbarState } from '../empty-panel';
import { PAGE_WIDTH } from '../layout';
import { fieldErrors, freshness, freshnessOrder } from './labels';
import { SkillDialog } from './skill-dialog';
import { SkillSheet } from './skill-sheet';
import { useShortcuts } from './shared';

type Filter = ApiFreshness | 'all';

const loadSkills = () => listAll(growthApi.listSkills({ limit: 200 }));

const matrixGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6';

/** First-run quick adds: skills the handbooks teach (Sổ tay 1-5, An ninh mạng, PM); one click creates one. */
const suggestedSkills = ['Excel', 'SQL', 'Python', 'Business English', 'An ninh mạng', 'Quản lý dự án'];

/**
 * A matrix tile (DECISIONS 9.1: a matrix, staleness by colour, no number): one bordered container, the freshness dot
 * beside the name, the word as a StatusBadge; a faded skill's name goes muted.
 */
function SkillTile({ skill, onOpen }: { skill: ApiSkill; onOpen: () => void }) {
  const f = freshness[skill.freshness];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full min-h-20 w-full flex-col items-start gap-2 rounded-xl border bg-card p-3 text-start transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex w-full min-w-0 items-start gap-2">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', f.dot)} aria-hidden />
          <span
            className={cn(
              'line-clamp-2 text-sm font-medium break-words',
              skill.freshness === 'faded' && 'text-muted-foreground',
            )}
          >
            {skill.name}
          </span>
        </span>
        <span className="mt-auto flex w-full min-w-0 items-center gap-2">
          <StatusBadge tone={f.tone}>{f.label}</StatusBadge>
          {skill.aliases.length > 0 && (
            <span className="truncate text-xs text-muted-foreground">{skill.aliases.join(', ')}</span>
          )}
        </span>
      </button>
    </li>
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
  const [adding, setAdding] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // ?id=N (Cmd+K result): open that skill's sheet.
  useOpenFromUrl('id', setOpenId);

  const all = useMemo(() => skills.data ?? [], [skills.data]);
  const counts = useMemo(() => {
    const c: Record<ApiFreshness, number> = { fresh: 0, aging: 0, faded: 0 };
    for (const s of all) c[s.freshness] += 1;
    return c;
  }, [all]);
  const filterChoices = useMemo(
    (): { value: Filter; label: string }[] => [
      { value: 'all', label: skills.data ? `Mọi độ mới · ${all.length}` : 'Mọi độ mới' },
      ...freshnessOrder.map((f) => ({
        value: f,
        label: skills.data ? `${freshness[f].label} · ${counts[f]}` : freshness[f].label,
      })),
    ],
    [skills.data, all.length, counts],
  );
  const q = query.trim().toLowerCase();
  const shown = all.filter(
    (s) =>
      (filter === 'all' || s.freshness === filter) &&
      (!q || s.name.toLowerCase().includes(q) || s.aliases.some((a) => a.toLowerCase().includes(q))),
  );

  const empty = !!skills.data && all.length === 0;
  // The first-run panel ignores filters (none can be set while it shows), so they do not count here either.
  const toolbar = useToolbarState({
    rows: all.length,
    filtered: false,
    loading: skills.loading,
    failed: !!skills.error && !skills.data,
    count: 'skills',
  });
  const clearFilters = () => {
    setFilter('all');
    setQuery('');
  };

  const create = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useShortcuts({ n: create, '/': () => searchRef.current?.focus() });

  /** A suggested skill: created on click (POST /api/skills), then its sheet opens for the first evidence. */
  const quickAdd = async (name: string) => {
    if (adding) return;
    setAdding(name);
    setNotice(null);
    try {
      const saved = await growthApi.createSkill({ name });
      setNotice(`Đã thêm "${saved.name}"`);
      skills.reload();
      setOpenId(saved.id);
    } catch (err) {
      const e = toApiError(err);
      setNotice((e.status === 400 && fieldErrors(e.body, { name: 'Tên' })) || describeApiError(e).title);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className={cn(PAGE_WIDTH, 'flex flex-col gap-6 px-4 pb-12 sm:px-8')}>
      {/* 390 px: filter + "Thêm kỹ năng" on row 1, search full width on row 2 (DESIGN.md §6 Toolbar). Hidden while
          the matrix is empty: the first-run panel carries the one add (D26). */}
      {toolbar !== 'hide' && (
        <div className={cn('flex flex-wrap items-center gap-2', toolbar === 'wait' && 'invisible')}>
          <ChoiceSelect label="Độ mới" value={filter} onChange={setFilter} choices={filterChoices} className="w-auto" />
          <div className="relative order-last w-full sm:order-none sm:w-64">
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
            Thêm kỹ năng <Kbd className="max-sm:hidden pointer-coarse:hidden">N</Kbd>
          </Button>
        </div>
      )}

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ApiStaleAlert result={skills} />
      {skills.error && !skills.data ? (
        <ApiErrorState error={skills.error} onRetry={skills.reload} />
      ) : !skills.data ? (
        <ul className={matrixGrid} aria-busy="true" aria-label="Đang tải">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-20 rounded-xl" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        <EmptyPanel
          glyph={ListChecks}
          title="Chưa có kỹ năng nào"
          text="Thêm kỹ năng nền và kỹ năng của vai trò nhắm tới, rồi gắn bằng chứng: thứ đã ship, case study, bài viết."
          action={
            <Button onClick={create} aria-keyshortcuts="n">
              <Plus aria-hidden />
              Thêm kỹ năng đầu tiên
              <Kbd className="ms-1 bg-primary-foreground/20 text-primary-foreground pointer-coarse:hidden max-sm:hidden">N</Kbd>
            </Button>
          }
          quick={
            <>
              {suggestedSkills.map((name) => (
                <Button
                  key={name}
                  size="sm"
                  variant="outline"
                  loading={adding === name}
                  disabled={adding !== null}
                  aria-label={`Thêm kỹ năng ${name}`}
                  onClick={() => void quickAdd(name)}
                >
                  <Plus aria-hidden />
                  {name}
                </Button>
              ))}
            </>
          }
          guide="skill"
        />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có mục nào khớp bộ lọc.{' '}
          <Button variant="link" size="sm" className="px-0" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        </p>
      ) : (
        <ul className={matrixGrid} aria-label="Ma trận kỹ năng">
          {shown.map((s) => (
            <SkillTile key={s.id} skill={s} onOpen={() => setOpenId(s.id)} />
          ))}
        </ul>
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
