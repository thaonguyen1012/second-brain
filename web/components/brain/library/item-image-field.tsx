'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Link2, X } from 'lucide-react';
import type { ApiError, ApiItem } from '@/lib/api/client';
import { itemImageApi } from '@/lib/api/library';
import { firstFieldError } from '@/lib/labels';
import { IMAGE_ACCEPT, imageFileProblem, imageShapeOf, isLocalImage, isWebLink, shrinkTarget } from '@/lib/item-picture';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';
import type { T } from '@/lib/i18n/translate';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// The picture field of the Item and project dialogs (DECISIONS 9.6): a book or film poster, an article or course
// cover, a project logo. Every change waits for "Lưu" (and "Hủy" drops it), so removing a picture needs no confirm
// dialog; the dialog sends the change after the record itself is saved (applyImageChange).

export type ImageChange = { kind: 'keep' } | { kind: 'upload'; file: File } | { kind: 'remove' } | { kind: 'fetch' };

export const KEEP_IMAGE: ImageChange = { kind: 'keep' };

export type ImageFields = Pick<ApiItem, 'imageUrl' | 'imagePending'>;

/**
 * Sends a picture change for a saved Item (or project, which is an Item) and answers its new picture fields, or null
 * when there was nothing to send. Callers merge them into their own record.
 */
export async function applyImageChange(id: number, change: ImageChange): Promise<ImageFields | null> {
  switch (change.kind) {
    case 'upload': {
      const saved = await itemImageApi.upload(id, change.file);
      return { imageUrl: saved.imageUrl, imagePending: saved.imagePending };
    }
    case 'remove':
      // the server also ends a fetch from the link that waits or runs, so nothing comes back afterwards
      await itemImageApi.remove(id);
      return { imageUrl: null, imagePending: false };
    case 'fetch': {
      const saved = await itemImageApi.fetchFromLink(id);
      return { imageUrl: saved.imageUrl, imagePending: saved.imagePending };
    }
    default:
      return null;
  }
}

/** The words for a picture change the server refused (the record itself was saved), without final punctuation. */
export function imageErrorText(e: ApiError, t: T): string {
  if (!e.reachable) return t('chưa kết nối được máy chủ');
  if (e.status === 413) return t('ảnh lớn hơn giới hạn của máy chủ');
  if (e.status === 404) return t('mục này không còn nữa');
  if (e.status === 400) return (firstFieldError(e.body, t) ?? t('ảnh không hợp lệ')).replace(/[.\s]+$/, '');
  return t('máy chủ trả lỗi {status}', { status: e.status });
}

/**
 * The picked file as it will be uploaded: a big photo is shrunk in the browser (shrinkTarget), so a phone's
 * 24-megapixel JPEG goes instead of being refused by the server's pixel limit, and in a few hundred KB. WebP keeps a
 * logo's transparency (a browser that cannot encode WebP gives PNG, which the server takes too). Rejects when the
 * browser cannot read the picture.
 */
async function prepareUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const target = shrinkTarget(bitmap.width, bitmap.height, file.size);
    if (!target) return file;
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) return file;
    const extension = blob.type === 'image/png' ? 'png' : 'webp';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${extension}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

const previewBox = {
  poster: 'h-24 w-16 object-cover',
  cover: 'h-16 aspect-[16/7] object-cover',
  // the logo ground stays white under forced colours too, or a dark transparent logo would vanish
  logo: 'size-16 rounded-md bg-logo-ground object-contain p-1.5 forced-color-adjust-none',
} as const;

