'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { growthApi, type ApiSkillDetail } from '@/lib/api/growth';
import { toApiError } from '@/lib/api/use-api';
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
import { fieldErrors, splitList } from './labels';
import { FormError, FormRow, hintId } from './shared';

const fieldNames: Record<string, Msg> = { name: msg('Tên'), aliases: msg('Tên khác'), note: msg('Ghi chú') };

function SkillForm({
  skill,
  initialName,
  onSaved,
}: {
  skill: ApiSkillDetail | null;
  initialName?: string;
  onSaved: (skill: ApiSkillDetail, created: boolean) => void;
}) {
  const t = useT();
  const [name, setName] = useState(skill?.name ?? initialName ?? '');
  const [aliases, setAliases] = useState((skill?.aliases ?? []).join(', '));
  const [note, setNote] = useState(skill?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError(t('Cần có tên kỹ năng.'));
      return;
    }
    const body = { name: name.trim(), aliases: splitList(aliases), note: note.trim() };
    setBusy(true);
    setError(null);
    try {
      const saved = skill ? await growthApi.updateSkill(skill.id, body) : await growthApi.createSkill(body);
      onSaved(saved, !skill);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title);
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
        <FormRow id="skill-name" label={t('Tên kỹ năng')}>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </FormRow>
        <FormRow
          id="skill-aliases"
          label={t('Tên khác (cách nhau bằng dấu phẩy)')}
          hint={t('Tin tuyển dụng gọi kỹ năng này bằng các tên đó cũng được tính, ví dụ: postgres, psql.')}
        >
          <Input
            id="skill-aliases"
            aria-describedby={hintId('skill-aliases')}
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
          />
        </FormRow>
        <FormRow id="skill-note" label={t('Ghi chú')}>
          <Textarea id="skill-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormRow>
        <FormError error={error} />
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {skill ? t('Lưu') : t('Thêm vào ma trận')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (skill = null) or edit a skill: POST/PATCH /api/skills. No self-rating field (DECISIONS 9.1). */
export function SkillDialog({
  open,
  skill,
  initialName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  skill: ApiSkillDetail | null;
  initialName?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (skill: ApiSkillDetail, created: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }}>
        <DialogHeader>
          <DialogTitle>{skill ? t('Sửa kỹ năng') : t('Thêm kỹ năng')}</DialogTitle>
          <DialogDescription>
            {t('Không tự chấm điểm: kỹ năng sáng lên khi có bằng chứng mới và tự mờ sau 6 tháng không có.')}
          </DialogDescription>
        </DialogHeader>
        {open && <SkillForm key={skill?.id ?? 'new'} skill={skill} initialName={initialName} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
