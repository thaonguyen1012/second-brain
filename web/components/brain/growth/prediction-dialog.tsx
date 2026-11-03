'use client';
import { useEffect, useRef, useState } from 'react';
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
import { describeApiError } from '../api-state';
import { fieldErrors, formatDay, outcomeOf, today } from './labels';
import { FormError, FormRow } from './shared';
import { SaveKeys } from '../save-keys';

const fieldNames = {
  statement: 'Dự đoán',
  madeOn: 'Ngày ghi',
  checkOn: 'Ngày chấm lại',
  confidence: 'Độ tự tin',
  outcome: 'Kết quả',
  note: 'Ghi chú',
};

export type PredictionMode = 'edit' | 'score';

function errorText(err: unknown): string {
  const e = toApiError(err);
  return (e.status === 400 && fieldErrors(e.body, fieldNames)) || describeApiError(e).title;
}

function PredictionForm({
  prediction,
  onSaved,
}: {
  prediction: ApiPrediction | null;
  onSaved: (p: ApiPrediction, created: boolean) => void;
}) {
  const [statement, setStatement] = useState(prediction?.statement ?? '');
  const [madeOn, setMadeOn] = useState(prediction?.madeOn ?? today());
  const [checkOn, setCheckOn] = useState(prediction?.checkOn ?? '');
  const [confidence, setConfidence] = useState(prediction?.confidence ? String(prediction.confidence) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set synchronously, so a second Cmd+Enter before the re-render cannot POST twice.
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    if (!statement.trim()) {
      setError('Cần ghi dự đoán.');
      return;
    }
    const conf = confidence.trim() ? Number(confidence) : null;
    if (conf !== null && !(Number.isInteger(conf) && conf >= 1 && conf <= 10)) {
      setError('Độ tự tin là số nguyên từ 1 đến 10, hoặc để trống.');
      return;
    }
    if (checkOn && madeOn && checkOn < madeOn) {
      setError('Ngày chấm lại phải sau ngày ghi.');
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
    try {
      const saved = prediction
        ? await growthApi.updatePrediction(prediction.id, body)
        : await growthApi.createPrediction(body);
      onSaved(saved, !prediction);
    } catch (err) {
      setError(errorText(err));
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
        <FormRow id="pred-statement" label="Dự đoán">
          <Textarea
            id="pred-statement"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={3}
            placeholder="Điều mình nghĩ sẽ xảy ra, viết sao cho 6 tháng sau chấm được đúng hay sai."
            autoFocus
          />
        </FormRow>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormRow id="pred-made" label="Ngày ghi">
            <Input id="pred-made" type="date" value={madeOn} onChange={(e) => setMadeOn(e.target.value)} />
          </FormRow>
          <FormRow id="pred-check" label="Ngày chấm lại" hint={prediction ? undefined : 'Để trống: sau 6 tháng.'}>
            <Input id="pred-check" type="date" value={checkOn} onChange={(e) => setCheckOn(e.target.value)} />
          </FormRow>
          <FormRow id="pred-conf" label="Độ tự tin 1–10">
            <Input
              id="pred-conf"
              inputMode="numeric"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </FormRow>
        </div>
        <FormError error={error} />
      </DialogPanel>
      <DialogFooter>
        <span className="me-auto self-center text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> để lưu
        </span>
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {prediction ? 'Lưu' : 'Ghi dự đoán'}
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
  const [outcome, setOutcome] = useState<ApiOutcome | null>(prediction.outcome === 'open' ? null : prediction.outcome);
  const [note, setNote] = useState(prediction.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA'].includes(t.tagName)) return;
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
      setError('Chọn kết quả trước: 1 đúng, 2 một phần, 3 sai.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      onSaved(await growthApi.updatePrediction(prediction.id, { outcome, note: note.trim() }));
    } catch (err) {
      setError(errorText(err));
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
            Kết quả
          </span>
          <RadioGroup
            aria-labelledby="pred-outcome"
            className="flex flex-row flex-wrap gap-2"
            value={outcome}
            onValueChange={(v) => setOutcome(v as ApiOutcome)}
          >
            {keyed.map(([key, value]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-accent/50 has-data-checked:border-primary has-data-checked:bg-primary/8"
              >
                <Radio value={value} />
                {outcomeOf(value).label}
                <Kbd className="max-sm:hidden pointer-coarse:hidden">{key}</Kbd>
              </label>
            ))}
          </RadioGroup>
        </div>
        <FormRow id="pred-note" label="Chuyện gì đã xảy ra, mình học được gì">
          <Textarea id="pred-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </FormRow>
        <FormError error={error} />
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy || outcome === null}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Lưu kết quả
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
  const scoring = mode === 'score' && prediction !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{scoring ? 'Chấm lại dự đoán' : prediction ? 'Sửa dự đoán' : 'Ghi dự đoán'}</DialogTitle>
          <DialogDescription className={scoring ? 'line-clamp-3' : undefined}>
            {scoring
              ? `${prediction.statement} (ghi ${formatDay(prediction.madeOn)}${prediction.confidence ? `, tự tin ${prediction.confidence}/10` : ''})`
              : 'Đọc các nhà tiên tri để lấy khung tư duy, không để tin dự báo. Ghi lại, 6 tháng sau chấm lại.'}
          </DialogDescription>
        </DialogHeader>
        {open &&
          (scoring ? (
            <ScoreForm key={`score-${prediction.id}`} prediction={prediction} onSaved={(p) => onSaved(p, false)} />
          ) : (
            <PredictionForm key={prediction?.id ?? 'new'} prediction={prediction} onSaved={onSaved} />
          ))}
      </DialogPopup>
    </Dialog>
  );
}
