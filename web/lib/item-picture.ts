// Which picture an Item shows on Thư viện and Công việc (DECISIONS 9.6): its own image (a poster for a book or a
// film, a logo for a project, a cover for the rest), else the Sổ tay cover of a handbook course, else nothing. Pure,
// so it is unit-tested in item-picture.test.ts; components/brain/library/item-image.tsx draws it.
import { books, bookUrl, type Book } from '@/lib/books';

export type ImageShape = 'poster' | 'cover' | 'logo';

/** Upload limit of POST /api/items/{id}/image (backend settings.ITEM_IMAGE_MAX_BYTES and nginx's location for it). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** What the server decodes (thumbnails.FORMATS); iOS turns a HEIC photo into a JPEG for this accept list. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const acceptedTypes = new Set(IMAGE_ACCEPT.split(','));

/** Why a picked file cannot be uploaded, said before any request; null when it can. */
export function imageFileProblem(file: { type: string; size: number }): string | null {
  if (!acceptedTypes.has(file.type)) return 'Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.';
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh lớn hơn 10 MB.';
  return null;
}

/** Whether "Lấy ảnh từ link" can work: the source is a web address. */
export function isWebLink(source: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test((source ?? '').trim());
}

export type ItemPicture = { kind: 'image'; url: string; shape: ImageShape } | { kind: 'handbook'; book: Book };

const sourceKey = (s: string) => s.trim().replace(/\/+$/, '');
const handbookBySource = new Map(books.map((b) => [sourceKey(bookUrl(b)), b]));

/** The handbook whose page the source is (`/docs/<track>/<slug>/`, trailing slash optional). */
export function handbookForSource(source: string | null | undefined): Book | undefined {
  return source ? handbookBySource.get(sourceKey(source)) : undefined;
}

/** The shape an Item's image takes: a 2:3 poster for books and films, a logo for projects, else a landscape cover. */
export function imageShapeOf(type: string): ImageShape {
  if (type === 'book' || type === 'film') return 'poster';
  if (type === 'project') return 'logo';
  return 'cover';
}

/** Only same-origin paths (the API's /api/items/{id}/image) are ever rendered: no request to another domain. */
export function isLocalImage(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//');
}

export function itemPicture(item: {
  type: string;
  source?: string | null;
  imageUrl?: string | null;
}): ItemPicture | null {
  if (isLocalImage(item.imageUrl)) return { kind: 'image', url: item.imageUrl, shape: imageShapeOf(item.type) };
  const book = item.type === 'course' ? handbookForSource(item.source) : undefined;
  return book ? { kind: 'handbook', book } : null;
}
