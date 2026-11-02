'use client';
import { Inbox, Loader2 } from 'lucide-react';
import { Bar, Collapse, Field, Popover, Stage, Swap, Text, type Act } from '../kit';
import { useBrainLook } from '../brain-look';
import './inbox-triage.css';

// How the Inbox works, as a 15 s loop: a link is captured, its card unfurls with a thumbnail, AI tags and a
// suggested destination (the background job's result, time compressed), Esc leaves the capture box, then the
// keyboard triages the list down to zero (j/k move, l = đọc sau,
// a = lưu trữ, o = bằng chứng cho cơ hội). The screen is the real Inbox page (components/brain/inbox-page.tsx)
// simplified: the capture box, the key legend, BrainCards, the opportunity dialog and the empty state.
//
// Built from the Stageshow gold `stacked-cards` (one column of components at one width, centered on the
// well, the list running off the bottom) with the motion of `gmail` (a card folding out of its list) and
// the keycaps of `raycast`. No cursor: triage is keyboard only, so the keys are the story.
//
// Loop seam: the story empties the list; two new entries then drop in as new arrivals (the inbox filling
// again), which is the opening frame. The captured card is reset while folded away (a.snap).

type Legend = 'jk' | 'l' | 'a' | 'o' | null;

type S = {
  typed: string;
  focused: boolean;
  saving: boolean;
  /** The captured entry is in the list; `ready` once the background job has unfurled and tagged it */
  n: boolean;
  ready: boolean;
  /** The two entries that were already in the inbox */
  a: boolean;
  b: boolean;
  sel: 'n' | 'a' | 'b' | null;
  legend: Legend;
  dialog: boolean;
  pick: boolean;
  empty: boolean;
};

const LINK = 'https://nextjs.org/learn';

const initial: S = {
  typed: '',
  focused: false,
  saving: false,
  n: false,
  ready: false,
  a: true,
  b: true,
  sel: 'a',
  legend: null,
  dialog: false,
  pick: false,
  empty: false,
};

// The still for thumbnails and reduced motion: the unfurled, selected card under the key legend
const POSTER: S = { ...initial, n: true, ready: true, sel: 'n' };

/** The key help row of the Inbox page (inbox-page.tsx keyHelp), the keys this guide presses. */
const LEGEND: { id: Exclude<Legend, null>; key: string; label: string }[] = [
  { id: 'jk', key: 'J / K', label: 'xuống / lên' },
  { id: 'l', key: 'L', label: 'đọc sau' },
  { id: 'a', key: 'A', label: 'lưu trữ' },
  { id: 'o', key: 'O', label: 'bằng chứng cho cơ hội' },
];

async function script(a: Act<S>) {
  await a.wait(500);

  // 1. Capture: the link is pasted into "Thu thập nhanh" and saved with Cmd+Enter
  a.mark('capture');
  await a.set({ focused: true });
  await a.wait(250);
  await a.type('typed', LINK);
  await a.wait(350);
  await a.key('cmd+enter');
  await a.set({ saving: true });
  await a.wait(220);
  // The entry lands on top of the list and takes the keyboard cursor; the box empties but keeps focus
  await a.set({ saving: false, typed: '', n: true, sel: 'n' });
  await a.wait(1300);

  // 2. The background job unfurls it: thumbnail, page title, AI tags and a suggested destination
  a.mark('unfurl');
  await a.set({ ready: true });
  await a.wait(1700);

  // 3. Esc leaves the capture box (single keys are ignored while typing), then one key per decision:
  // j down, l = đọc sau (the card leaves, the cursor stays in place), k back up
  a.mark('triage');
  await a.key('esc');
  await a.set({ focused: false });
  await a.wait(450);
  await a.key('j');
  await a.set({ legend: 'jk', sel: 'a' });
  await a.wait(800);
  await a.key('l');
  await a.set({ legend: 'l', a: false, sel: 'b' });
  await a.wait(1000);
  await a.key('k');
  await a.set({ legend: 'jk', sel: 'n' });
  await a.wait(700);

  // 4. o: evidence for an opportunity, as the AI suggested; 1 = ủng hộ the first one
  a.mark('opportunity');
  await a.key('o');
  await a.set({ legend: 'o', dialog: true });
  await a.wait(1400);
  await a.key('1');
  await a.set({ pick: true });
  await a.wait(260);
  await a.set({ dialog: false, legend: null });
  await a.wait(220);
  await a.set({ n: false, sel: 'b' });
  await a.wait(1000);

  // 5. a = lưu trữ the last one: inbox zero, the payoff, held
  a.mark('zero');
  await a.key('a');
  await a.set({ legend: 'a', b: false, sel: null, empty: true });
  await a.wait(900);
  await a.set({ legend: null });
  await a.wait(1500);

  // Reset: the captured card is folded away, so it resets unseen; new entries arrive and the loop reopens
  await a.snap({ ready: false, pick: false });
  await a.set({ empty: false, a: true, b: true, sel: 'a' });
  await a.wait(900);
}

