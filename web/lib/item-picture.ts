// An Item's own picture (DECISIONS 9.6): a poster for a book or a film, a logo for a project or a tool, a cover for the
// rest; plus the checks the picture field makes before an upload. Pure and free of the handbook registry, so Công việc and
// the inbox dialog do not ship it; the Sổ tay cover of a handbook course comes from lib/handbook-picture.ts. Unit-tested
// in item-picture.test.ts; components/brain/library/item-image.tsx draws a picture.
import type { Book } from '@/lib/books';
import type { T } from '@/lib/i18n/translate';
import { firstToolStage, type ToolGroupKey, type ToolStage } from '@/lib/tools';

export type ImageShape = 'poster' | 'cover' | 'logo';

export type ItemPicture =
  | { kind: 'image'; url: string; shape: ImageShape }
  | { kind: 'handbook'; book: Book }
  /** A tool without a logo of its own: the icon of its first stage (null: no stage, the Wrench), in the logo's place. */
  | { kind: 'stage'; stage: ToolStage | null };

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

/** Whether the source is a web address, which a fetch from the link needs. */
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

/** Whether the type's picture is a logo (a project, a tool), never a page's OG image, which is a banner. */
export const takesLogo = (type: string): boolean => imageShapeOf(type) === 'logo';

/**
 * Whether the server finds the type's logo on its own: a tool's is the icon of its official site (DECISIONS 9.10;
 * backend library.services.SITE_ICON_TYPES, library/logos.py). A project's logo is only uploaded: a client's site is not
 * the project's logo.
 */
export const takesSiteLogo = (type: string): boolean => type === 'tool';

/**
 * Whether the picture can come from the link (the field's fetch toggle): a web address, for any type but a project. A
 * tool's link gives the logo of its site ("Lấy logo từ trang"), every other type's the page's image ("Lấy ảnh từ link").
 */
export function canFetchPicture(type: string, source: string | null | undefined): boolean {
  return isWebLink(source) && (!takesLogo(type) || takesSiteLogo(type));
}

/** Only same-origin paths (the API's /api/items/{id}/image) are ever rendered: no request to another domain. */
export function isLocalImage(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

/** An Item's own image in the shape of its type, or null. */
export function ownPicture(item: { type: string; imageUrl?: string | null }): ItemPicture | null {
  return isLocalImage(item.imageUrl) ? { kind: 'image', url: item.imageUrl, shape: imageShapeOf(item.type) } : null;
}

/**
 * What a tool shows until it has a logo (owner 13/11/2026: "nếu mình không kịp tải logo lên"; also while its site's
 * logo is being fetched, or when its site has none): the icon of its first stage in the Công cụ page's order
 * (lib/tools.ts), or the Wrench without a stage. Null for every other type.
 */
export function stagePicture(item: { type: string; tags?: readonly string[] | null }): ItemPicture | null {
  return item.type === 'tool' ? { kind: 'stage', stage: firstToolStage(item.tags) } : null;
}

/**
 * A tool's picture in a Công cụ group: its own logo, else the icon of the group the row stands under, so a tool listed
 * under Bảo mật shows the shield even when its first stage is Review code (a tool appears in each of its groups).
 */
export function toolRowPicture(item: { type: string; imageUrl?: string | null }, group: ToolGroupKey): ItemPicture {
  return ownPicture(item) ?? { kind: 'stage', stage: group === 'other' ? null : group };
}

/**
 * The picture change a save really sends. The field hides its fetch toggle when the picture cannot come from the link
 * (a project, or a source that is no web address: canFetchPicture), and hides itself for a handbook course without a
 * picture of its own; a change chosen before such an edit is dropped here instead of being sent unseen.
 */
export function effectiveImageChange<C extends { kind: string }>(
  change: C,
  ctx: { type: string; source: string; handbook: boolean; hasOwnImage: boolean },
): C | { kind: 'keep' } {
  if (ctx.handbook && !ctx.hasOwnImage) return { kind: 'keep' };
  if (change.kind === 'fetch' && !canFetchPicture(ctx.type, ctx.source)) return { kind: 'keep' };
  return change;
}

/**
 * Whether saving will make the server fetch the picture on its own (API_CONTRACT "Automatic fetch"): a new Item, or one
 * whose source changes, with a web link and no picture, unless it is a project. A tool gets the logo of its site.
 */
export function willFetchOnSave(ctx: {
  creating: boolean;
  type: string;
  source: string;
  savedSource: string;
  hasOwnImage: boolean;
}): boolean {
  if (ctx.hasOwnImage || !canFetchPicture(ctx.type, ctx.source)) return false;
  return ctx.creating || ctx.source.trim() !== ctx.savedSource.trim();
}
