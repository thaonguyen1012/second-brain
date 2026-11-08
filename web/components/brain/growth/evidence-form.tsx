'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api/client';
import {
  growthApi,
  listAll,
  type ApiEvidenceKind,
  type ApiNote,
  type ApiSkillEvidence,
  type ApiSkillEvidenceCreate,
} from '@/lib/api/growth';
import { toApiError, useApi } from '@/lib/api/use-api';
import { itemTypeLabel } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/client';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { evidenceKinds, fieldErrors, today } from './labels';
import { FormError, FormRow } from './shared';

const fieldNames: Record<string, Msg> = {
  kind: msg('Loại'),
  title: msg('Tiêu đề'),
  url: msg('Link'),
  note: msg('Ghi chú'),
  date: msg('Ngày'),
  item: msg('Item'),
  libraryNote: msg('Ghi chú thư viện'),
};

type Choice = { value: string; label: string };

const loadItems = (t: T) =>
  listAll(api.listItems({ limit: 200 }), 400).then((rows) =>
    rows.map((i): Choice => ({ value: String(i.id), label: `${t(itemTypeLabel(i.type))} · ${i.title}` })),
  );

/** Notes carry their whole markdown: never load them all, search with ?q= and show at most this many. */
const NOTE_RESULTS = 20;
const noteChoice = (n: ApiNote, t: T): Choice => ({
  value: String(n.id),
  label: n.title || n.markdown.slice(0, 60).replace(/\s+/g, ' ') || t('Ghi chú #{id}', { id: n.id }),
});

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function ItemPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const rows = useApi('evidence-picker:item', () => loadItems(t));
  if (rows.error && !rows.data)
    return <p className="text-sm text-destructive-foreground">{describeApiError(rows.error, t).title}</p>;
  if (!rows.data) return <p className="text-sm text-muted-foreground">{t('Đang tải danh sách item…')}</p>;
  if (rows.data.length === 0)
    return <p className="text-sm text-muted-foreground">{t('Thư viện chưa có item nào. Thêm ở trang Thư viện trước.')}</p>;
  const choices = [{ value: '', label: t('Chọn item…') }, ...rows.data];
  return <ChoiceSelect id="evidence-ref" label={t('Chọn item')} value={value} onChange={onChange} choices={choices} />;
}

/** Search-as-you-type over GET /api/notes?q= (newest notes while the box is empty). */
function NotePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const [picked, setPicked] = useState<Choice | null>(null);
  const rows = useApi(`evidence-picker:note:${q}`, () =>
    growthApi
      .listNotes({ limit: NOTE_RESULTS, ...(q && { q }) })
      .then((page) => page.results.map((n) => noteChoice(n, t))),
  );
  const found = rows.loading ? [] : (rows.data ?? []);
  const keep = picked && picked.value === value && !found.some((c) => c.value === value) ? [picked] : [];
  const choices = [{ value: '', label: t('Chọn ghi chú…') }, ...keep, ...found];
  const status = rows.error
    ? describeApiError(rows.error, t).title
    : rows.loading
      ? t('Đang tìm…')
      : found.length === 0
        ? q
          ? t('Không có ghi chú nào khớp.')
          : t('Thư viện chưa có ghi chú nào. Thêm ở trang Ghi chú trước.')
        : found.length === NOTE_RESULTS
          ? t('{n} ghi chú mới nhất khớp; gõ thêm để thu hẹp.', { n: NOTE_RESULTS })
          : null;
  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        aria-label={t('Tìm ghi chú')}
        placeholder={t('Gõ để tìm trong tiêu đề và nội dung…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ChoiceSelect
        id="evidence-ref"
        label={t('Chọn ghi chú')}
        value={value}
        onChange={(v) => {
          setPicked(choices.find((c) => c.value === v) ?? null);
          onChange(v);
        }}
        choices={choices}
      />
      {status && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
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
  className,
}: {
  skillId: number;
  evidence: ApiSkillEvidence | null;
  onSaved: (evidence: ApiSkillEvidence, created: boolean) => void;
  onCancel: () => void;
  /** Container classes; default a bordered box (the add form), a row inside a bordered list passes padding only. */
  className?: string;
}) {
  const t = useT();
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
      setError(t('Link cần có tiêu đề và địa chỉ.'));
      return;
    }
    if (!evidence && kind !== 'link' && !ref) {
      setError(kind === 'item' ? t('Chọn một item.') : t('Chọn một ghi chú.'));
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
      setError((e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title);
      setBusy(false);
    }
  };

  return (
    <form
      className={cn('flex flex-col gap-3', className ?? 'rounded-xl border p-3')}
      aria-label={evidence ? t('Sửa bằng chứng') : t('Thêm bằng chứng')}
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
        <FormRow id={`${prefix}-kind`} label={t('Loại bằng chứng')}>
          <ChoiceSelect
            id={`${prefix}-kind`}
            label={t('Loại bằng chứng')}
            value={kind}
            onChange={(v) => {
              setKind(v);
              setRef('');
            }}
            choices={evidenceKinds.map((k) => ({ value: k.value, label: t(k.label) }))}
          />
        </FormRow>
      )}
      {!evidence && kind !== 'link' && (
        <FormRow id="evidence-ref" label={kind === 'item' ? t('Item') : t('Ghi chú')}>
          {kind === 'item' ? (
            <ItemPicker value={ref} onChange={setRef} />
          ) : (
            <NotePicker value={ref} onChange={setRef} />
          )}
        </FormRow>
      )}
      <FormRow
        id={`${prefix}-title`}
        label={kind === 'link' ? t('Tiêu đề') : t('Tiêu đề (để trống thì lấy theo item hoặc ghi chú)')}
      >
        <Input id={`${prefix}-title`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </FormRow>
      {kind === 'link' && (
        <FormRow id={`${prefix}-url`} label={t('Link')}>
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
        <FormRow id={`${prefix}-date`} label={t('Ngày ship hoặc viết')}>
          <Input id={`${prefix}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormRow>
        <FormRow id={`${prefix}-note`} label={t('Ghi chú')}>
          <Textarea id={`${prefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
        </FormRow>
      </div>
      <FormError error={error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('Hủy')}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {evidence ? t('Lưu bằng chứng') : t('Thêm bằng chứng')}
        </Button>
      </div>
    </form>
  );
}
