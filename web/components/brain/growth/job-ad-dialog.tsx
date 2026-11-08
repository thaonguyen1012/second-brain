'use client';
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { growthApi, type ApiJobAd, type ApiJobAdPatch, type ApiJobAdWrite } from '@/lib/api/growth';
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
import { FormError, FormRow } from './shared';
import { SaveKeys } from '../save-keys';

const MAX_TEXT = 20_000;
const fieldNames: Record<string, Msg> = {
  title: msg('Vị trí'),
  company: msg('Công ty'),
  url: msg('Link'),
  text: msg('Nội dung'),
  month: msg('Tháng'),
  skills: msg('Kỹ năng'),
};

function JobAdForm({
  ad,
  month,
  onSaved,
}: {
  ad: ApiJobAd | null;
  month: string;
  onSaved: (ad: ApiJobAd, created: boolean) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(ad?.title ?? '');
  const [company, setCompany] = useState(ad?.company ?? '');
  const [url, setUrl] = useState(ad?.url ?? '');
  const [adMonth, setAdMonth] = useState(ad?.month ?? month);
  const [text, setText] = useState(ad?.text ?? '');
  const initialSkills = (ad?.skills ?? []).join(', ');
  const [skills, setSkills] = useState(initialSkills);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set synchronously, so a second Cmd+Enter before the re-render cannot POST twice (two paid extractions).
  const inFlight = useRef(false);

  const submit = async () => {
    if (inFlight.current) return;
    if (!title.trim() || !text.trim()) {
      setError(t('Cần có tên vị trí và nội dung tin.'));
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(adMonth)) {
      setError(t('Tháng có dạng YYYY-MM, ví dụ 2026-11.'));
      return;
    }
    if (text.length > MAX_TEXT) {
      setError(t('Nội dung dài quá {max} ký tự, hãy bỏ bớt phần giới thiệu công ty.', { max: t.num(MAX_TEXT) }));
      return;
    }
    const body: ApiJobAdWrite = {
      title: title.trim(),
      company: company.trim(),
      url: url.trim(),
      text: text.trim(),
      month: adMonth,
    };
    // Skills typed by hand set the result and skip the extraction job (API_CONTRACT.md).
    const patch: ApiJobAdPatch = { ...body };
    if (skills !== initialSkills) patch.skills = splitList(skills).map((s) => s.toLowerCase());
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = ad
        ? await growthApi.updateJobAd(ad.id, patch)
        : await growthApi.createJobAd(body);
      onSaved(saved, !ad);
    } catch (err) {
      const e = toApiError(err);
      setError((e.status === 400 && fieldErrors(e.body, t, fieldNames)) || describeApiError(e, t).title);
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow id="ad-title" label={t('Vị trí')}>
            <Input
              id="ad-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product Engineer"
              autoFocus
            />
          </FormRow>
          <FormRow id="ad-company" label={t('Công ty')}>
            <Input id="ad-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </FormRow>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <FormRow id="ad-url" label={t('Link tin (không bắt buộc)')}>
            <Input
              id="ad-url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </FormRow>
          <FormRow id="ad-month" label={t('Tháng')}>
            <Input
              id="ad-month"
              type="month"
              placeholder="YYYY-MM"
              value={adMonth}
              onChange={(e) => setAdMonth(e.target.value)}
            />
          </FormRow>
        </div>
        <FormRow
          id="ad-text"
          label={t('Nội dung tin')}
          hint={t('{n} / {max} ký tự', { n: text.length, max: t.num(MAX_TEXT) })}
        >
          <Textarea
            id="ad-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="max-h-[45vh] overflow-y-auto"
            placeholder={t('Dán toàn bộ phần mô tả công việc và yêu cầu…')}
          />
        </FormRow>
        {ad && (
          <FormRow
            id="ad-skills"
            label={t('Kỹ năng (sửa tay, cách nhau bằng dấu phẩy)')}
            hint={t(
              'Sửa ô này thì kết quả của bạn được giữ, không phân tích lại. Đổi vị trí, công ty hay nội dung thì tin được phân tích lại.',
            )}
          >
            <Input id="ad-skills" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </FormRow>
        )}
        <FormError error={error} />
      </DialogPanel>
      <DialogFooter>
        <span className="me-auto self-center text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> {t('để lưu')}
        </span>
        <DialogClose render={<Button variant="ghost" type="button" />}>{t('Hủy')}</DialogClose>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {ad ? t('Lưu') : t('Lưu và phân tích')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Paste (ad = null) or edit a job ad: POST/PATCH /api/market/job-ads. */
export function JobAdDialog({
  open,
  ad,
  month,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  ad: ApiJobAd | null;
  /** Default month for a new ad (the month shown on the page). */
  month: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (ad: ApiJobAd, created: boolean) => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup closeProps={{ 'aria-label': t('Đóng') }} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{ad ? t('Sửa tin tuyển dụng') : t('Dán tin tuyển dụng')}</DialogTitle>
          <DialogDescription>
            {t('Mỗi tháng 5 đến 10 tin của vai trò nhắm tới. Kỹ năng và cấp bậc được rút ra trong nền, vài phút sau sẽ có.')}
          </DialogDescription>
        </DialogHeader>
        {open && <JobAdForm key={ad?.id ?? 'new'} ad={ad} month={month} onSaved={onSaved} />}
      </DialogPopup>
    </Dialog>
  );
}
