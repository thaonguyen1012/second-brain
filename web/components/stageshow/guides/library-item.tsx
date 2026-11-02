'use client';
import { useState } from 'react';
import { Library, NotebookPen, Pencil, Plus, Sparkles } from 'lucide-react';
import { formatDay, todayPrague } from '@/lib/dates';
import { Collapse, Field, Stage, Swap, type Act } from '../kit';
import { useBrainLook } from '../brain-look';
import { GBadge, GButton, GDialog, GRow, GScrim, GSelect, GUIDE_SIZE } from './parts';
import './library-item.css';

// An Item's life in the library, played once (about 12 s). The screen is the real Thư viện page
// (components/brain/library-page.tsx, item-dialog.tsx, library/done-output.tsx, library/note-dialog.tsx)
// simplified: the filters and "Thêm item", the item dialog, the ItemCard, its "chưa có đầu ra" reminder and
// the note dialog with the book template.
//
// Beats: a book is added; "Xong" marks it finished and the card asks for its output (DECISIONS 4.2: done needs
// a note); "Viết ghi chú" opens a note already titled and templated, a highlight is written, the note is
// created and the reminder leaves. The poster is the reminder frame: it tells the rule on its own.
//
// Built from the Stageshow gold `stacked-cards` (the page's pieces in one column) with `form-error` (the
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
const LINE = 'Thói quen nhỏ, lặp lại mỗi ngày';
const REST = { wide: { x: 560, y: 425 }, compact: { x: 330, y: 445 } };

const initial: S = { dialog: null, title: '', added: false, done: false, noted: false, line: '', notice: '' };
const POSTER: S = { ...initial, title: BOOK, added: true, done: true, notice: 'added' };

async function script(a: Act<S>) {
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
  await a.type('line', LINE, { interval: 25 });
  await a.wait(300);
  await a.click('save-note');
  await a.set({ dialog: null });
  await a.wait(150);
  await a.set({ noted: true, notice: 'noted' });
  await a.move(REST);
  await a.wait(2200);
}

const LABEL =
  'Hình minh họa trang Thư viện: bấm Thêm item, nhập tên một cuốn sách rồi lưu; thẻ mới hiện trong thư viện. ' +
  'Bấm Xong khi đọc xong: thẻ nhắc "Xong rồi, nhưng chưa có đầu ra" và đề nghị ghi highlights và 3 ý chính. ' +
  'Bấm Viết ghi chú, viết vài dòng rồi Tạo ghi chú: lời nhắc biến mất.';

export default function LibraryItemGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  const [today] = useState(() => formatDay(todayPrague()));
  return (
    <div role="img" aria-label={LABEL} className={className}>
      <Stage
        width={GUIDE_SIZE.width}
        height={GUIDE_SIZE.height}
        compact={GUIDE_SIZE.compact}
        initial={initial}
        poster={POSTER}
        script={script}
        play="once"
        keys="bottom"
        cursor={{ at: REST, style: 'arrow' }}
        className="ssg-brain ssg-lib"
        {...look}
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact';
          const status = s.done ? 'Xong' : 'Đang làm';
          return (
            <>
              <div className="g-col lb-col">
                <div className="lb-toolbar">
                  <GSelect value="Mọi loại" className="lb-filter" />
                  <GSelect value="Mọi trạng thái" className="lb-filter" />
                  <GButton icon={Plus} name="add-item" className="lb-new">
                    {compact ? 'Thêm' : 'Thêm item'}
                  </GButton>
                </div>

                <Collapse open={s.notice !== ''}>
                  <div className="lb-notice">
                    <Swap id={s.notice}>
                      {s.notice === 'noted' ? `Đã tạo ghi chú "${BOOK}"` : `Đã thêm "${BOOK}"`}
                    </Swap>
                  </div>
                </Collapse>

                <Collapse open={!s.added}>
                  <div className="lb-empty">
                    <span className="lb-empty__icon">
                      <Library size={16} strokeWidth={2} aria-hidden />
                    </span>
                    <span className="lb-empty__title">Chưa có item nào</span>
                    <span className="g-desc">Thêm sách, phim, khóa học, bài viết hoặc dự án. Mục từ inbox cũng có thể thành item.</span>
                  </div>
                </Collapse>

                <Collapse open={s.added} reveal="drop">
                  <div className="g-brain">
                    <div className="g-brain__panel">
                      <span className="g-brain__badges">
                        <Swap id={status} className="lb-status">
                          <GBadge tone={s.done ? 'success' : 'info'}>{status}</GBadge>
                        </Swap>
                        <GBadge tone="secondary">Sách</GBadge>
                      </span>
                      <span className="g-brain__title">{BOOK}</span>
                      <Swap id={s.done ? 'done' : 'active'} className="lb-meta">
                        {s.done ? `bắt đầu ${today} · xong ${today}` : `bắt đầu ${today}`}
                      </Swap>
                    </div>
                    <div className="g-brain__body">
                      <Collapse open={s.done && !s.noted}>
                        <div className="lb-hint">
                          <span className="lb-hint__text">
                            <Sparkles size={13} strokeWidth={2} aria-hidden />
                            <span>
                              <b>Xong rồi, nhưng chưa có đầu ra.</b> <span className="lb-muted">Ghi highlights và 3 ý chính.</span>
                            </span>
                          </span>
                          <GButton size="xs" variant="outline" icon={NotebookPen} name="write-note">
                            Viết ghi chú
                          </GButton>
                        </div>
                      </Collapse>
                      <span className="g-actions">
                        <span className="lb-step" data-gone={s.done || undefined}>
                          <GButton size="xs" name="done">
                            Xong
                          </GButton>
                        </span>
                        <GButton size="xs" variant="outline" icon={Pencil}>
                          Sửa
                        </GButton>
                        <GButton size="xs" variant="ghost" icon={NotebookPen}>
                          Ghi chú
                        </GButton>
                      </span>
                    </div>
                  </div>
                </Collapse>
              </div>

              <GScrim show={s.dialog !== null} />
              <GDialog
                show={s.dialog === 'item'}
                className="lb-dialog"
                title="Thêm item"
                foot={
                  <>
                    <GButton variant="ghost">Hủy</GButton>
                    <GButton name="save-item">Thêm vào thư viện</GButton>
                  </>
                }
              >
                <Field className="g-field" label="Tiêu đề" value={s.title} focused={s.dialog === 'item'} />
                <div className="lb-pair">
                  <GRow label="Loại">
                    <GSelect value="Sách" />
                  </GRow>
                  <GRow label="Trạng thái">
                    <GSelect value="Đang làm" />
                  </GRow>
                </div>
              </GDialog>

              <GDialog
                show={s.dialog === 'note'}
                className="lb-dialog"
                title="Ghi chú mới"
                desc={`Đầu ra cho: ${BOOK}`}
                foot={
                  <>
                    <GButton variant="ghost">Hủy</GButton>
                    <GButton name="save-note">Tạo ghi chú</GButton>
                  </>
                }
              >
                <GRow label="Tiêu đề (không bắt buộc)">
                  <span className="g-box">{BOOK}</span>
                </GRow>
                <GRow label="Nội dung (markdown)">
                  <span className="g-box lb-md" data-focused={s.dialog === 'note' || undefined}>
                    <span>## Highlights</span>
                    <span>
                      - {s.line}
                      {s.dialog === 'note' && <span className="lb-caret" />}
                    </span>
                    <span>## 3 ý chính</span>
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
