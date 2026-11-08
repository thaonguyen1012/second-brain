import { describe, expect, it } from 'vitest';
import { tVi } from './i18n/translate';
import {
  MAX_IMAGE_BYTES,
  SHRINK_TO,
  effectiveImageChange,
  handbookPath,
  imageFileProblem,
  imageShapeOf,
  isLocalImage,
  isWebLink,
  ownPicture,
  shrinkTarget,
  willFetchOnSave,
} from './item-picture';

describe('imageFileProblem', () => {
  it('accepts the four formats the server decodes, up to 10 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
      expect(imageFileProblem({ type, size: 1000 }, tVi)).toBeNull();
    expect(imageFileProblem({ type: 'image/png', size: MAX_IMAGE_BYTES }, tVi)).toBeNull();
  });

  it('says why before any upload', () => {
    expect(imageFileProblem({ type: 'image/svg+xml', size: 10 }, tVi)).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: 'image/heic', size: 10 }, tVi)).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: '', size: 10 }, tVi)).toBe('Chỉ nhận ảnh JPEG, PNG, GIF hoặc WebP.');
    expect(imageFileProblem({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }, tVi)).toBe('Ảnh lớn hơn 10 MB.');
  });
});

describe('shrinkTarget', () => {
  it('leaves a small picture as it is', () => {
    expect(shrinkTarget(1200, 630, 300_000)).toBeNull();
    expect(shrinkTarget(2400, 1600, 2_000_000)).toBeNull();
  });

  it('shrinks a phone photo above the server pixel limit to 1600 px, keeping the proportion', () => {
    expect(shrinkTarget(5712, 4284, 3_500_000)).toEqual({ width: SHRINK_TO, height: 1200 });
    expect(shrinkTarget(3000, 4000, 1_000_000)).toEqual({ width: 1200, height: SHRINK_TO });
  });

  it('re-encodes a heavy file at its size and never enlarges', () => {
    expect(shrinkTarget(1500, 1000, 6 * 1024 * 1024)).toEqual({ width: 1500, height: 1000 });
    expect(shrinkTarget(0, 100, 10)).toBeNull();
  });
});

describe('isWebLink', () => {
  it('is true only for an http(s) address', () => {
    expect(isWebLink('https://www.imdb.com/title/tt1/')).toBe(true);
    expect(isWebLink(' http://example.com ')).toBe(true);
    expect(isWebLink('James Clear')).toBe(false);
    expect(isWebLink('/docs/it/x/')).toBe(false);
    expect(isWebLink('https://')).toBe(false);
    expect(isWebLink('')).toBe(false);
    expect(isWebLink(undefined)).toBe(false);
  });
});

describe('handbookPath', () => {
  it('reads a handbook page, with or without the trailing slash', () => {
    expect(handbookPath('/docs/it/handbook-06/')).toEqual({ track: 'it', slug: 'handbook-06' });
    expect(handbookPath(' /docs/kinh-doanh/handbook-01 ')).toEqual({
      track: 'kinh-doanh',
      slug: 'handbook-01',
    });
  });

  it('is null for anything else', () => {
    expect(handbookPath('/docs/it/handbook-06/m01/')).toBeNull();
    expect(handbookPath('https://example.com/docs/it/x/')).toBeNull();
    expect(handbookPath('Udemy')).toBeNull();
    expect(handbookPath(null)).toBeNull();
  });
});

describe('imageShapeOf', () => {
  it('gives books and films a poster, projects a logo, the rest a cover', () => {
    expect(imageShapeOf('book')).toBe('poster');
    expect(imageShapeOf('film')).toBe('poster');
    expect(imageShapeOf('project')).toBe('logo');
    expect(imageShapeOf('article')).toBe('cover');
    expect(imageShapeOf('course')).toBe('cover');
  });
});

describe('isLocalImage', () => {
  it('accepts only same-origin paths', () => {
    expect(isLocalImage('/api/items/3/image?v=ab12cd34')).toBe(true);
    expect(isLocalImage('//evil.example/x.png')).toBe(false);
    expect(isLocalImage('https://example.com/x.png')).toBe(false);
    expect(isLocalImage('data:image/png;base64,AAAA')).toBe(false);
    expect(isLocalImage('')).toBe(false);
    expect(isLocalImage(null)).toBe(false);
    expect(isLocalImage(undefined)).toBe(false);
  });
});

describe('ownPicture', () => {
  it("is the Item's own image in the shape of its type, or nothing", () => {
    expect(ownPicture({ type: 'film', imageUrl: '/api/items/1/image?v=1' })).toEqual({
      kind: 'image',
      url: '/api/items/1/image?v=1',
      shape: 'poster',
    });
    expect(ownPicture({ type: 'project', imageUrl: '/api/items/2/image?v=2' })).toMatchObject({ shape: 'logo' });
    expect(ownPicture({ type: 'book', imageUrl: null })).toBeNull();
    expect(ownPicture({ type: 'book', imageUrl: 'https://example.com/cover.jpg' })).toBeNull();
  });
});

describe('effectiveImageChange', () => {
  const upload = { kind: 'upload' as const };
  const fetch = { kind: 'fetch' as const };
  const ctx = { type: 'article', source: 'https://example.com/a', handbook: false, hasOwnImage: false };

  it('sends the chosen change when the field shows it', () => {
    expect(effectiveImageChange(upload, ctx)).toBe(upload);
    expect(effectiveImageChange(fetch, ctx)).toBe(fetch);
  });

  it('drops a fetch for a project or a source that is no web link', () => {
    expect(effectiveImageChange(fetch, { ...ctx, type: 'project' })).toEqual({ kind: 'keep' });
    expect(effectiveImageChange(fetch, { ...ctx, source: 'Wim Wenders' })).toEqual({ kind: 'keep' });
    expect(effectiveImageChange(upload, { ...ctx, type: 'project' })).toBe(upload);
  });

  it('drops any change for a handbook course without a picture of its own (the field is hidden)', () => {
    expect(effectiveImageChange(upload, { ...ctx, handbook: true })).toEqual({ kind: 'keep' });
    expect(effectiveImageChange({ kind: 'remove' }, { ...ctx, handbook: true, hasOwnImage: true })).toEqual({
      kind: 'remove',
    });
  });
});

describe('willFetchOnSave', () => {
  const base = { creating: true, type: 'book', source: 'https://www.goodreads.com/x', savedSource: '', hasOwnImage: false };

  it('is true for a new Item or a new link, with no picture and not a project', () => {
    expect(willFetchOnSave(base)).toBe(true);
    expect(willFetchOnSave({ ...base, creating: false, savedSource: 'James Clear' })).toBe(true);
  });

  it('is false otherwise', () => {
    expect(willFetchOnSave({ ...base, creating: false, savedSource: 'https://www.goodreads.com/x' })).toBe(false);
    expect(willFetchOnSave({ ...base, type: 'project' })).toBe(false);
    expect(willFetchOnSave({ ...base, hasOwnImage: true })).toBe(false);
    expect(willFetchOnSave({ ...base, source: 'James Clear' })).toBe(false);
  });
});
