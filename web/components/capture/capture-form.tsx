'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, type ApiInboxEntry } from '@/lib/api/client';
import { toApiError } from '@/lib/api/use-api';
import { MAX_TEXT, MAX_URL, draftFromParams, httpUrl } from '@/lib/capture';
import { useT } from '@/lib/i18n/client';
import { describeApiError } from '@/components/brain/api-state';
import { refreshInboxCount } from '@/components/brain/inbox-count';
import { SaveKeys } from '@/components/brain/save-keys';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * /inbox/them/?url=&title=&text= (bookmarklet, PWA share target): a confirm form for one inbox capture.
 * Uses useSearchParams: the page renders it inside a Suspense boundary.
 */
export function CaptureForm() {
  const t = useT();
  const params = useSearchParams();
  const [draft] = useState(() => draftFromParams(new URLSearchParams(params.toString())));
  const [url, setUrl] = useState(draft.url);
  const [note, setNote] = useState(draft.note);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<ApiInboxEntry | null>(null);

  const href = httpUrl(url);
  const urlError = url.trim() && !href ? t('Chỉ nhận link http hoặc https.') : null;
  const canSave = !busy && !urlError && !!(href || note.trim());

  const submit = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const body = href ? { url: href, text: note.trim() } : { text: note.trim() };
      setSaved(await api.createInboxEntry(body));
      void refreshInboxCount();
    } catch (err) {
      const e = toApiError(err);
      const d = describeApiError(e, t);
      setError(e.status === 400 ? t('Link không hợp lệ (chỉ nhận http và https).') : `${d.title}. ${d.text}`);
    } finally {
      setBusy(false);
    }
  };

  if (saved) return <Saved entry={saved} />;

  return (
    <form
      className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
    >
      {/* Field wires label, aria-invalid and the error's aria-describedby (Space UI Field on Base UI) */}
      <Field invalid={!!urlError} className="gap-1.5">
        <FieldLabel>{t('Link')}</FieldLabel>
        <Input
          id="capture-url"
          type="url"
          inputMode="url"
          value={url}
          maxLength={MAX_URL}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
        {urlError && (
          <FieldError match className="text-destructive-foreground">
            {urlError} {t('Sửa link hoặc xóa trống để chỉ lưu ghi chú.')}
          </FieldError>
        )}
      </Field>
      <Field className="gap-1.5">
        <FieldLabel>{t('Ghi chú kèm theo')}</FieldLabel>
        <Textarea
          id="capture-note"
          value={note}
          maxLength={MAX_TEXT}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Tiêu đề, đoạn trích hoặc vì sao lưu…')}
          rows={4}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground max-sm:hidden pointer-coarse:hidden">
          <SaveKeys /> {t('để lưu')}
        </span>
        {error && (
          <span className="text-xs text-destructive-foreground" role="alert">
            {error}
          </span>
        )}
        {/* Focused on open: Enter saves the capture as it came from the bookmarklet or the share sheet. */}
        <Button type="submit" className="ms-auto max-sm:w-full" disabled={!canSave} autoFocus>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {t('Lưu vào inbox')}
        </Button>
      </div>
    </form>
  );
}

function Saved({ entry }: { entry: ApiInboxEntry }) {
  const t = useT();
  const [closeFailed, setCloseFailed] = useState(false);
  // The bookmarklet falls back to this same tab when its popup is blocked: no opener, the article one step back.
  // Closing would lose the article (and browsers refuse it anyway), so go back to it instead. The popup and the
  // share-target window keep "Đóng".
  const [sameTab] = useState(() => !window.opener && window.history.length > 1);
  const close = () => {
    if (sameTab) {
      window.history.back();
      return;
    }
    window.close();
    // Only windows opened by a script (the bookmarklet's popup) can close themselves.
    window.setTimeout(() => {
      if (!window.closed) setCloseFailed(true);
    }, 300);
  };
  return (
    <div
      className="flex max-w-xl flex-col gap-4 rounded-xl border bg-card p-4"
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="size-4 text-success-foreground" aria-hidden />
        {t('Đã lưu vào inbox')}
      </p>
      <p className="truncate text-sm text-muted-foreground">{entry.url || (entry.text ?? '').split('\n')[0]}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={close} autoFocus>
          {sameTab ? t('Quay lại trang trước') : t('Đóng')}
        </Button>
        <Button variant="outline" render={<Link href={`/inbox/?status=inbox&id=${entry.id}`} />}>
          {t('Mở Inbox')}
        </Button>
      </div>
      {closeFailed && (
        <p className="text-xs text-muted-foreground">
          {t('Trình duyệt không cho trang này tự đóng. Hãy đóng tab bằng tay.')}
        </p>
      )}
    </div>
  );
}
