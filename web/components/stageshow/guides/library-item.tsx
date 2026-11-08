'use client';
import { useCallback, useState } from 'react';
import { CircleAlert, NotebookPen, Pencil, Plus } from 'lucide-react';
import { formatDay, todayPrague } from '@/lib/dates';
import { useT } from '@/lib/i18n/client';
import { guides } from '@/lib/i18n/en/guides';
import { msg, type T } from '@/lib/i18n/translate';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Bar } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { Swap } from '../kit/motion/Swap';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import { GBadge, GButton, GDialog, GRow, GScrim, GSelect, GUIDE_SIZE } from './parts';
import './library-item.css';

// An Item's life in the library, played once (about 12 s). The screen is the real Thư viện page
// (components/brain/library-page.tsx, item-dialog.tsx, library/done-output.tsx, library/note-dialog.tsx)
// simplified: the filters and "Thêm item", the item dialog, the ItemCard, its "chưa có đầu ra" reminder and
// the note dialog with the book template. The library's other items are placeholder cards under the new one
// (the list is newest first), so the list runs off the bottom on every frame.
//
// Beats: a book is added; "Xong" marks it finished and the card asks for its output (DECISIONS 4.2: done needs
// a note); "Viết ghi chú" opens a note already titled and templated, a highlight is written, the note is
// created and the reminder leaves. The poster is the reminder frame: it tells the rule on its own.
//
// Built from the Stageshow gold `stacked-cards` (the page's pieces in one column pinned a gutter from the top,
// the list off the bottom) with `form-error` (the
// message on the thing that caused it, cleared by fixing it; play once). The book is a neutral example.

type S = {
  dialog: 'item' | 'note' | null;
  title: string;
  added: boolean;
  done: boolean;
  noted: boolean;
  line: string;
  notice: '' | 'added' | 'noted';
};

const BOOK = 'Atomic Habits';
const LINE = msg('Thói quen nhỏ, lặp lại mỗi ngày');
const REST = { wide: { x: 560, y: 425 }, compact: { x: 330, y: 445 } };

const initial: S = { dialog: null, title: '', added: false, done: false, noted: false, line: '', notice: '' };
const POSTER: S = { ...initial, title: BOOK, added: true, done: true, notice: 'added' };

async function script(a: Act<S>, t: T) {
  await a.wait(500);

  // 1. Thêm item: a book, being read
  a.mark('add');
  await a.click('add-item');
  await a.set({ dialog: 'item' });
  await a.wait(300);
  await a.type('title', BOOK, { interval: 40 });
  await a.wait(300);
  await a.click('save-item');
  await a.set({ dialog: null });
  await a.wait(120);
  await a.set({ added: true, notice: 'added' });
  await a.wait(1000);

  // 2. Xong: finished, but a done item still needs its output
  a.mark('done');
  await a.click('done');
  await a.set({ done: true });
  await a.wait(1700);

  // 3. Viết ghi chú: the note opens titled and with the book template; one highlight, then Tạo ghi chú
  a.mark('note');
  await a.click('write-note');
  await a.set({ dialog: 'note' });
  await a.wait(350);
  await a.type('line', t(LINE), { interval: 25 });
  await a.wait(300);
  await a.click('save-note');
  await a.set({ dialog: null });
  await a.wait(150);
  await a.set({ noted: true, notice: 'noted' });
  await a.move(REST);
  await a.wait(2200);
}

/** Another item of the library, as placeholders: badges, title, dates and its actions. */
function FillerItem({ title, meta }: { title: number; meta: number }) {
  return (
    <div className="g-brain lb-filler" aria-hidden>
      <div className="g-brain__panel">
        <span className="g-brain__badges">
          <Bar w={54} h={18} r={6} tone={2} />
          <Bar w={38} h={18} r={6} tone={2} />
        </span>
        <Bar w={title} h={9} r={3} tone={3} />
        <Bar w={meta} h={6} tone={2} />
      </div>
      <div className="g-brain__body">
        <span className="g-actions">
          <Bar w={46} h={24} r={7} tone={1} />
          <Bar w={52} h={24} r={7} tone={1} />
        </span>
      </div>
    </div>
  );
}

const LABEL = msg(
  'Hình minh họa trang Thư viện: bấm Thêm item, nhập tên một cuốn sách rồi lưu; thẻ mới hiện trong thư viện. Bấm Xong khi đọc xong: thẻ nhắc "Xong rồi, nhưng chưa có đầu ra" và đề nghị ghi highlights và 3 ý chính. Bấm Viết ghi chú, viết vài dòng rồi Tạo ghi chú: lời nhắc biến mất.',
);

