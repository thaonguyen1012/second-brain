'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiObjective } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { workApi, type ApiProject, type ApiTimeEntry } from '@/lib/api/work';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/client';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { fieldErrors, formatMinutes, parseDuration, todayPrague } from './format';

interface Form {
  project: string;
  date: string;
  duration: string;
  note: string;
  billable: boolean;
  objective: string;
}

function durationText(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}` : String(m);
}

function EntryForm({
  entry,
  projects,
  objectives,
  defaultProject,
  onSaved,
}: {
  entry: ApiTimeEntry | null;
  projects: ApiProject[];
  objectives: ApiObjective[];
  defaultProject: number | null;
  onSaved: (e: ApiTimeEntry, created: boolean) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<Form>(() => ({
    project: String(entry?.project ?? defaultProject ?? projects[0]?.id ?? ''),
    date: entry?.date ?? todayPrague(),
    duration: durationText(entry?.minutes ?? null),
    note: entry?.note ?? '',
    billable: entry?.billable ?? true,
    objective: entry?.objective ? String(entry.objective) : 'none',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const running = !!entry?.running;
  const minutes = parseDuration(form.duration);

  const projectChoices = projects.map((p) => ({ value: String(p.id), label: p.title }));
  // An entry may point at a project the pickers do not list (e.g. a done project past the first 200).
  if (entry && !projectChoices.some((c) => c.value === String(entry.project)))
    projectChoices.unshift({ value: String(entry.project), label: entry.projectTitle });
  const objectiveChoices = [
    { value: 'none', label: t('Không gắn mục tiêu') },
    ...objectives
      .filter((o) => o.status !== 'dropped' || o.id === entry?.objective)
      .map((o) => ({ value: String(o.id), label: o.title })),
  ];
  if (entry?.objective && !objectiveChoices.some((c) => c.value === String(entry.objective)))
    objectiveChoices.push({ value: String(entry.objective), label: t('Mục tiêu của tuần khác (giữ nguyên)') });

  const submit = async () => {
    if (!form.project) return setError(t('Chọn một dự án.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setError(t('Chọn ngày.'));
    if (!running && minutes === null)
      return setError(t('Thời gian từ 1 phút đến 24 giờ, ví dụ 90, 1:30, 1h30 hoặc 1,5h.'));
    const common = {
      project: Number(form.project),
      date: form.date,
      note: form.note.trim(),
      billable: form.billable,
      objective: form.objective === 'none' ? null : Number(form.objective),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = entry
        ? await workApi.updateTimeEntry(entry.id, running ? common : { ...common, minutes: minutes! })
        : await workApi.createTimeEntry({ ...common, minutes: minutes! });
      onSaved(saved, !entry);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t)) || describeApiError(e, t).title);
      setBusy(false);
    }
  };

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogPanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-project">{t('Dự án')}</Label>
          <ChoiceSelect
            id="entry-project"
            label={t('Dự án')}
            value={form.project}
            onChange={(v) => set('project', v)}
            choices={projectChoices}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-date">{t('Ngày')}</Label>
            <Input id="entry-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-duration">{t('Thời gian')}</Label>
            <Input
              id="entry-duration"
              value={running ? '' : form.duration}
              placeholder={running ? t('Đang chạy') : '1:30'}
              disabled={running}
              aria-describedby="entry-duration-hint"
              onChange={(e) => set('duration', e.target.value)}
              autoFocus={!entry}
            />
            <p id="entry-duration-hint" className="text-xs text-muted-foreground" aria-live="polite">
              {running
                ? t('Dừng bộ bấm giờ trước khi sửa thời gian.')
                : minutes !== null
                  ? `= ${formatMinutes(minutes, t)}`
                  : t('Phút (90), giờ:phút (1:30), 1h30 hoặc 1,5h.')}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-note">{t('Ghi chú')}</Label>
          <Input
            id="entry-note"
            value={form.note}
            maxLength={500}
            onChange={(e) => set('note', e.target.value)}
            autoFocus={!!entry}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-objective">{t('Mục tiêu tuần này (không bắt buộc)')}</Label>
          <ChoiceSelect
            id="entry-objective"
            label={t('Mục tiêu tuần này')}
            value={form.objective}
            onChange={(v) => set('objective', v)}
            choices={objectiveChoices}
          />
        </div>
        <Label className="flex items-center gap-2 font-normal">
          <Checkbox checked={form.billable} onCheckedChange={(v) => set('billable', v)} />
          {t('Tính tiền cho khách')}
        </Label>
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy || projectChoices.length === 0}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {entry ? t('Lưu') : t('Thêm giờ')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Record time by hand (entry = null) or edit an entry: POST/PATCH /api/time-entries. */
export function TimeEntryDialog({
  open,
  entry,
  projects,
  objectives,
  defaultProject,
  loadError,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** Why the project list is empty when it failed to load (shown instead of "no project yet"). */
  loadError?: string | null;
  entry: ApiTimeEntry | null;
  projects: ApiProject[];
  objectives: ApiObjective[];
  defaultProject: number | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (e: ApiTimeEntry, created: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }}>
        <DialogHeader>
          <DialogTitle>{entry ? t('Sửa giờ') : t('Nhập giờ')}</DialogTitle>
        </DialogHeader>
        {open &&
          (projects.length === 0 && !entry ? (
            <DialogPanel>
              <p className="text-sm text-muted-foreground" role={loadError ? 'alert' : undefined}>
                {loadError ?? t('Chưa có dự án. Thêm một dự án ở trang Dự án trước.')}
              </p>
            </DialogPanel>
          ) : (
            <EntryForm
              key={entry?.id ?? 'new'}
              entry={entry}
              projects={projects}
              objectives={objectives}
              defaultProject={defaultProject}
              onSaved={onSaved}
            />
          ))}
      </DialogPopup>
    </Dialog>
  );
}
