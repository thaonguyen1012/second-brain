'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Link2, X } from 'lucide-react';
import type { ApiError, ApiItem } from '@/lib/api/client';
import { itemImageApi } from '@/lib/api/library';
import { firstFieldError } from '@/lib/labels';
import { IMAGE_ACCEPT, imageFileProblem, imageShapeOf, isLocalImage, isWebLink } from '@/lib/item-picture';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// The picture field of the Item and project dialogs (DECISIONS 9.6): a book or film poster, an article or course
// cover, a project logo. Every change waits for "Lưu" (and "Hủy" drops it), so removing a picture needs no confirm
// dialog; applyImageChange() sends it after the record itself is saved.

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

/** The words for a picture change the server refused (the record itself was saved). */
export function imageErrorText(e: ApiError): string {
  if (!e.reachable) return 'chưa kết nối được máy chủ';
  if (e.status === 413) return 'ảnh lớn hơn giới hạn của máy chủ';
  if (e.status === 400) return firstFieldError(e.body) ?? 'ảnh không hợp lệ';
  if (e.status === 404) return 'mục này không còn nữa';
  return `máy chủ trả lỗi ${e.status}`;
}

const previewBox = {
  poster: 'h-24 w-16',
  cover: 'h-16 aspect-[16/7]',
  logo: 'size-16 rounded-md bg-logo-ground p-1.5',
} as const;

export function ItemImageField({
  type,
  source,
  imageUrl,
  pending,
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
  change: ImageChange;
  onChange: (change: ImageChange) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  // The picked file's preview URL: made in the change handler (not in an effect), revoked on the next pick and on
  // unmount, so strict mode never leaks one.
  const objectUrl = useRef<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const shape = imageShapeOf(type);
  const saved = isLocalImage(imageUrl) ? imageUrl : null;
  const preview = change.kind === 'upload' ? picked : change.kind === 'remove' ? null : saved;
  const label = type === 'project' ? 'Logo' : 'Ảnh bìa';
  // a project's link is a site, whose OG card is a banner, not a logo: only an upload makes a logo
  const canFetch = type !== 'project' && isWebLink(source);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const why = imageFileProblem(file);
    setProblem(why);
    if (why) return;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setPicked(objectUrl.current);
    onChange({ kind: 'upload', file });
  };

  const status =
    change.kind === 'fetch'
      ? 'Ảnh sẽ được lấy từ link sau khi lưu; nó hiện sau vài phút.'
      : change.kind === 'upload'
        ? 'Ảnh mới được lưu khi bấm Lưu.'
        : change.kind === 'remove'
          ? 'Ảnh được bỏ khi bấm Lưu.'
          : pending && !saved
            ? 'Đang lấy ảnh từ link; nó hiện sau vài phút.'
            : !saved
              ? 'Chưa có ảnh.'
              : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex items-start gap-3">
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- a local webp or the picked file's blob: preview
          <img
            src={preview}
            alt={`${label} hiện tại`}
            className={cn(previewBox[shape], 'shrink-0 overflow-hidden', shape === 'logo' ? 'object-contain' : 'object-cover')}
          />
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => fileInput.current?.click()}>
              <ImagePlus aria-hidden />
              {preview ? 'Đổi ảnh' : 'Tải ảnh lên'}
            </Button>
            {canFetch && change.kind !== 'fetch' && (
              <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange({ kind: 'fetch' })}>
                <Link2 aria-hidden />
                Lấy ảnh từ link
              </Button>
            )}
            {(preview || change.kind === 'fetch') && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  setProblem(null);
                  // a requested fetch is simply dropped; any shown picture goes, the saved one on "Lưu"
                  onChange(change.kind === 'fetch' || !saved ? KEEP_IMAGE : { kind: 'remove' });
                }}
              >
                <X aria-hidden />
                {change.kind === 'fetch' ? 'Không lấy ảnh' : 'Bỏ ảnh'}
              </Button>
            )}
          </div>
          {problem ? (
            <p className="text-xs text-destructive-foreground" role="alert">
              {problem}
            </p>
          ) : (
            status && <p className="text-xs text-muted-foreground">{status}</p>
          )}
        </div>
      </div>
      <input
        ref={fileInput}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = ''; // the same file can be picked again after "Bỏ ảnh"
        }}
      />
    </div>
  );
}
