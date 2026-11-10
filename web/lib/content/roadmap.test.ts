import { describe, expect, it } from 'vitest';
import { parseRoadmap, roadmapText } from './roadmap';

const item = (text: unknown, books: unknown = [], links: unknown = []) => ({ text, books, links });
const phase = (name: unknown, months: unknown, items: unknown[]) => ({ name, months, items });

describe('parseRoadmap', () => {
  it('reads phases, stages, links and the optional PDF', () => {
    const roadmap = parseRoadmap({
      roadmapIntro: { vi: 'Ba giai đoạn', en: 'Three phases' },
      businessPhases: [
        phase('Giai đoạn 1, nền', [0, 3], [
          item('Đọc sổ tay mẫu', ['garden-notes'], [{ label: 'Docs', url: 'https://example.com/docs' }]),
        ]),
      ],
      itTitle: 'Second timeline',
      itStages: [{ months: null, study: 'Study', outcome: { vi: 'Sản phẩm', en: 'Deliverable' }, books: [], links: [] }],
      pdf: { href: '/roadmap.pdf', note: 'Costs' },
    });
    expect(roadmap).toEqual({
      roadmapIntro: { vi: 'Ba giai đoạn', en: 'Three phases' },
      businessPhases: [
        {
          name: 'Giai đoạn 1, nền',
          months: [0, 3],
          items: [
            { text: 'Đọc sổ tay mẫu', books: ['garden-notes'], links: [{ label: 'Docs', url: 'https://example.com/docs' }] },
          ],
        },
      ],
      itTitle: 'Second timeline',
      itStages: [{ months: null, study: 'Study', outcome: { vi: 'Sản phẩm', en: 'Deliverable' }, books: [], links: [] }],
      pdf: { href: '/roadmap.pdf', note: 'Costs' },
    });
  });

  it('leaves out what is malformed instead of failing', () => {
    const roadmap = parseRoadmap({
      businessPhases: [
        phase('No months', 'soon', [item('x')]),
        phase('', [0, 1], [item('x')]),
        phase('No items', [0, 1], []),
        phase('Kept', [1, 2], [
          item(''),
          item({ en: 'English only' }),
          item('Kept item', ['a', 7, ''], [
            { label: 'ok', url: 'https://example.com' },
            { label: 'script', url: 'javascript:alert(1)' },
            { label: '', url: 'https://example.com/2' },
            'nope',
          ]),
        ]),
        'nope',
      ],
      itStages: [{ study: 'No outcome' }, { study: 'S', outcome: 'O', months: [1] }],
      pdf: { href: 'https://example.com/a.pdf' },
    });
    expect(roadmap?.businessPhases).toEqual([
      { name: 'Kept', months: [1, 2], items: [{ text: 'Kept item', books: ['a'], links: [{ label: 'ok', url: 'https://example.com' }] }] },
    ]);
    expect(roadmap?.itStages).toEqual([{ months: null, study: 'S', outcome: 'O', books: [], links: [] }]);
    expect(roadmap?.roadmapIntro).toBe('');
    expect(roadmap?.pdf).toBeNull(); // only a same-origin path is linked
  });

  it('is null when nothing usable is left', () => {
    for (const json of [null, [], 'x', {}, { businessPhases: [] }, { businessPhases: [phase('P', [0, 1], [])] }]) {
      expect(parseRoadmap(json), JSON.stringify(json)).toBeNull();
    }
  });
});

describe('roadmapText', () => {
  it('picks the language, English falling back to the Vietnamese text', () => {
    expect(roadmapText('Một', 'en')).toBe('Một');
    expect(roadmapText({ vi: 'Một', en: 'One' }, 'en')).toBe('One');
    expect(roadmapText({ vi: 'Một', en: 'One' }, 'vi')).toBe('Một');
    expect(roadmapText({ vi: 'Một' }, 'en')).toBe('Một');
  });
});