function Badge({ tone, children }: { tone: 'warning' | 'secondary' | 'outline'; children: React.ReactNode }) {
  return (
    <span className="ib-badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** The captured entry, as a BrainCard: header panel (thumbnail, badges, title, meta), then its tags. */
function CapturedCard({ s }: { s: S }) {
  return (
    <article className="ib-card" data-selected={s.sel === 'n' || undefined}>
      <div className="ib-panel">
        <span className="ib-thumb" data-show={s.ready || undefined} aria-hidden>
          <span className="ib-thumb__art">
            <span className="ib-thumb__line" style={{ width: 26 }} />
            <span className="ib-thumb__line" data-faint style={{ width: 34 }} />
          </span>
        </span>
        <div className="ib-head">
          <div className="ib-badges">
            <Badge tone="warning">Inbox</Badge>
            <Swap id={s.ready ? 'ready' : 'busy'} className="ib-swap">
              {s.ready ? (
                <Badge tone="outline">→ Bằng chứng cho cơ hội</Badge>
              ) : (
                <Badge tone="secondary">
                  <Loader2 className="ib-spin" size={12} strokeWidth={2} aria-hidden />
                  Đang xử lý
                </Badge>
              )}
            </Swap>
          </div>
          <Swap id={s.ready ? 'ready' : 'busy'} className="ib-title">
            {s.ready ? 'Learn Next.js' : LINK}
          </Swap>
          <Text className="ib-meta">nextjs.org · 2/11/2026</Text>
        </div>
      </div>
      <Collapse open={s.ready}>
        <div className="ib-tags">
          <Badge tone="outline">#nextjs</Badge>
          <Badge tone="outline">#hoc-lap-trinh</Badge>
        </div>
      </Collapse>
    </article>
  );
}

/** An entry that is not the story: the same card in placeholder lines. */
function FillerCard({ selected, title, meta }: { selected: boolean; title: number; meta: number }) {
  return (
    <article className="ib-card" data-selected={selected || undefined}>
      <div className="ib-panel">
        <Bar w={44} h={44} r={12} tone={3} className="ib-fthumb" />
        <div className="ib-head ib-head--filler">
          <Bar w={40} h={14} r={5} tone={3} />
          <Bar w={title} h={8} r={3} tone={5} />
          <Bar w={meta} h={6} r={3} tone={3} />
        </div>
      </div>
    </article>
  );
}

const LABEL =
  'Hình minh họa cách dùng Inbox: dán một link vào ô Thu thập nhanh rồi nhấn Cmd+Enter; thẻ mới hiện ảnh thu nhỏ, ' +
  'tag do AI gợi ý và nơi nên chuyển tới. Nhấn Esc để rời ô nhập, rồi dùng phím: J và K để xuống và lên, L để đọc sau, A để lưu trữ, ' +
  'O để gắn làm bằng chứng cho một cơ hội, cho tới khi inbox về 0.';

export default function InboxTriageGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  return (
    <div role="img" aria-label={LABEL} className={className}>
      <Stage
        width={600}
        height={452}
        compact={{ below: 560, width: 358, height: 470 }}
        initial={initial}
        poster={POSTER}
        script={script}
        keys="bottom"
        className="ssg-inbox"
        {...look}
      >
        {(s) => (
          <>
            <div className="ib-col">
              <section className="ib-capture">
                <Field
                  className="ib-field"
                  label="Thu thập nhanh"
                  value={s.typed}
                  focused={s.focused}
                  placeholder="Dán một link hoặc ghi một ý tưởng…"
                />
                <div className="ib-capture__foot">
                  <Text filler w={150} className="ib-hint-text">
                    tag và tóm tắt được thêm sau, trong nền
                  </Text>
                  <span className="ib-button" data-off={(!s.typed && !s.saving) || undefined} data-pressed={s.saving || undefined}>
                    Lưu vào inbox
                  </span>
                </div>
              </section>

              <div className="ib-legend">
                {LEGEND.map((h) => (
                  <span key={h.id} className="ib-legend__item" data-on={s.legend === h.id || undefined}>
                    <span className="ib-kbd">{h.key}</span>
                    <Text>{h.label}</Text>
                  </span>
                ))}
              </div>

              <div className="ib-list">
                <Collapse open={s.n} reveal="drop">
                  <div className="ib-gap">
                    <CapturedCard s={s} />
                  </div>
                </Collapse>
                <Collapse open={s.a} reveal="drop">
                  <div className="ib-gap">
                    <FillerCard selected={s.sel === 'a'} title={168} meta={92} />
                  </div>
                </Collapse>
                <Collapse open={s.b} reveal="drop">
                  <div className="ib-gap">
                    <FillerCard selected={s.sel === 'b'} title={132} meta={104} />
                  </div>
                </Collapse>
                <Collapse open={s.empty} reveal="drop">
                  <div className="ib-empty">
                    <span className="ib-empty__icon">
                      <Inbox size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <Text className="ib-empty__title">Inbox đã về 0</Text>
                    <Text filler w={176} className="ib-empty__text">
                      Mọi thứ đã được xử lý.
                    </Text>
                  </div>
                </Collapse>
              </div>
            </div>

            {/* The opportunity picker is a modal dialog over a soft backdrop, as in opportunity-dialog.tsx */}
            <div className="ib-scrim" data-show={s.dialog || undefined} />
            <Popover show={s.dialog} origin="center" className="ib-dialog">
              <Text className="ib-dialog__title">Bằng chứng cho cơ hội nào?</Text>
              <Text className="ib-dialog__desc">Learn Next.js</Text>
              <div className="ib-dialog__list">
                <div className="ib-opp">
                  <span className="ib-kbd" data-on={s.pick || undefined}>
                    1
                  </span>
                  <Text className="ib-opp__title">Khóa học Next.js tiếng Việt</Text>
                  <span className="ib-button ib-button--xs" data-pressed={s.pick || undefined}>
                    Ủng hộ
                  </span>
                </div>
                <div className="ib-opp">
                  <span className="ib-kbd">2</span>
                  <Bar w={150} h={7} r={3} tone={3} />
                </div>
              </div>
            </Popover>
          </>
        )}
      </Stage>
    </div>
  );
}