export function ItemImageField({
  type,
  source,
  imageUrl,
  pending,
  fetchOnSave = false,
  change,
  onChange,
  disabled,
}: {
  type: string;
  source: string;
  /** The saved picture (ApiItem.imageUrl / ApiProject.imageUrl). */
  imageUrl: string | null | undefined;
  /** A fetch from the link is waiting for run_jobs (ApiItem.imagePending). */
  pending?: boolean;
  /** Saving will make the server fetch the link's image on its own (willFetchOnSave). */
  fetchOnSave?: boolean;
  /** The change the save will send (the dialog passes effectiveImageChange). */
  change: ImageChange;
  onChange: (change: ImageChange) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const labelId = useId();
  const statusId = useId();
  const problemId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  // The picked file's preview URL: made in the pick handler (not in an effect), revoked on the next pick and on
  // unmount, so strict mode never leaks one.
  const objectUrl = useRef<string | null>(null);
  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const shape = imageShapeOf(type);
  const saved = isLocalImage(imageUrl) ? imageUrl : null;
  const pickedUrl = change.kind === 'upload' && picked?.file === change.file ? picked.url : null;
  const preview = change.kind === 'upload' ? pickedUrl : change.kind === 'remove' ? null : saved;
  const label = shape === 'logo' ? t('Logo') : t('Ảnh bìa');
  const currentLabel = shape === 'logo' ? t('Logo hiện tại') : t('Ảnh bìa hiện tại');
  // a project's or a tool's link is a site, whose OG card is a banner, not a logo: only an upload makes a logo
  const canFetch = shape !== 'logo' && isWebLink(source);
  const fetchChosen = change.kind === 'fetch';

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const why = imageFileProblem(file, t);
    setProblem(why);
    if (why) return;
    setReading(true);
    try {
      const upload = await prepareUpload(file);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(upload);
      setPicked({ file: upload, url: objectUrl.current });
      onChange({ kind: 'upload', file: upload });
    } catch {
      setProblem(t('Không đọc được ảnh này. Chỉ nhận JPEG, PNG, GIF hoặc WebP.'));
    } finally {
      setReading(false);
    }
  };

  const status = reading
    ? t('Đang đọc ảnh…')
    : fetchChosen
      ? t('Ảnh sẽ được lấy từ link sau khi lưu; nó hiện sau vài phút.')
      : change.kind === 'upload'
        ? t('Ảnh mới được lưu khi bấm Lưu.')
        : change.kind === 'remove'
          ? t('Ảnh được bỏ khi bấm Lưu.')
          : pending && !saved
            ? t('Đang lấy ảnh từ link; nó hiện sau vài phút.')
            : !saved && fetchOnSave
              ? t('Khi lưu, ảnh sẽ được lấy từ link; nó hiện sau vài phút.')
              : !saved
                ? t('Chưa có ảnh.')
                : '';

  return (
    <div className="flex flex-col gap-1.5">
      <Label render={<span id={labelId} />}>{label}</Label>
      <div role="group" aria-labelledby={labelId} className="flex items-start gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- a local webp or the picked file's blob: preview
          <img src={preview} alt={currentLabel} className={cn(previewBox[shape], 'shrink-0 overflow-hidden')} />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          {/* The buttons stay where they are when used (a toggle, a label that changes), so the focus stays too */}
          <div className="flex flex-wrap gap-2">
            <Button
              ref={uploadButton}
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || reading}
              // a refused file is described on the button that picks one (the focus is back on it after the pick)
              aria-describedby={problem ? `${statusId} ${problemId}` : statusId}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus aria-hidden />
              {preview ? t('Đổi ảnh') : t('Tải ảnh lên')}
            </Button>
            {canFetch && !fetchOnSave && (
              <Button
                type="button"
                size="sm"
                variant={fetchChosen ? 'secondary' : 'outline'}
                disabled={disabled}
                aria-pressed={fetchChosen}
                aria-describedby={statusId}
                onClick={() => onChange(fetchChosen ? KEEP_IMAGE : { kind: 'fetch' })}
              >
                <Link2 aria-hidden />
                {t('Lấy ảnh từ link')}
              </Button>
            )}
            {preview && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-describedby={statusId}
                onClick={() => {
                  setProblem(null);
                  // the picture goes (a saved one on "Lưu"); this button goes with it, so the focus moves on
                  uploadButton.current?.focus();
                  onChange(saved ? { kind: 'remove' } : KEEP_IMAGE);
                }}
              >
                <X aria-hidden />
                {t('Bỏ ảnh')}
              </Button>
            )}
          </div>
          <p id={statusId} className="text-xs text-muted-foreground" aria-live="polite">
            {status}
          </p>
          {problem && (
            <p id={problemId} className="text-xs text-destructive-foreground" role="alert">
              {problem}
            </p>
          )}
        </div>
      </div>
      {/* hidden: out of the tab order and the accessibility tree; the visible button opens it */}
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = ''; // the same file can be picked again after "Bỏ ảnh"
        }}
      />
    </div>
  );
}
