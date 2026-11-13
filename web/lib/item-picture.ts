// An Item's own picture (DECISIONS 9.6): a poster for a book or a film, a logo for a project or a tool, a cover for the
// rest; plus the checks the picture field makes before an upload. Pure and free of the handbook registry, so Công việc and
// the inbox dialog do not ship it; the Sổ tay cover of a handbook course comes from lib/handbook-picture.ts. Unit-tested
// in item-picture.test.ts; components/brain/library/item-image.tsx draws a picture.
import type { Book } from '@/lib/books';
import type { T } from '@/lib/i18n/translate';

export type ImageShape = 'poster' | 'cover' | 'logo';

export type ItemPicture = { kind: 'image'; url: string; shape: ImageShape } | { kind: 'handbook'; book: Book };

/** Upload limit of POST /api/items/{id}/image (backend settings.ITEM_IMAGE_MAX_BYTES). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** What the server decodes (thumbnails.FORMATS); iOS turns a HEIC photo into a JPEG for this accept list. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const acceptedTypes = new Set(IMAGE_ACCEPT.split(','));

/** The server refuses a picture above this many pixels (thumbnails.MAX_PIXELS, a decompression-bomb guard). */
export const MAX_IMAGE_PIXELS = 20_000_000;
/** A picked photo is shrunk in the browser to this longest side when it is big (the server keeps 600 px anyway). */
export const SHRINK_TO = 1600;

/** Why a picked file cannot be uploaded, said before any request; null when it can. */
export function imageFileProblem(file: { type: string; size: number }, t: T): string | null {
  if (!acceptedTypes.has(file.type)) return t('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
  if (file.size > MAX_IMAGE_BYTES) return t('Ảnh lớn hơn 10 MB.');
  return null;
}

/**
 * The size to shrink a picked picture to before the upload, or null to send it as it is. A big photo (more than
 * 4 MB, a side over 2400 px, or above the server's pixel limit) goes at SHRINK_TO on its longest side: a phone's
 * 24-megapixel JPEG then uploads in a few hundred KB instead of being refused.
 */
export function shrinkTarget(width: number, height: number, bytes: number): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) return null;
  const big = bytes > 4 * 1024 * 1024 || Math.max(width, height) > 2400 || width * height > MAX_IMAGE_PIXELS;
  if (!big) return null;
  const scale = Math.min(1, SHRINK_TO / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Whether "Lấy ảnh từ link" can work: the source is a web address. */
export function isWebLink(source: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test((source ?? '').trim());
}

/** The handbook page a source names (`/docs/<track>/<slug>/`, the form of bookUrl()), or null. No registry. */
export function handbookPath(source: string | null | undefined): { track: string; slug: string } | null {
  const m = /^\/docs\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec((source ?? '').trim());
  return m ? { track: m[1], slug: m[2] } : null;
}

/** The shape an Item's image takes: a 2:3 poster for books and films, a logo for projects and tools, else a cover. */
export function imageShapeOf(type: string): ImageShape {
  if (type === 'book' || type === 'film') return 'poster';
  if (type === 'project' || type === 'tool') return 'logo';
  return 'cover';
}

/**
 * Whether the type's picture is a logo (a project, a tool). A page's OG image is a banner, not a logo, so the server
 * never fetches one for these on its own (backend library.services.LOGO_TYPES) and the field offers no "Lấy ảnh từ
 * link": a logo is uploaded.
 */
export const takesLogo = (type: string): boolean => imageShapeOf(type) === 'logo';

/** Only same-origin paths (the API's /api/items/{id}/image) are ever rendered: no request to another domain. */
export function isLocalImage(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

/** An Item's own image in the shape of its type, or null. */
export function ownPicture(item: { type: string; imageUrl?: string | null }): ItemPicture | null {
  return isLocalImage(item.imageUrl) ? { kind: 'image', url: item.imageUrl, shape: imageShapeOf(item.type) } : null;
}

/**
 * The picture change a save really sends. The field hides "Lấy ảnh từ link" for a logo (a project, a tool) or a source
 * that is no web address, and hides itself for a handbook course without a picture of its own; a change chosen before
 * such an edit is dropped here instead of being sent unseen.
 */
export function effectiveImageChange<C extends { kind: string }>(
  change: C,
  ctx: { type: string; source: string; handbook: boolean; hasOwnImage: boolean },
): C | { kind: 'keep' } {
  if (ctx.handbook && !ctx.hasOwnImage) return { kind: 'keep' };
  if (change.kind === 'fetch' && (takesLogo(ctx.type) || !isWebLink(ctx.source))) return { kind: 'keep' };
  return change;
}

/**
 * Whether saving will make the server fetch the link's image on its own (API_CONTRACT "Automatic fetch"): a new
 * Item, or one whose source changes, with a web link, no picture and no logo (not a project or a tool).
 */
export function willFetchOnSave(ctx: {
  creating: boolean;
  type: string;
  source: string;
  savedSource: string;
  hasOwnImage: boolean;
}): boolean {
  if (takesLogo(ctx.type) || ctx.hasOwnImage || !isWebLink(ctx.source)) return false;
  return ctx.creating || ctx.source.trim() !== ctx.savedSource.trim();
}
