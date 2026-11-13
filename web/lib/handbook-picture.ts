// The picture of an Item on Thư viện: its own image (lib/item-picture.ts), else the Sổ tay cover of a handbook course,
// whose BookCover needs the registry's title. Kept apart from item-picture.ts so only Thư viện ships the registry.
// Unit-tested in handbook-picture.test.ts.
import { books, bookUrl, type Book } from '@/lib/books';
import { ownPicture, stagePicture, type ItemPicture } from '@/lib/item-picture';

const sourceKey = (s: string) => s.trim().replace(/\/+$/, '');
const handbookBySource = new Map(books.map((b) => [sourceKey(bookUrl(b)), b]));

/** The handbook whose page the source is (`/docs/<track>/<slug>/`, trailing slash optional). */
export function handbookForSource(source: string | null | undefined): Book | undefined {
  return source ? handbookBySource.get(sourceKey(source)) : undefined;
}

/**
 * Its own image first; a handbook course without one shows its Sổ tay cover, a tool without one its first stage's icon
 * (stagePicture); else nothing.
 */
export function itemPicture(item: {
  type: string;
  source?: string | null;
  imageUrl?: string | null;
  tags?: readonly string[] | null;
}): ItemPicture | null {
  const own = ownPicture(item);
  if (own) return own;
  const book = item.type === 'course' ? handbookForSource(item.source) : undefined;
  return book ? { kind: 'handbook', book } : stagePicture(item);
}
