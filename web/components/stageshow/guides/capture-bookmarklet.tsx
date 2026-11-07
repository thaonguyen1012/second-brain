'use client';
import { BookmarkPlus, CheckCircle2, ChevronUp, Globe } from 'lucide-react';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import type { Point } from '../kit/measure';
import { Bar, Window } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import { GButton, GUIDE_SIZE } from './parts';
import './capture-bookmarklet.css';

// How to install and use the bookmarklet, played once (about 13 s). The screen is a browser window: first the
// Inbox page with its "Cách thu thập" help open (components/capture/bookmarklet-help.tsx), then any article,
// then the bookmarklet's popup, the real /inbox/them/ capture form (components/capture/capture-form.tsx) and its
// "Đã lưu vào inbox" state.
//
// Beats: Cmd+Shift+B shows the bookmarks bar; the "Lưu vào Brain" link is dragged onto it (open hand, grab, an
// insertion mark, the bookmark lands); the address bar takes an article's address and Enter loads it; the
// bookmark is clicked and the popup opens with the link and title filled in; Enter saves (the submit button has
// focus, as in the real form) and the form folds into "Đã lưu vào inbox". The poster is that last frame: the
// bookmark on the bar, the article, the popup saying it was saved.
//
// Built from the Stageshow gold `freeform-drag` (the carried object follows the hand from drag()'s onMove, a
// drop mark that never travels) and `hero-demo` (a second window coming forward over the first, keycaps for the
// keyboard beats), framed like the other page guides: one window a gutter from the top and sides, off the
// bottom. The article and its address are neutral examples (an .example domain).

type S = {
  /** The bookmarks bar is shown (Cmd+Shift+B) */
  bar: boolean;
  /** The dragged link: carried or not, and its top-left in stage px (kept after the drop so it fades in place) */
  carry: boolean;
  ghost: Point;
  /** The carried link is over the bookmarks bar: the insertion mark shows where it will land */
  over: boolean;
  /** The bookmark is on the bar */
  saved: boolean;
  /** The address bar: focused, its text selected (the click selects all), and what it shows */
  editing: boolean;
  selected: boolean;
  url: string;
  page: 'brain' | 'article';
  popup: boolean;
  pressed: boolean;
  /** The capture is saved: the form folds into "Đã lưu vào inbox" */
  done: boolean;
};

const BRAIN_URL = 'localhost:3000/inbox';
const ARTICLE_URL = 'tintuc.example/gia-vang';
const HEADLINE = 'Giá vàng hôm nay tăng mạnh';
const REST = { wide: { x: 470, y: 412 }, compact: { x: 300, y: 322 } };
const REST_END = { wide: { x: 168, y: 336 }, compact: { x: 200, y: 312 } };

// The other page guides' compact design is 358 x 470; a desktop window that tall would read as a phone, so this
// one is square and the browser runs off the right and the bottom (lazy.tsx has the matching placeholder)
const COMPACT = { below: 560, width: 358, height: 356 } as const;

const initial: S = {
  bar: false,
  carry: false,
  ghost: { x: 0, y: 0 },
  over: false,
  saved: false,
  editing: false,
  selected: false,
  url: BRAIN_URL,
  page: 'brain',
  popup: false,
  pressed: false,
  done: false,
};

const POSTER: S = { ...initial, bar: true, saved: true, url: ARTICLE_URL, page: 'article', popup: true, done: true };

