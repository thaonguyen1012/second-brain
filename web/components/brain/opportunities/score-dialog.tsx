'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { opportunitiesApi, type ApiScoreSnapshot } from '@/lib/api/opportunities';
import type { ApiOpportunity } from '@/lib/api/client';
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
import { fieldErrors, scoreDims, type ScoreKey } from './labels';

const hints: Record<ScoreKey, Msg> = {
  opportunity: msg('thị trường đủ lớn để đáng làm'),
  pain: msg('họ đau đến mức trả tiền'),
  feasibility: msg('mình làm được với sức hiện có'),
  timing: msg('bây giờ là lúc đúng'),
};

function ScoreForm({
  opportunity,
  onSaved,
}: {
  opportunity: ApiOpportunity;
  onSaved: (snapshot: ApiScoreSnapshot) => void;
}) {
  const t = useT();
  const last = opportunity.scores;
  const [values, setValues] = useState<Record<ScoreKey, string>>({
    opportunity: last ? String(last.opportunity) : '',
    pain: last ? String(last.pain) : '',
    feasibility: last ? String(last.feasibility) : '',
    timing: last ? String(last.timing) : '',
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const nums = {} as Record<ScoreKey, number>;
    for (const d of scoreDims) {
      const n = Number(values[d.key]);
      if (!values[d.key].trim() || !Number.isInteger(n) || n < 1 || n > 10) {
        setError(t('{name}: cần một số nguyên từ 1 đến 10.', { name: t(d.label) }));
        return;
      }
      nums[d.key] = n;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await opportunitiesApi.recordScores(opportunity.id, { ...nums, note: note.trim() }));
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
        <div className="grid grid-cols-2 gap-4">
          {scoreDims.map((d, i) => (
            <div key={d.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`score-${d.key}`}>{t(d.label)}</Label>
              <Input
                id={`score-${d.key}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={values[d.key]}
                autoFocus={i === 0}
                aria-describedby={`score-${d.key}-hint`}
                onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))}
              />
              <span id={`score-${d.key}-hint`} className="text-xs text-muted-foreground">
                {t(hints[d.key])}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="score-note">{t('Vì sao đổi điểm (không bắt buộc)')}</Label>
          <Textarea id="score-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t('Lưu điểm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Records a new score snapshot (POST /api/opportunities/{id}/scores); older ones stay as history. */
export function ScoreDialog({
  open,
  opportunity,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  opportunity: ApiOpportunity;
  onOpenChange: (open: boolean) => void;
  onSaved: (snapshot: ApiScoreSnapshot) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }}>
        <DialogHeader>
          <DialogTitle>{t('Chấm điểm lại')}</DialogTitle>
          <DialogDescription>{t('Mỗi điểm từ 1 đến 10. Lần chấm cũ được giữ làm lịch sử.')}</DialogDescription>
        </DialogHeader>
        {open && <ScoreForm opportunity={opportunity} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