export default function LibraryItemGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  const t = useT(guides);
  const [today] = useState(() => formatDay(todayPrague()));
  // Typed text in the page's language, kept stable (a new script would restart the scene)
  const run = useCallback((a: Act<S>) => script(a, t), [t]);
  return (
    <div role="img" aria-label={t(LABEL)} className={className}>
      <Stage
        width={GUIDE_SIZE.width}
        height={GUIDE_SIZE.height}
        compact={GUIDE_SIZE.compact}
        initial={initial}
        poster={POSTER}
        script={run}
        play="once"
        keys="bottom"
        cursor={{ at: REST, style: 'arrow' }}
        className="ssg-brain ssg-lib"
        {...look}
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact';
          const status = s.done ? t('Xong') : t('Đang làm');
          return (
            <>
              <div className="g-col lb-col">
                <div className="lb-toolbar">
                  <GSelect value={t('Mọi loại')} className="lb-filter" />
                  <GSelect value={t('Mọi trạng thái')} className="lb-filter" />
                  <GButton icon={Plus} name="add-item" className="lb-new">
                    {compact ? t('Thêm') : t('Thêm item')}
                  </GButton>
                </div>

                <Collapse open={s.notice !== ''}>
                  <div className="lb-notice">
                    <Swap id={s.notice}>
                      {s.notice === 'noted'
                        ? t('Đã tạo ghi chú "{title}"', { title: BOOK })
                        : t('Đã thêm "{title}"', { title: BOOK })}
                    </Swap>
                  </div>
                </Collapse>

                <div className="lb-list">
                  <Collapse open={s.added} reveal="drop">
                    <div className="lb-slot">
                      <div className="g-brain">
                        <div className="g-brain__panel">
                          <span className="g-brain__badges">
                            <Swap id={status} className="lb-status">
                              <GBadge tone={s.done ? 'success' : 'info'}>{status}</GBadge>
                            </Swap>
                            <GBadge tone="secondary">{t('Sách')}</GBadge>
                          </span>
                          <span className="g-brain__title">{BOOK}</span>
                          <Swap id={s.done ? 'done' : 'active'} className="lb-meta">
                            {s.done
                              ? `${t('bắt đầu {date}', { date: today })} · ${t('xong {date}', { date: today })}`
                              : t('bắt đầu {date}', { date: today })}
                          </Swap>
                        </div>
                        <div className="g-brain__body">
                          <Collapse open={s.done && !s.noted}>
                            <div className="lb-hint">
                              <span className="lb-hint__text">
                                <CircleAlert size={13} strokeWidth={2} aria-hidden />
                                <span>
                                  <b>{t('Xong rồi, nhưng chưa có đầu ra.')}</b>{' '}
                                  <span className="lb-muted">{t('Ghi highlights và 3 ý chính.')}</span>
                                </span>
                              </span>
                              <GButton size="xs" variant="outline" icon={NotebookPen} name="write-note">
                                {t('Viết ghi chú')}
                              </GButton>
                            </div>
                          </Collapse>
                          <span className="g-actions">
                            <span className="lb-step" data-gone={s.done || undefined}>
                              <GButton size="xs" name="done">
                                {t('Xong')}
                              </GButton>
                            </span>
                            <GButton size="xs" variant="outline" icon={Pencil}>
                              {t('Sửa')}
                            </GButton>
                            <GButton size="xs" variant="ghost" icon={NotebookPen}>
                              {t('Ghi chú')}
                            </GButton>
                          </span>
                        </div>
                      </div>
                    </div>
                  </Collapse>
                  <FillerItem title={200} meta={120} />
                  <FillerItem title={150} meta={96} />
                  <FillerItem title={180} meta={110} />
                </div>
              </div>

              <GScrim show={s.dialog !== null} />
              <GDialog
                show={s.dialog === 'item'}
                className="lb-dialog"
                title={t('Thêm item')}
                foot={
                  <>
                    <GButton variant="ghost">{t('Hủy')}</GButton>
                    <GButton name="save-item">{t('Thêm vào thư viện')}</GButton>
                  </>
                }
              >
                <Field className="g-field" label={t('Tiêu đề')} value={s.title} focused={s.dialog === 'item'} />
                <div className="lb-pair">
                  <GRow label={t('Loại')}>
                    <GSelect value={t('Sách')} />
                  </GRow>
                  <GRow label={t('Trạng thái')}>
                    <GSelect value={t('Đang làm')} />
                  </GRow>
                </div>
              </GDialog>

              <GDialog
                show={s.dialog === 'note'}
                className="lb-dialog"
                title={t('Ghi chú mới')}
                desc={t('Đầu ra cho: {title}', { title: BOOK })}
                foot={
                  <>
                    <GButton variant="ghost">{t('Hủy')}</GButton>
                    <GButton name="save-note">{t('Tạo ghi chú')}</GButton>
                  </>
                }
              >
                <GRow label={t('Tiêu đề (không bắt buộc)')}>
                  <span className="g-box">{BOOK}</span>
                </GRow>
                <GRow label={t('Nội dung (markdown)')}>
                  <span className="g-box lb-md" data-focused={s.dialog === 'note' || undefined}>
                    <span>## Highlights</span>
                    <span>
                      - {s.line}
                      {s.dialog === 'note' && <span className="lb-caret" />}
                    </span>
                    <span>{t('## 3 ý chính')}</span>
                    <span>1.</span>
                  </span>
                </GRow>
              </GDialog>
            </>
          );
        }}
      </Stage>
    </div>
  );
}