async function script(a: Act<S>) {
  await a.wait(600);

  // 1. Cmd+Shift+B shows the bookmarks bar; the page moves down under it
  a.mark('bar');
  await a.key('cmd+shift+b');
  await a.set({ bar: true });
  await a.wait(900);

  // 2. The "Lưu vào Brain" link is dragged onto the bar. The link stays on the page (a drag copies a link); a
  // copy rides with the hand at the grab offset, and drops where the bookmark will sit
  a.mark('drag');
  const chip = a.rect('bm-source');
  const grab = { x: chip.x + chip.width * 0.42, y: chip.y + chip.height * 0.55 };
  const off = { x: grab.x - chip.x, y: grab.y - chip.y };
  await a.move(grab);
  await a.wait(200);
  const bar = a.rect('bm-bar');
  const slot = a.rect('bm-new');
  const land = { x: slot.x - 4, y: bar.y + (bar.height - chip.height) / 2 };
  await a.drag(
    { x: land.x + off.x, y: land.y + off.y },
    (p) => {
      const at = { x: p.x - off.x, y: p.y - off.y };
      // drag() has closed the hand before its first callback: pick up and move in that same frame
      a.put({ carry: true, ghost: at, over: at.y + chip.height / 2 < bar.y + bar.height });
    },
    { duration: 1200 },
  );
  await a.set({ carry: false, over: false, saved: true });
  await a.wait(800);

  // 3. Any page: the click selects the address, the new one is typed, Enter loads the article
  a.mark('article');
  await a.click({ at: 'address', x: 0.88, y: 0.5 });
  await a.set({ editing: true, selected: true });
  await a.wait(300);
  await a.set({ selected: false });
  await a.type('url', ARTICLE_URL, { interval: 26 });
  await a.wait(200);
  await a.key('enter');
  await a.set({ editing: false, page: 'article' });
  await a.wait(1100);

  // 4. The bookmark on the bar: the popup opens with the link and the title filled in, its button focused
  a.mark('popup');
  await a.click({ at: 'bm-new', x: 0.8, y: 0.6 });
  await a.set({ popup: true });
  await a.wait(1700);

  // 5. Enter saves; the form folds into the saved state, which holds
  a.mark('save');
  await a.key('enter');
  await a.set({ pressed: true });
  await a.wait(160);
  await a.set({ pressed: false, done: true });
  await a.move(REST_END);
  await a.wait(2400);
}

/** A bookmark already on the bar: favicon and name as placeholders. */
function FillerMark({ w }: { w: number }) {
  return (
    <span className="bm-mark" aria-hidden>
      <Bar w={12} h={12} r={3} tone={2} />
      <Bar w={w} h={6} tone={3} />
    </span>
  );
}

/** The "Lưu vào Brain" link of the Inbox help (bookmarklet-help.tsx): drawn for the page and for the dragged copy. */
function LinkChip(props: { className?: string; style?: React.CSSProperties } & Record<`data-${string}`, unknown>) {
  return (
    <span {...props} className={`bm-chip${props.className ? ` ${props.className}` : ''}`}>
      <BookmarkPlus size={13} strokeWidth={2} aria-hidden />
      Lưu vào Brain
    </span>
  );
}

function BrainPage({ show, compact }: { show: boolean; compact: boolean }) {
  return (
    <div className="bm-page" data-show={show || undefined}>
      <div className="bm-h1">Inbox</div>
      <div className="bm-desc" aria-hidden>
        <Bar w={compact ? 270 : 380} h={7} tone={2} />
        <Bar w={compact ? 180 : 250} h={7} tone={2} />
      </div>
      <div className="bm-toggle">
        Thu thập từ trình duyệt
        <ChevronUp size={14} strokeWidth={2} aria-hidden />
      </div>
      <div className="bm-help">
        <span className="bm-help__part">
          <span className="bm-help__lead">Bookmarklet:</span>
          <span>kéo nút</span>
          <LinkChip data-target="bm-source" data-cursor="open" />
        </span>
        <span>lên thanh dấu trang</span>
      </div>
      {/* "Thu thập nhanh", the tabs and the first entry below the help, as placeholders, off the bottom */}
      <div className="bm-card" aria-hidden>
        <Bar w={92} h={8} tone={3} />
        <span className="bm-card__box" />
      </div>
      <span className="bm-tabs" aria-hidden>
        <Bar w={44} h={8} tone={3} />
        <Bar w={52} h={8} tone={2} />
        <Bar w={48} h={8} tone={2} />
      </span>
      <div className="bm-card bm-card--entry" aria-hidden>
        <Bar w={60} h={8} tone={3} />
        <Bar w={220} h={9} tone={3} />
      </div>
    </div>
  );
}

function ArticlePage({ show, compact }: { show: boolean; compact: boolean }) {
  return (
    <div className="bm-page" data-show={show || undefined}>
      <div className="bm-site" aria-hidden>
        <Bar w={64} h={8} tone={4} />
        <Bar w={40} h={6} tone={2} />
      </div>
      <div className="bm-h1 bm-headline">{HEADLINE}</div>
      <div className="bm-lines" aria-hidden>
        <Bar w={compact ? 290 : 480} h={7} tone={2} />
        <Bar w={compact ? 268 : 452} h={7} tone={2} />
        <Bar w={compact ? 180 : 300} h={7} tone={2} />
      </div>
      <span className="bm-figure" aria-hidden />
      <div className="bm-lines" aria-hidden>
        <Bar w={compact ? 284 : 470} h={7} tone={2} />
        <Bar w={compact ? 236 : 410} h={7} tone={2} />
      </div>
    </div>
  );
}

