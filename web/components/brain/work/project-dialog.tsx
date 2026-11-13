'use client';
import { useState, type ComponentProps } from 'react';
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
import { useT } from '@/lib/i18n/client';
import { describeApiError } from '../api-state';
import { ChoiceSelect } from '../choice-select';
import { useInvalidFields } from '../invalid-fields';
import { ItemImageField, KEEP_IMAGE, applyImageChange, imageErrorText, type ImageChange } from '../library/item-image-field';
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

const fromProject = (p: ApiProject | null, initialStatus?: ApiItemStatus): Form => ({
  title: p?.title ?? '',
  client: p?.client ?? '',
  status: p?.status ?? initialStatus ?? 'active',
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
  initialStatus,
  onSaved,
}: {
  project: ApiProject | null;
  initialStatus?: ApiItemStatus;
  onSaved: (p: ApiProject, created: boolean, imageError?: string) => void;
}) {
  const t = useT();
  const [form, setForm] = useState<Form>(() => fromProject(project, initialStatus));
  const [logo, setLogo] = useState<ImageChange>(KEEP_IMAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = useInvalidFields();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return setError(invalid.mark(t('Cần có tên dự án.'), 'title'));
    const price = money(form.price);
    const hourlyRate = money(form.hourlyRate);
    if (price === undefined || hourlyRate === undefined)
      return setError(
        invalid.mark(
          t('Giá là số không âm, tối đa 2 chữ số thập phân (ví dụ 800 hoặc 1200,50).'),
          price === undefined && 'price',
          hourlyRate === undefined && 'hourlyRate',
        ),
      );
    if (form.billing === 'hourly' && hourlyRate === null)
      return setError(invalid.mark(t('Dự án theo giờ cần giá giờ.'), 'hourlyRate'));
    const currency = form.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      return setError(invalid.mark(t('Tiền tệ là mã 3 chữ cái, ví dụ CZK, EUR.'), 'currency'));
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
        .map((tag) => tag.trim())
        .filter(Boolean),
      source: form.source.trim(),
    };
    setBusy(true);
    setError(null);
    invalid.clear();
    try {
      const saved = project ? await workApi.updateProject(project.id, body) : await workApi.createProject(body);
      // The logo goes after the project (a new one needs its id; a project is an Item, so /api/items/{id}/image).
      let final = saved;
      let imageError: string | undefined;
      try {
        const picture = await applyImageChange(saved.id, logo);
        if (picture) final = { ...saved, imageUrl: picture.imageUrl };
      } catch (err) {
        imageError = imageErrorText(toApiError(err), t);
      }
      onSaved(final, !project, imageError);
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-title">{t('Tên dự án')}</Label>
          <Input
            id="project-title"
            aria-required
            {...invalid.field('title')}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-client">{t('Khách')}</Label>
            <Input
              id="project-client"
              {...invalid.field('client')}
              value={form.client}
              onChange={(e) => set('client', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-status">{t('Trạng thái')}</Label>
            <ChoiceSelect
              id="project-status"
              {...invalid.field('status')}
              label={t('Trạng thái')}
              value={form.status}
              onChange={(v) => set('status', v)}
              choices={itemStatuses.map((s) => ({ value: s.value, label: t(s.label) }))}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-billing">{t('Tính tiền', null, 'field')}</Label>
            <ChoiceSelect
              id="project-billing"
              {...invalid.field('billing')}
              label={t('Tính tiền', null, 'field')}
              value={form.billing}
              onChange={(v) => set('billing', v)}
              choices={billingChoices.map((c) => ({ value: c.value, label: t(c.label) }))}
            />
          </div>
          {form.billing === 'hourly' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-rate">{t('Giá giờ')}</Label>
              <Input
                id="project-rate"
                aria-required
                {...invalid.field('hourlyRate')}
                inputMode="decimal"
                value={form.hourlyRate}
                onChange={(e) => set('hourlyRate', e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-price">{t('Giá trọn gói')}</Label>
              <Input
                id="project-price"
                {...invalid.field('price')}
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-currency">{t('Tiền tệ')}</Label>
            <Input
              id="project-currency"
              aria-required
              {...invalid.field('currency')}
              value={form.currency}
              maxLength={3}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {form.billing === 'hourly'
            ? t('Đã kiếm = giờ tính tiền × giá giờ.')
            : t('Đã kiếm = giá trọn gói. Giá giờ thực tế = giá chia cho mọi giờ đã làm, kể cả giờ không tính tiền.')}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-source">{t('Nguồn (kênh tìm được khách, link)')}</Label>
          <Input
            id="project-source"
            {...invalid.field('source')}
            value={form.source}
            onChange={(e) => set('source', e.target.value)}
          />
        </div>
        <ItemImageField
          type="project"
          source={form.source}
          imageUrl={project?.imageUrl}
          change={logo}
          onChange={setLogo}
          disabled={busy}
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-tags">{t('Tag (cách nhau bằng dấu phẩy)')}</Label>
          <Input
            id="project-tags"
            {...invalid.field('tags')}
            value={form.tags}
            onChange={(e) => set('tags', e.target.value)}
          />
        </div>
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
          {project ? t('Lưu') : t('Thêm dự án')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Create (project = null) or edit a project: POST/PATCH /api/projects. `initialStatus` preselects the status of a
 * new project (a board lane's "Thêm dự án"); without it a new project starts as active.
 */
export function ProjectDialog({
  open,
  project,
  initialStatus,
  onOpenChange,
  onSaved,
  finalFocus,
}: {
  open: boolean;
  project: ApiProject | null;
  initialStatus?: ApiItemStatus;
  onOpenChange: (open: boolean) => void;
  /** After a save; `imageError` says why the logo change failed when the project itself was saved. */
  onSaved: (p: ApiProject, created: boolean, imageError?: string) => void;
  /** Where the focus goes when the dialog closes (default: the control that opened it, if it still exists). */
  finalFocus?: ComponentProps<typeof DialogPopup>['finalFocus'];
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>{project ? t('Sửa dự án') : t('Thêm dự án')}</DialogTitle>
          <DialogDescription>{t('Khách, cách tính tiền và giá. Không làm hóa đơn.')}</DialogDescription>
        </DialogHeader>
        {open && (
          <ProjectForm
            key={project?.id ?? `new-${initialStatus ?? ''}`}
            project={project}
            initialStatus={initialStatus}
            onSaved={onSaved}
          />
        )}
      </DialogPopup>
    </Dialog>
  );
}
