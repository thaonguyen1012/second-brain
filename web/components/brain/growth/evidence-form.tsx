'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import {
  growthApi,
  listAll,
  type ApiEvidenceKind,
  type ApiSkillEvidence,
  type ApiSkillEvidenceCreate,
} from '@/lib/api/growth';
import { toApiError, useApi } from '@/lib/api/use-api';
import { itemTypeLabel } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { evidenceKinds, fieldErrors, today } from './labels';
import { FormError, FormRow } from './shared';

const fieldNames = {
  kind: 'Loại',
  title: 'Tiêu đề',
  url: 'Link',
  note: 'Ghi chú',
  date: 'Ngày',
  item: 'Item',
  libraryNote: 'Ghi chú thư viện',
};

type Choice = { value: string; label: string };

const loadItems = () =>
  listAll(api.listItems({ limit: 200 }), 400).then((rows) =>
    rows.map((i): Choice => ({ value: String(i.id), label: `${itemTypeLabel(i.type)} · ${i.title}` })),
  );
const loadNotes = () =>
  listAll(growthApi.listNotes({ limit: 200 }), 400).then((rows) =>
    rows.map((n): Choice => ({
      value: String(n.id),
      label: n.title || n.markdown.slice(0, 60).replace(/\s+/g, ' ') || `Ghi chú #${n.id}`,
    })),
  );

function Picker({ kind, value, onChange }: { kind: 'item' | 'note'; value: string; onChange: (v: string) => void }) {
  const rows = useApi(`evidence-picker:${kind}`, kind === 'item' ? loadItems : loadNotes);
  const what = kind === 'item' ? 'item' : 'ghi chú';
  if (rows.error && !rows.data) return <p className="text-sm text-destructive-foreground">{describeApiError(rows.error).title}</p>;
  if (!rows.data) return <p className="text-sm text-muted-foreground">Đang tải danh sách {what}…</p>;
  if (rows.data.length === 0)
    return <p className="text-sm text-muted-foreground">Thư viện chưa có {what} nào. Thêm ở trang Thư viện trước.</p>;
  const choices = [{ value: '', label: `Chọn ${what}…` }, ...rows.data];
  return <ChoiceSelect id="evidence-ref" label={`Chọn ${what}`} value={value} onChange={onChange} choices={choices} />;
}

/**
 * Add (evidence = null) or edit a skill's evidence. A link needs a title and URL; an item or a note links a
 * library row (its title is used when none is typed). The date is when it was shipped or written.
 */
export function EvidenceForm({
  skillId,
  evidence,
  onSaved,
  onCancel,
}: {
  skillId: number;
  evidence: ApiSkillEvidence | null;
  onSaved: (evidence: ApiSkillEvidence, created: boolean) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<ApiEvidenceKind>(evidence?.kind ?? 'link');
  const [ref, setRef] = useState('');
  const [title, setTitle] = useState(evidence?.title ?? '');
  const [url, setUrl] = useState(evidence?.url ?? '');
  const [note, setNote] = useState(evidence?.note ?? '');
  const [date, setDate] = useState(evidence?.date ?? today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefix = evidence ? `ev-${evidence.id}` : 'ev-new';

  const submit = async () => {
    if (kind === 'link' && (!title.trim() || !url.trim())) {
      setError('Link cần có tiêu đề và địa chỉ.');
      return;
    }
    if (!evidence && kind !== 'link' && !ref) {
      setError(kind === 'item' ? 'Chọn một item.' : 'Chọn một ghi chú.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (evidence) {
        const saved = await growthApi.updateSkillEvidence(skillId, evidence.id, {
          ...(title.trim() && { title: title.trim() }),
          ...(kind === 'link' && { url: url.trim() }),
          note: note.trim(),
          ...(date && { date }),
        });
        onSaved(saved, false);
      } else {
        const body: ApiSkillEvidenceCreate = {
          kind,
          note: note.trim(),
          ...(date && { date }),
          ...(title.trim() && { title: title.trim() }),
          ...(kind === 'link' && { url: url.trim() }),
          ...(kind === 'item' && { item: Number(ref) }),
          ...(kind === 'note' && { libraryNote: Number(ref) }),
        };
        onSaved(await growthApi.addSkillEvidence(skillId, body), true);
      }
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, fieldNames)) || describeApiError(e).title);
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border bg-card p-3"
      aria-label={evidence ? 'Sửa bằng chứng' : 'Thêm bằng chứng'}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {!evidence && (
        <FormRow id={`${prefix}-kind`} label="Loại bằng chứng">
          <ChoiceSelect
            id={`${prefix}-kind`}
            label="Loại bằng chứng"
            value={kind}
            onChange={(v) => {
              setKind(v);
              setRef('');
            }}
            choices={evidenceKinds}
          />
        </FormRow>
      )}
      {!evidence && kind !== 'link' && (
        <FormRow id="evidence-ref" label={kind === 'item' ? 'Item' : 'Ghi chú'}>
          <Picker kind={kind} value={ref} onChange={setRef} />
        </FormRow>
      )}
      <FormRow
        id={`${prefix}-title`}
        label={kind === 'link' ? 'Tiêu đề' : 'Tiêu đề (để trống thì lấy theo item hoặc ghi chú)'}
      >
        <Input id={`${prefix}-title`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </FormRow>
      {kind === 'link' && (
        <FormRow id={`${prefix}-url`} label="Link">
          <Input
            id={`${prefix}-url`}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </FormRow>
      )}
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <FormRow id={`${prefix}-date`} label="Ngày ship hoặc viết">
          <Input id={`${prefix}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
        <FormRow id={`${prefix}-note`} label="Ghi chú">
          <Textarea id={`${prefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
        </FormRow>
      </div>
      <FormError error={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {evidence ? 'Lưu bằng chứng' : 'Thêm bằng chứng'}
        </Button>
      </div>
    </form>
  );
}
