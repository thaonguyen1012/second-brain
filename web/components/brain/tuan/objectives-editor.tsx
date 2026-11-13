'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ApiObjective } from '@/lib/api/client';
import { type ApiObjectiveStatus, weeksApi } from '@/lib/api/weeks';
import { useT } from '@/lib/i18n/client';
import { objectiveStatuses } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MenuItem, MenuSeparator, MenuShortcut } from '@/components/ui/menu';
import { StatusBadge } from '../brain-card';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WriteError } from './week-section';
import { minutesShort } from './week-utils';

const statusChoices = (['open', 'done', 'dropped'] as const).map((value) => ({
  value,
  label: objectiveStatuses[value].label,
}));

/** Row keys: one key, one decision (same idea as the inbox triage). */
const statusKeys: Record<string, ApiObjectiveStatus> = { d: 'done', x: 'dropped', o: 'open' };

/** Status picker whose value is the coloured status badge (lib/labels.ts), as everywhere else. */
function StatusSelect({
  value,
  label,
  onChange,
}: {
  value: ApiObjectiveStatus;
  label: string;
  onChange: (value: ApiObjectiveStatus) => void;
}) {
  const t = useT();
  const items = statusChoices.map((c) => ({ value: c.value, label: t(c.label) }));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => v !== null && onChange(v as ApiObjectiveStatus)}
    >
      <SelectTrigger aria-label={label} className="w-auto min-w-0 sm:min-h-7">
        <SelectValue>
          {(v: ApiObjectiveStatus) => {
            const s = objectiveStatuses[v] ?? objectiveStatuses.open;
            return <StatusBadge tone={s.tone}>{t(s.label)}</StatusBadge>;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

/**
 * 3–5 objectives is a guideline (API_CONTRACT.md), never enforced: one plain meta line (DESIGN.md §7), with the
 * example the short "Kết quả muốn có" placeholder leaves out; above 5 it turns into a gentle warning.
 */
export function ObjectiveHint({ objectives }: { objectives: ApiObjective[] }) {
  const t = useT();
  const active = objectives.filter((o) => o.status !== 'dropped').length;
  const warn = active > 5;
  return (
    <p className={cn('text-xs leading-relaxed', warn ? 'text-warning-foreground' : 'text-muted-foreground')}>
      {warn
        ? t('{n} mục tiêu: hơn 5 thường là quá nhiều. Cân nhắc bỏ bớt hoặc để sang tuần sau.', { n: active })
        : t('3–5 mục tiêu: kết quả muốn có, không phải danh sách task. Ví dụ: Gửi báo giá cho 2 khách.')}
    </p>
  );
}

/** A change to the week's objectives, applied to the newest list (never to a stale copy). */
export type ObjectivesUpdate = (current: ApiObjective[]) => ApiObjective[];

const byPosition = (list: ApiObjective[]) => [...list].sort((a, b) => a.position - b.position || a.id - b.id);

/**
 * The week's objectives: add, rename, change status, reorder and delete (with confirmation). Updates are optimistic: `onChange` applies
 * the change at once; if Django refuses, only the rows of that call go back (and only if no later write
 * touched them), and a failed reorder reloads the order from the server. Moves are sent one after another.
 * `minutes` (review) shows the time logged per objective.
 */
export function ObjectivesEditor({
  start,
  objectives,
  onChange,
  minutes,
  allowAdd = true,
}: {
  start: string;
  objectives: ApiObjective[];
  onChange: (update: ObjectivesUpdate) => void;
  minutes?: Map<number, number>;
  allowAdd?: boolean;
}) {
  const t = useT();
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null);
  const [deleting, setDeleting] = useState<ApiObjective | null>(null);
  // Row to focus after the next render (after a move or an edit), so the keyboard cursor follows the row.
  const focusId = useRef<number | null>(null);
  const setFocusId = (id: number) => {
    focusId.current = id;
  };
  const rows = useRef(new Map<number, HTMLLIElement>());

  useEffect(() => {
    if (focusId.current === null) return;
    rows.current.get(focusId.current)?.focus();
    focusId.current = null;
  });

  // Newest write per objective id, so a late failure does not undo a later write that succeeded.
  const lastWrite = useRef(new Map<number, number>());
  const writes = useRef(0);
  // Reorders run one after another: two quick moves never race on the same row's position.
  const moves = useRef<Promise<unknown>>(Promise.resolve());

  async function write(
    changes: Map<number, Partial<ApiObjective>>,
    call: () => Promise<unknown>,
    reloadOnError = false,
  ) {
    const n = ++writes.current;
    const before = new Map<number, Partial<ApiObjective>>();
    for (const [id, c] of changes) {
      const o = objectives.find((x) => x.id === id);
      if (o) before.set(id, Object.fromEntries(Object.keys(c).map((k) => [k, o[k as keyof ApiObjective]])));
      lastWrite.current.set(id, n);
    }
    setError(null);
    onChange((list) => byPosition(list.map((x) => (changes.has(x.id) ? { ...x, ...changes.get(x.id) } : x))));
    try {
      await call();
    } catch (err) {
      setError(err);
      if (reloadOnError) {
        // Some positions may be saved and some not: take the order the server has.
        try {
          const fresh = byPosition((await weeksApi.getPlan(start)).week.objectives);
          onChange(() => fresh);
          return;
        } catch {
          // fall back to the local rollback below
        }
      }
      onChange((list) =>
        byPosition(
          list.map((x) => (before.has(x.id) && lastWrite.current.get(x.id) === n ? { ...x, ...before.get(x.id) } : x)),
        ),
      );
    }
  }

  function patch(o: ApiObjective, changes: { title?: string; status?: ApiObjectiveStatus }) {
    void write(new Map([[o.id, changes]]), () => weeksApi.updateObjective(start, o.id, changes));
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= objectives.length) return;
    const order = [...objectives];
    const [moved] = order.splice(index, 1);
    order.splice(to, 0, moved);
    // Positions become 0..n-1; only the rows whose position changed are written.
    const next = order.map((o, i) => (o.position === i ? o : { ...o, position: i }));
    const changed = next.filter((o, i) => objectives.find((x) => x.id === o.id)?.position !== i);
    setFocusId(moved.id);
    const run = moves.current.then(async () => {
      for (const o of changed) await weeksApi.updateObjective(start, o.id, { position: o.position });
    });
    moves.current = run.catch(() => undefined);
    void write(new Map(changed.map((o) => [o.id, { position: o.position }])), () => run, true);
  }

  function saveTitle(refocus: boolean) {
    if (!editing) return;
    const o = objectives.find((x) => x.id === editing.id);
    const title = editing.title.trim();
    setEditing(null);
    if (o && title && title !== o.title) patch(o, { title });
    if (o && refocus) setFocusId(o.id);
  }

  async function add() {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    setError(null);
    try {
      const created = await weeksApi.addObjective(start, title);
      onChange((list) => [...list, created]);
      setDraft('');
    } catch (err) {
      setError(err);
    } finally {
      setAdding(false);
    }
  }

  function onRowKey(e: React.KeyboardEvent<HTMLLIElement>, o: ApiObjective, index: number) {
    if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      move(index, e.key === 'ArrowUp' ? -1 : 1);
    } else if (!e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const other = objectives[index + (e.key === 'ArrowUp' ? -1 : 1)];
      if (other) rows.current.get(other.id)?.focus();
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      setEditing({ id: o.id, title: o.title });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setDeleting(o);
    } else if (!e.altKey && !e.shiftKey && statusKeys[e.key]) {
      e.preventDefault();
      if (o.status !== statusKeys[e.key]) patch(o, { status: statusKeys[e.key] });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {objectives.length > 0 && (
        <ol className="-mx-2 flex flex-col" aria-label={t('Mục tiêu tuần')}>
          {objectives.map((o, i) => {
            const status = o.status ?? 'open';
            const s = objectiveStatuses[status] ?? objectiveStatuses.open;
            const m = minutes?.get(o.id);
            return (
              <li
                key={o.id}
                ref={(el) => {
                  if (el) rows.current.set(o.id, el);
                  else rows.current.delete(o.id);
                }}
                tabIndex={0}
                aria-label={`${i + 1}. ${o.title}, ${t(s.label)}`}
                onKeyDown={(e) => onRowKey(e, o, i)}
                className="group flex min-h-10 flex-wrap items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>
                {editing?.id === o.id ? (
                  <Input
                    autoFocus
                    size="sm"
                    aria-label={t('Tên mục tiêu')}
                    value={editing.title}
                    onChange={(e) => setEditing({ id: o.id, title: e.target.value })}
                    onBlur={() => saveTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveTitle(true);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(null);
                        setFocusId(o.id);
                      }
                    }}
                    className="min-w-0 flex-1 basis-48"
                  />
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setEditing({ id: o.id, title: o.title })}
                    className={cn(
                      'min-w-0 flex-1 basis-48 text-start text-sm font-medium break-words hover:text-primary',
                      status === 'dropped' && 'text-muted-foreground line-through',
                    )}
                    title={t('Sửa tên')}
                  >
                    {o.title}
                  </button>
                )}
                <div className="ms-auto flex shrink-0 items-center gap-1.5">
                  {o.carriedFrom !== null && <Badge variant="outline">{t('Từ tuần trước')}</Badge>}
                  {m !== undefined && m > 0 && (
                    <Badge variant="secondary" title={t('Giờ đã ghi cho mục tiêu này')}>
                      {minutesShort(m, t)}
                    </Badge>
                  )}
                  <StatusSelect
                    value={status}
                    label={t('Trạng thái: {title}', { title: o.title })}
                    onChange={(v) => v !== status && patch(o, { status: v })}
                  />
                  {/* Rename, reorder and delete live in one menu (DESIGN.md D22); the row keys still do them */}
                  <RowMenu label={t('Thao tác cho "{title}"', { title: o.title })}>
                    <MenuItem onClick={() => setEditing({ id: o.id, title: o.title })}>
                      <Pencil aria-hidden />
                      {t('Sửa tên')}
                      <MenuShortcut>Enter</MenuShortcut>
                    </MenuItem>
                    <MenuItem disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp aria-hidden />
                      {t('Đưa lên')}
                      <MenuShortcut>Alt+↑</MenuShortcut>
                    </MenuItem>
                    <MenuItem disabled={i === objectives.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown aria-hidden />
                      {t('Đưa xuống')}
                      <MenuShortcut>Alt+↓</MenuShortcut>
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem variant="destructive" onClick={() => setDeleting(o)}>
                      <Trash2 aria-hidden />
                      {t('Xóa')}
                      <MenuShortcut>Del</MenuShortcut>
                    </MenuItem>
                  </RowMenu>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {allowAdd && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('Kết quả muốn có')}
            aria-label={t('Thêm mục tiêu')}
            maxLength={200}
            className="flex-1"
          />
          <Button type="submit" variant="outline" disabled={!draft.trim()} loading={adding}>
            <Plus aria-hidden />
            {t('Thêm')}
          </Button>
        </form>
      )}

      <WriteError error={error} />

      <ConfirmDelete
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('Xóa mục tiêu?')}
        description={
          deleting
            ? t(
                '"{title}" bị xóa khỏi tuần này. Giờ đã ghi cho nó vẫn giữ, chỉ không còn gắn với mục tiêu nào; mục tiêu đã chuyển sang tuần sau vẫn giữ tên. Không hoàn tác được.',
                { title: deleting.title },
              )
            : undefined
        }
        action={() => (deleting ? weeksApi.deleteObjective(start, deleting.id) : Promise.resolve())}
        onDeleted={() => {
          if (!deleting) return;
          const gone = deleting.id;
          const index = objectives.findIndex((x) => x.id === gone);
          const neighbour = objectives[index + 1] ?? objectives[index - 1];
          if (neighbour) setFocusId(neighbour.id);
          onChange((list) => list.filter((x) => x.id !== gone));
        }}
      />
    </div>
  );
}
