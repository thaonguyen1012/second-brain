'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiStance } from '@/lib/api/client';
import { opportunitiesApi, type ApiEvidence, type ApiEvidenceKind } from '@/lib/api/opportunities';
import { toApiError } from '@/lib/api/use-api';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg } from '@/lib/i18n/translate';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { useInvalidFields } from '../invalid-fields';
import { evidenceKinds, fieldErrors, stances, todayIso } from './labels';

/** Kinds the owner adds by hand here; inbox, item and note evidence come from their own pages. */
type ManualKind = Extract<ApiEvidenceKind, 'conversation' | 'link'>;

const manualKinds: { value: ManualKind; label: Msg }[] = [
  { value: 'conversation', label: msg('Cuộc nói chuyện (The Mom Test)') },
  { value: 'link', label: msg('Link (nguồn bên ngoài)') },
];

export type EvidenceTarget = { mode: 'add'; kind: ManualKind } | { mode: 'edit'; evidence: ApiEvidence };

function EvidenceForm({
  opportunityId,
  target,
  onSaved,
}: {
  opportunityId: number;
  target: EvidenceTarget;
  onSaved: (evidence: ApiEvidence, created: boolean) => void;
}) {
  const t = useT();
  const ev = target.mode === 'edit' ? target.evidence : null;
  const [kind, setKind] = useState<ApiEvidenceKind>(ev?.kind ?? (target.mode === 'add' ? target.kind : 'link'));
  const [stance, setStance] = useState<ApiStance>(ev?.stance ?? 'supports');
  const [title, setTitle] = useState(ev?.title ?? '');
  const [url, setUrl] = useState(ev?.url ?? '');
  const [note, setNote] = useState(ev?.note ?? '');
  const [date, setDate] = useState(ev?.date ?? todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  const showUrl = kind === 'link' || !!ev?.url;

  const submit = async () => {
    if (!title.trim()) {
      setError(invalid.mark(t(kind === 'conversation' ? 'Cần ghi nói chuyện với ai.' : 'Cần có tiêu đề.'), 'title'));
      return;
    }
    if (kind === 'link' && !/^https?:\/\/\S+$/i.test(url.trim())) {
      setError(invalid.mark(t('Link phải bắt đầu bằng http:// hoặc https://.'), 'url'));
      return;
    }
    const fields = {
      stance,
      title: title.trim(),
      note: note.trim(),
      ...(date && { date }),
      ...(showUrl && { url: url.trim() }),
    };
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const saved = ev
        ? await opportunitiesApi.updateEvidence(opportunityId, ev.id, fields)
        : await opportunitiesApi.addEvidence(opportunityId, { kind, ...fields });
      onSaved(saved, !ev);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t)) || describeApiError(e, t).title);
      invalid.fromError(e, t);
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
        <div className="grid gap-4 sm:grid-cols-2">
          {!ev && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-kind">{t('Loại')}</Label>
              <ChoiceSelect
                id="ev-kind"
                {...invalid.field('kind')}
                label={t('Loại bằng chứng')}
                value={kind as ManualKind}
                onChange={setKind}
                choices={manualKinds.map((k) => ({ value: k.value, label: t(k.label) }))}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-stance">{t('Ủng hộ hay phản bác')}</Label>
            <ChoiceSelect
              id="ev-stance"
              {...invalid.field('stance')}
              label={t('Ủng hộ hay phản bác')}
              value={stance}
              onChange={setStance}
              choices={stances.map((s) => ({ value: s.value, label: t(s.label) }))}
            />
          </div>
          {ev && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ev-date">{t('Ngày')}</Label>
              <Input
                id="ev-date"
                type="date"
                {...invalid.field('date')}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-title">
            {t(kind === 'conversation' ? 'Nói chuyện với ai (vai trò, công ty)' : 'Tiêu đề')}
          </Label>
          <Input
            id="ev-title"
            aria-required
            {...invalid.field('title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        {showUrl && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ev-url">{t('Link')}</Label>
            <Input
              id="ev-url"
              type="url"
              inputMode="url"
              aria-required={kind === 'link' || undefined}
              {...invalid.field('url')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ev-note">
            {t(kind === 'conversation' ? 'Họ nói gì (sự việc đã xảy ra, không phải lời khen)' : 'Ghi chú')}
          </Label>
          <Textarea id="ev-note" rows={4} {...invalid.field('note')} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {!ev && (
          <div className="flex flex-col gap-1.5 sm:w-1/2">
            <Label htmlFor="ev-date">{t('Ngày')}</Label>
            <Input
              id="ev-date"
              type="date"
              {...invalid.field('date')}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
        {invalid.copies}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t(ev ? 'Lưu' : 'Thêm bằng chứng')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Add conversation or link evidence, or edit any evidence (stance, title, url, note, date). */
export function EvidenceDialog({
  opportunityId,
  target,
  onClose,
  onSaved,
}: {
  opportunityId: number;
  target: EvidenceTarget | null;
  onClose: () => void;
  onSaved: (evidence: ApiEvidence, created: boolean) => void;
}) {
  const t = useT();
  const ev = target?.mode === 'edit' ? target.evidence : null;
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }}>
        <DialogHeader>
          <DialogTitle>{t(ev ? 'Sửa bằng chứng' : 'Thêm bằng chứng')}</DialogTitle>
          <DialogDescription>
            {ev
              ? t(evidenceKinds[ev.kind])
              : t(
                  'Cuộc nói chuyện thật hoặc một nguồn bên ngoài. Tin từ bản tin sáng và mục inbox được gắn từ trang của chúng.',
                )}
          </DialogDescription>
        </DialogHeader>
        {target && (
          <EvidenceForm
            key={ev ? `edit-${ev.id}` : `add-${target.mode === 'add' ? target.kind : ''}`}
            opportunityId={opportunityId}
            target={target}
            onSaved={onSaved}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
