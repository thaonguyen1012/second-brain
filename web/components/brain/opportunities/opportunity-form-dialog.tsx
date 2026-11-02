'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { opportunitiesApi, type ApiDecision, type ApiOpportunityDetail, type ApiSkill } from '@/lib/api/opportunities';
import type { ApiOpportunity } from '@/lib/api/client';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { decisions, fieldErrors, freshness } from './labels';

interface Form {
  title: string;
  hypothesis: string;
  whyNow: string;
  nextAction: string;
  decideBy: string;
  decision: ApiDecision;
  fit: number[];
}

const fromOpportunity = (o: ApiOpportunity | null): Form => ({
  title: o?.title ?? '',
  hypothesis: o?.hypothesis ?? '',
  whyNow: o?.whyNow ?? '',
  nextAction: o?.nextAction ?? '',
  decideBy: o?.decideBy ?? '',
  decision: o?.decision ?? 'open',
  fit: (o?.fit ?? []).map((s) => s.id),
});

const NO_SKILLS: ApiSkill[] = [];

function loadSkills() {
  return opportunitiesApi.listSkills().then((p) => p.results);
}

/** "Hợp với mình": toggle chips over the owner's skills (GET /api/skills). */
function FitPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const skills = useApi('opportunity-fit-skills', loadSkills);
  const list = skills.data ?? NO_SKILLS;
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  if (skills.error)
    return (
      <p className="text-sm text-muted-foreground">{describeApiError(skills.error).title}: không tải được kỹ năng.</p>
    );
  if (!skills.data) return <p className="text-sm text-muted-foreground">Đang tải kỹ năng…</p>;
  if (list.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Chưa có kỹ năng nào.{' '}
        <Link href="/phat-trien/ky-nang/" className="text-primary underline">
          Thêm ở trang Kỹ năng
        </Link>
        .
      </p>
    );
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kỹ năng hợp với cơ hội này">
      {list.map((s) => {
        const on = value.includes(s.id);
        return (
          <Button
            key={s.id}
            type="button"
            size="xs"
            variant={on ? 'default' : 'outline'}
            aria-pressed={on}
            title={freshness[s.freshness].label}
            onClick={() => toggle(s.id)}
          >
            {on && <Check aria-hidden />}
            {s.name}
          </Button>
        );
      })}
    </div>
  );
}

function OpportunityForm({
  opportunity,
  onSaved,
}: {
  opportunity: ApiOpportunity | null;
  onSaved: (saved: ApiOpportunityDetail, created: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(() => fromOpportunity(opportunity));
  const [fitTouched, setFitTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.hypothesis.trim()) {
      setError('Cần có tên và giả thuyết.');
      return;
    }
    const body = {
      title: form.title.trim(),
      hypothesis: form.hypothesis.trim(),
      whyNow: form.whyNow.trim(),
      nextAction: form.nextAction.trim(),
      decideBy: form.decideBy || null,
      decision: form.decision,
      // only sent when changed, so a skills list that failed to load never clears the set
      ...((fitTouched || !opportunity) && { fit: form.fit }),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = opportunity
        ? await opportunitiesApi.update(opportunity.id, body)
        : await opportunitiesApi.create(body);
      onSaved(saved, !opportunity);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body)) || describeApiError(e).title);
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
          <Label htmlFor="opp-title">Tên</Label>
          <Input id="opp-title" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-hypothesis">Giả thuyết (một câu: ai, đau gì, trả tiền cho gì)</Label>
          <Textarea
            id="opp-hypothesis"
            rows={2}
            value={form.hypothesis}
            onChange={(e) => set('hypothesis', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-why-now">Vì sao bây giờ</Label>
          <Textarea id="opp-why-now" rows={2} value={form.whyNow} onChange={(e) => set('whyNow', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opp-next">Hành động kế tiếp</Label>
          <Input id="opp-next" value={form.nextAction} onChange={(e) => set('nextAction', e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-decide-by">Hạn quyết định</Label>
            <Input
              id="opp-decide-by"
              type="date"
              value={form.decideBy}
              onChange={(e) => set('decideBy', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-decision">Quyết định</Label>
            <ChoiceSelect
              id="opp-decision"
              label="Quyết định"
              value={form.decision}
              onChange={(v) => set('decision', v)}
              choices={decisions}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Hợp với mình (kỹ năng)</span>
          <FitPicker
            value={form.fit}
            onChange={(ids) => {
              setFitTouched(true);
              set('fit', ids);
            }}
          />
        </div>
        {error && (
          <p className="whitespace-pre-line text-sm text-destructive-foreground" role="alert">
            {error}
          </p>
        )}
      </DialogPanel>
      <DialogFooter>
        <DialogClose render={<Button variant="ghost" type="button" />}>Hủy</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {opportunity ? 'Lưu' : 'Tạo cơ hội'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (opportunity = null) or edit an opportunity: POST/PATCH /api/opportunities. */
export function OpportunityFormDialog({
  open,
  opportunity,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  opportunity: ApiOpportunity | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: ApiOpportunityDetail, created: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{opportunity ? 'Sửa cơ hội' : 'Cơ hội mới'}</DialogTitle>
          <DialogDescription>Một giả thuyết của mình, sẽ được giữ, bỏ hoặc làm khi đủ bằng chứng.</DialogDescription>
        </DialogHeader>
        {open && <OpportunityForm key={opportunity?.id ?? 'new'} opportunity={opportunity} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
