'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';
import { growthApi, type ApiOutcome, type ApiPrediction, type ApiPredictionWrite } from '@/lib/api/growth';
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
import { Kbd } from '@/components/ui/kbd';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { singleKeyShortcut } from '@/lib/single-key-shortcuts';
import { describeApiError } from '../api-state';
import { useInvalidFields } from '../invalid-fields';
import { fieldErrors, formatDay, outcomeOf, today } from './labels';
import { FormError, FormRow, hintId } from './shared';
import { SaveKeys } from '../save-keys';

const fieldNames: Record<string, Msg> = {
  statement: msg('Dự đoán'),
  madeOn: msg('Ngày ghi'),
  checkOn: msg('Ngày chấm lại'),
  confidence: msg('Độ tự tin'),
  outcome: msg('Kết quả'),
  note: msg('Ghi chú'),
};

export type PredictionMode = 'edit' | 'score';

function errorText(err: unknown, t: T): string {
  const e = toApiError(err);
  return (e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title;
}

function PredictionForm({
  prediction,
  onSaved,
  focusRef,
}: {
  prediction: ApiPrediction | null;
  onSaved: (p: ApiPrediction, created: boolean) => void;
  /** The field the dialog opens on (its initialFocus). */
  focusRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useT();
  const [statement, setStatement] = useState(prediction?.statement ?? '');
  const [madeOn, setMadeOn] = useState(prediction?.madeOn ?? today());
  const [checkOn, setCheckOn] = useState(prediction?.checkOn ?? '');
  const [confidence, setConfidence] = useState(prediction?.confidence ? String(prediction.confidence) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  // Set synchronously, so a second Cmd+Enter before the re-render cannot POST twice.
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    if (!statement.trim()) {
      setError(invalid.mark(t('Cần ghi dự đoán.'), 'statement'));
      return;
    }
    const conf = confidence.trim() ? Number(confidence) : null;
    if (conf !== null && !(Number.isInteger(conf) && conf >= 1 && conf <= 10)) {
      setError(invalid.mark(t('Độ tự tin là số nguyên từ 1 đến 10, hoặc để trống.'), 'confidence'));
      return;
    }
    if (checkOn && madeOn && checkOn < madeOn) {
      setError(invalid.mark(t('Ngày chấm lại phải sau ngày ghi.'), 'checkOn'));
      return;
    }
    const body: ApiPredictionWrite = {
      statement: statement.trim(),
      confidence: conf,
      ...(madeOn && { madeOn }),
      ...(checkOn && { checkOn }),
    };
    inFlight.current = true;
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const saved = prediction
        ? await growthApi.updatePrediction(prediction.id, body)
        : await growthApi.createPrediction(body);
      onSaved(saved, !prediction);
    } catch (err) {
      setError(errorText(err, t));
      invalid.fromError(err, t);
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
        <FormRow id="pred-statement" label={t('Dự đoán')}>
          <Textarea
            id="pred-statement"
            aria-required
            {...invalid.field('statement')}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder={t('Điều mình nghĩ sẽ xảy ra, viết sao cho 6 tháng sau chấm được đúng hay sai.')}
            ref={focusRef}
          />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormRow id="pred-made" label={t('Ngày ghi')}>
            <Input
              id="pred-made"
              type="date"
              {...invalid.field('madeOn')}
              value={madeOn}
              onChange={(e) => setMadeOn(e.target.value)}
            />
          </FormRow>
          <FormRow id="pred-check" label={t('Ngày chấm lại')} hint={prediction ? undefined : t('Để trống: sau 6 tháng.')}>
            <Input
              id="pred-check"
              type="date"
              {...invalid.field('checkOn', prediction ? undefined : hintId('pred-check'))}
              value={checkOn}
              onChange={(e) => setCheckOn(e.target.value)}
            />
          </FormRow>
          <FormRow id="pred-conf" label={t('Độ tự tin 1–10')}>
            <Input
              id="pred-conf"
              {...invalid.field('confidence')}
              inputMode="numeric"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </FormRow>
        </div>
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
          {prediction ? t('Lưu') : t('Ghi dự đoán')}
        </Button>
      </DialogFooter>
    </form>
  );
}

const keyed: [string, ApiOutcome][] = [
  ['1', 'right'],
  ['2', 'partial'],
  ['3', 'wrong'],
  ['0', 'open'],
];

/**
 * Re-score: one key per outcome (1 đúng, 2 một phần, 3 sai, 0 chưa chấm), plus a note on what happened.
 * An open prediction starts with nothing chosen, so saving never records "Đúng" by default (DECISIONS 4.8).
 */
function ScoreForm({ prediction, onSaved }: { prediction: ApiPrediction; onSaved: (p: ApiPrediction) => void }) {
  const t = useT();
  const [outcome, setOutcome] = useState<ApiOutcome | null>(prediction.outcome === 'open' ? null : prediction.outcome);
  const [note, setNote] = useState(prediction.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  const outcomeField = invalid.field('outcome');
  const inFlight = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!singleKeyShortcut(e)) return;
      const hit = keyed.find(([k]) => k === e.key);
      if (!hit) return;
      e.preventDefault();
      setOutcome(hit[1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async () => {
    if (inFlight.current) return;
    if (outcome === null) {
      setError(invalid.mark(t('Chọn kết quả trước: 1 đúng, 2 một phần, 3 sai.'), 'outcome'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      onSaved(await growthApi.updatePrediction(prediction.id, { outcome, note: note.trim() }));
    } catch (err) {
      setError(errorText(err, t));
      invalid.fromError(err, t);
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
        <div className="flex flex-col gap-1.5">
          <span id="pred-outcome" className="mb-1.5 text-sm font-medium">
            {t('Kết quả')}
          </span>
          <RadioGroup
            aria-labelledby="pred-outcome"
            aria-required
            {...outcomeField}
            className="flex flex-row flex-wrap gap-2"
            value={outcome}
            onValueChange={(v) => setOutcome(v as ApiOutcome)}
          >
            {keyed.map(([key, value]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 has-data-checked:border-primary has-data-checked:bg-primary/8"
              >
                {/* The focus lands on a radio, and only the group may carry aria-invalid: each reads the error too */}
                <Radio value={value} aria-describedby={outcomeField['aria-describedby']} />
                {t(outcomeOf(value).label)}
                <Kbd className="max-sm:hidden pointer-coarse:hidden">{key}</Kbd>
              </label>
            ))}
          </RadioGroup>
        </div>
        <FormRow id="pred-note" label={t('Chuyện gì đã xảy ra, mình học được gì')}>
          <Textarea
            id="pred-note"
            {...invalid.field('note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </FormRow>
        <FormError error={error} />
        {invalid.copies}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy || outcome === null}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t('Lưu kết quả')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Write or edit a prediction (`mode` edit), or score it again (`mode` score): POST/PATCH /api/predictions. */
export function PredictionDialog({
  open,
  prediction,
  mode,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  prediction: ApiPrediction | null;
  mode: PredictionMode;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: ApiPrediction, created: boolean) => void;
}) {
  const t = useT();
  const scoring = mode === 'score' && prediction !== null;
  // Focused by Base UI, not autoFocus, so closing gives the focus back to the control that opened the dialog
  // (item-dialog.tsx); a re-score has no such field and opens on Base UI's default
  const firstField = useRef<HTMLTextAreaElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }} initialFocus={firstField}>
        <DialogHeader>
          <DialogTitle>{scoring ? t('Chấm lại dự đoán') : prediction ? t('Sửa dự đoán') : t('Ghi dự đoán')}</DialogTitle>
          <DialogDescription className={scoring ? 'line-clamp-3' : undefined}>
            {scoring
              ? prediction.confidence
                ? t('{statement} (ghi {date}, tự tin {confidence}/10)', {
                    statement: prediction.statement,
                    date: formatDay(prediction.madeOn),
                    confidence: prediction.confidence,
                  })
                : t('{statement} (ghi {date})', { statement: prediction.statement, date: formatDay(prediction.madeOn) })
              : t('Đọc các nhà tiên tri để lấy khung tư duy, không để tin dự báo. Ghi lại, 6 tháng sau chấm lại.')}
          </DialogDescription>
        </DialogHeader>
        {open &&
          (scoring ? (
            <ScoreForm key={`score-${prediction.id}`} prediction={prediction} onSaved={(p) => onSaved(p, false)} />
          ) : (
            <PredictionForm
              key={prediction?.id ?? 'new'}
              prediction={prediction}
              onSaved={onSaved}
              focusRef={firstField}
            />
          ))}
      </DialogPopup>
    </Dialog>
  );
}
