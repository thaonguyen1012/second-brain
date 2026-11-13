'use client';
import { useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import { growthApi, listAll, type ApiAchievement, type ApiAchievementWrite } from '@/lib/api/growth';
import { toApiError, useApi } from '@/lib/api/use-api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { useInvalidFields } from '../invalid-fields';
import { fieldErrors } from './labels';
import { FormError, FormRow, hintId } from './shared';
import { SaveKeys } from '../save-keys';

const fieldNames: Record<string, Msg> = {
  title: msg('Việc đã làm'),
  impact: msg('Kết quả'),
  description: msg('Mô tả'),
  date: msg('Ngày'),
  project: msg('Dự án'),
  skills: msg('Kỹ năng'),
};

const loadProjects = () => listAll(api.listItems({ type: 'project', limit: 200 }), 400);
const loadSkills = () => listAll(growthApi.listSkills({ limit: 200 }));

function SkillToggles({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const t = useT();
  const skills = useApi('achievement-skills', loadSkills);
  if (skills.error && !skills.data)
    return <p className="text-sm text-destructive-foreground">{describeApiError(skills.error, t).title}</p>;
  if (!skills.data) return <p className="text-sm text-muted-foreground">{t('Đang tải kỹ năng…')}</p>;
  if (skills.data.length === 0)
    return <p className="text-sm text-muted-foreground">{t('Ma trận kỹ năng còn trống. Thêm ở trang Kỹ năng.')}</p>;
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Kỹ năng đã dùng')}>
      {skills.data.map((s) => {
        const on = value.includes(s.id);
        return (
          <Button
            key={s.id}
            type="button"
            size="xs"
            variant={on ? 'default' : 'outline'}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((id) => id !== s.id) : [...value, s.id])}
          >
            {on && <Check aria-hidden />}
            {s.name}
          </Button>
        );
      })}
    </div>
  );
}

function AchievementForm({
  achievement,
  defaultDate,
  onSaved,
}: {
  achievement: ApiAchievement | null;
  defaultDate: string;
  onSaved: (a: ApiAchievement, created: boolean) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(achievement?.title ?? '');
  const [impact, setImpact] = useState(achievement?.impact ?? '');
  const [description, setDescription] = useState(achievement?.description ?? '');
  const [date, setDate] = useState(achievement?.date ?? defaultDate);
  const [project, setProject] = useState(achievement?.project ? String(achievement.project) : '');
  const [skills, setSkills] = useState<number[]>(achievement?.skills.map((s) => s.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  // Set synchronously, so a second Cmd+Enter before the re-render cannot POST twice.
  const inFlight = useRef(false);
  const projects = useApi('achievement-projects', loadProjects);
  const projectChoices = [
    { value: '', label: t('Không gắn dự án') },
    ...(projects.data ?? []).map((p) => ({ value: String(p.id), label: p.title })),
    // keep the current project selectable while the list loads
    ...(achievement?.project && !projects.data
      ? [{ value: String(achievement.project), label: achievement.projectTitle ?? `#${achievement.project}` }]
      : []),
  ];

  const submit = async () => {
    if (inFlight.current) return;
    if (!title.trim()) {
      setError(invalid.mark(t('Cần ghi việc đã làm.'), 'title'));
      return;
    }
    const body: ApiAchievementWrite = {
      title: title.trim(),
      impact: impact.trim(),
      description: description.trim(),
      ...(date && { date }),
      project: project ? Number(project) : null,
      skills,
    };
    inFlight.current = true;
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const saved = achievement
        ? await growthApi.updateAchievement(achievement.id, body)
        : await growthApi.createAchievement(body);
      onSaved(saved, !achievement);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title);
      invalid.fromError(e, t);
      inFlight.current = false;
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
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          if (!e.repeat) void submit();
        }
      }}
    >
      <DialogPanel className="flex flex-col gap-4">
        <FormRow id="ach-title" label={t('Việc đã làm')}>
          <Input
            id="ach-title"
            aria-required
            {...invalid.field('title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('Ship trang thanh toán mới')}
            autoFocus
          />
        </FormRow>
        <FormRow
          id="ach-impact"
          label={t('Kết quả bằng số')}
          hint={t('Con số dùng được trong CV: thời gian, tiền, người dùng, lỗi giảm…')}
        >
          <Input
            id="ach-impact"
            {...invalid.field('impact', hintId('ach-impact'))}
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder={t('Thanh toán 40 s → 12 s')}
          />
        </FormRow>
        <FormRow id="ach-description" label={t('Mô tả (không bắt buộc)')}>
          <Textarea
            id="ach-description"
            {...invalid.field('description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <FormRow id="ach-date" label={t('Ngày')}>
            <Input
              id="ach-date"
              type="date"
              {...invalid.field('date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </FormRow>
          <FormRow id="ach-project" label={t('Dự án')}>
            <ChoiceSelect
              id="ach-project"
              {...invalid.field('project')}
              label={t('Dự án')}
              value={project}
              onChange={setProject}
              choices={projectChoices}
            />
          </FormRow>
        </div>
        <FormRow id="ach-skills" label={t('Kỹ năng đã dùng')}>
          <SkillToggles value={skills} onChange={setSkills} />
        </FormRow>
        <FormError error={error} />
        {invalid.copies}
      </DialogPanel>
      <DialogFooter>
        <span className="me-auto self-center text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> {t('để lưu')}
        </span>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {achievement ? t('Lưu') : t('Ghi vào nhật ký')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (achievement = null) or edit a brag-document line: POST/PATCH /api/achievements. */
export function AchievementDialog({
  open,
  achievement,
  defaultDate,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  achievement: ApiAchievement | null;
  defaultDate: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (a: ApiAchievement, created: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{achievement ? t('Sửa thành tựu') : t('Ghi thành tựu')}</DialogTitle>
          <DialogDescription>{t('Mỗi việc một dòng, kèm kết quả bằng số để sau này viết CV theo kết quả.')}</DialogDescription>
        </DialogHeader>
        {open && (
          <AchievementForm
            key={achievement?.id ?? 'new'}
            achievement={achievement}
            defaultDate={defaultDate}
            onSaved={onSaved}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
