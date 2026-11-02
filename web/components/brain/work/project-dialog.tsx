'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ApiItemStatus } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { workApi, type ApiBilling, type ApiProject } from '@/lib/api/work';
import { itemStatuses } from '@/lib/labels';
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
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { billingChoices, fieldErrors } from './format';

interface Form {
  title: string;
  client: string;
  status: ApiItemStatus;
  billing: ApiBilling;
  price: string;
  hourlyRate: string;
  currency: string;
  tags: string;
  source: string;
}

const fromProject = (p: ApiProject | null): Form => ({
  title: p?.title ?? '',
  client: p?.client ?? '',
  status: p?.status ?? 'active',
  billing: p?.billing ?? 'hourly',
  price: p?.price ?? '',
  hourlyRate: p?.hourlyRate ?? '',
  currency: p?.currency ?? 'CZK',
  tags: (p?.tags ?? []).join(', '),
  source: p?.source ?? '',
});

/** "1 200,50" or "1200.5" -> "1200.50"; '' -> null; undefined when it is not a non-negative amount. */
function money(v: string): string | null | undefined {
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  return Number(s).toFixed(2);
}

function ProjectForm({
  project,
  onSaved,
}: {
  project: ApiProject | null;
  onSaved: (p: ApiProject, created: boolean) => void;
}) {
  const [form, setForm] = useState<Form>(() => fromProject(project));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return setError('Cần có tên dự án.');
    const price = money(form.price);
    const hourlyRate = money(form.hourlyRate);
    if (price === undefined || hourlyRate === undefined)
      return setError('Giá là số không âm, tối đa 2 chữ số thập phân (ví dụ 800 hoặc 1200,50).');
    if (form.billing === 'hourly' && hourlyRate === null) return setError('Dự án theo giờ cần giá giờ.');
    const currency = form.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return setError('Tiền tệ là mã 3 chữ cái, ví dụ CZK, EUR.');
    const body = {
      title: form.title.trim(),
      client: form.client.trim(),
      status: form.status,
      billing: form.billing,
      price,
      hourlyRate,
      currency,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      source: form.source.trim(),
    };
    setBusy(true);
    setError(null);
    try {
      const saved = project ? await workApi.updateProject(project.id, body) : await workApi.createProject(body);
      onSaved(saved, !project);
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
          <Label htmlFor="project-title">Tên dự án</Label>
          <Input id="project-title" value={form.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-client">Khách</Label>
            <Input id="project-client" value={form.client} onChange={(e) => set('client', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-status">Trạng thái</Label>
            <ChoiceSelect
              id="project-status"
              label="Trạng thái"
              value={form.status}
              onChange={(v) => set('status', v)}
              choices={itemStatuses}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-billing">Tính tiền</Label>
            <ChoiceSelect
              id="project-billing"
              label="Tính tiền"
              value={form.billing}
              onChange={(v) => set('billing', v)}
              choices={billingChoices}
            />
          </div>
          {form.billing === 'hourly' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-rate">Giá giờ</Label>
              <Input
                id="project-rate"
                inputMode="decimal"
                value={form.hourlyRate}
                onChange={(e) => set('hourlyRate', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-price">Giá trọn gói</Label>
              <Input
                id="project-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-currency">Tiền tệ</Label>
            <Input
              id="project-currency"
              value={form.currency}
              maxLength={3}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {form.billing === 'hourly'
            ? 'Đã kiếm = giờ tính tiền × giá giờ.'
            : 'Đã kiếm = giá trọn gói. Giá giờ thực tế = giá chia cho mọi giờ đã làm, kể cả giờ không tính tiền.'}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-source">Nguồn (kênh tìm được khách, link)</Label>
          <Input id="project-source" value={form.source} onChange={(e) => set('source', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-tags">Tag (cách nhau bằng dấu phẩy)</Label>
          <Input id="project-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
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
          {project ? 'Lưu' : 'Thêm dự án'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Create (project = null) or edit a project: POST/PATCH /api/projects. */
export function ProjectDialog({
  open,
  project,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  project: ApiProject | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (p: ApiProject, created: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': 'Đóng' }}>
        <DialogHeader>
          <DialogTitle>{project ? 'Sửa dự án' : 'Thêm dự án'}</DialogTitle>
          <DialogDescription>Khách, cách tính tiền và giá. Không làm hóa đơn.</DialogDescription>
        </DialogHeader>
        {open && <ProjectForm key={project?.id ?? 'new'} project={project} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