const LABEL =
  'Hình minh họa cách cài và dùng bookmarklet: nhấn Cmd+Shift+B để hiện thanh dấu trang, kéo nút Lưu vào Brain ' +
  'ở trang Inbox lên thanh đó. Sau đó, ở một trang bất kỳ, bấm Lưu vào Brain trên thanh dấu trang: một cửa sổ nhỏ ' +
  'mở ra với link và tiêu đề đã điền sẵn; nhấn Enter để lưu vào inbox.';

export default function CaptureBookmarkletGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  return (
    <div role="img" aria-label={LABEL} className={className}>
      <Stage
        width={GUIDE_SIZE.width}
        height={GUIDE_SIZE.height}
        compact={COMPACT}
        initial={initial}
        poster={POSTER}
        script={script}
        play="once"
        keys={{ wide: 'bottom-left', compact: 'top' }}
        cursor={{ at: REST, style: 'arrow' }}
        className="ssg-brain ssg-bm"
        {...look}
      >
        {(s, rect, layout) => {
          const compact = layout === 'compact';
          const mark = rect('bm-new');
          const barRect = rect('bm-bar');
          return (
            <>
              <Window
                nav
                url={
                  <span
                    className="bm-url"
                    data-target="address"
                    data-cursor="ibeam"
                    data-editing={s.editing || undefined}
                  >
                    <span className="bm-url__text" data-selected={s.selected || undefined}>
                      {s.url}
                    </span>
                    {s.editing && !s.selected && <span className="bm-url__caret" aria-hidden />}
                  </span>
                }
                className="bm-browser"
              >
                <Collapse open={s.bar}>
                  <div className="bm-bar" data-target="bm-bar">
                    <FillerMark w={44} />
                    {!compact && <FillerMark w={58} />}
                    <span
                      className="bm-mark bm-mark--new"
                      data-target="bm-new"
                      data-cursor="pointer"
                      data-show={s.saved || undefined}
                    >
                      <Globe size={12} strokeWidth={2} aria-hidden />
                      Lưu vào Brain
                    </span>
                  </div>
                </Collapse>
                <div className="bm-pages">
                  <BrainPage show={s.page === 'brain'} compact={compact} />
                  <ArticlePage show={s.page === 'article'} compact={compact} />
                </div>
              </Window>

              {/* Where the dragged link will land: a mark in the bar that only fades, never travels */}
              <span
                className="bm-insert"
                data-show={(s.over && !s.saved) || undefined}
                style={{ left: mark.x - 7, top: barRect.y + (barRect.height - 16) / 2 }}
              />
              <LinkChip
                className="bm-ghost"
                data-carry={s.carry || undefined}
                style={{ translate: `${s.ghost.x}px ${s.ghost.y}px` }}
              />

              <Window url="localhost:3000/inbox/them/?url=…" className="bm-popup" data-show={s.popup || undefined}>
                <div className="bm-form">
                  <div className="bm-form__title">Thêm vào Inbox</div>
                  <Collapse open={!s.done}>
                    <div className="bm-form__fields">
                      {/* Filled from the bookmarklet's ?url=&title= (lib/capture.ts draftFromParams) */}
                      <Field className="g-field bm-field" label="Link" value={`https://${ARTICLE_URL}`} />
                      <Field className="g-field bm-field" label="Ghi chú kèm theo" value={HEADLINE} />
                      <div className="bm-form__foot">
                        <span className="bm-form__hint">⌘↵ để lưu</span>
                        <span
                          className="g-button bm-save"
                          data-focus={!s.done || undefined}
                          data-pressed={s.pressed || undefined}
                        >
                          Lưu vào inbox
                        </span>
                      </div>
                    </div>
                  </Collapse>
                  <Collapse open={s.done} reveal="drop">
                    <div className="bm-saved">
                      <span className="bm-saved__title">
                        <CheckCircle2 size={16} strokeWidth={2} aria-hidden />
                        Đã lưu vào inbox
                      </span>
                      <span className="bm-saved__url">https://{ARTICLE_URL}</span>
                      <span className="g-actions bm-saved__actions">
                        <GButton size="sm">Đóng</GButton>
                        <GButton size="sm" variant="outline">
                          Mở Inbox
                        </GButton>
                      </span>
                    </div>
                  </Collapse>
                </div>
              </Window>
            </>
          );
        }}
      </Stage>
    </div>
  );
}
