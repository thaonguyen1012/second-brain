'use client';
import { Inbox, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { guides } from '@/lib/i18n/en/guides';
import { msg, type Msg } from '@/lib/i18n/translate';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Bar, Text } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { Popover } from '../kit/motion/Popover';
import { Swap } from '../kit/motion/Swap';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import './inbox-triage.css';

// How the Inbox works, as a 16 s loop: a link is captured, its card unfurls with a thumbnail, AI tags and a
// suggested destination (the background job's result, time compressed), Esc leaves the capture box, then the
// keyboard triages the list down to zero (o = bằng chứng cho cơ hội, as suggested; j/k move, l = đọc sau,
// a = lưu trữ). The screen is the real Inbox page (components/brain/inbox-page.tsx) simplified: the capture box,
// the key legend, BrainCards, the opportunity dialog and the empty state.
//
// Built from the Stageshow gold `stacked-cards` (one column of components at one width, centered on the
// well, the list running off the bottom) with the motion of `gmail` (a card folding out of its list), the
// keycaps of `raycast` and the foot of `fade-crop`: the column fades out above a band kept clear for the
// keycaps, so they never land on a card's edge. No cursor: triage is keyboard only, so the keys are the story.
// Every entry the keys act on has a short real title (neutral examples); only thumbnails and dates are
// placeholders. The selected entry always sits above the fade.
//
// Loop seam: the story empties the list; three entries then drop in as new arrivals (the inbox filling
// again), which is the opening frame. The captured card is reset while folded away (a.snap).

type Legend = 'jk' | 'l' | 'a' | 'o' | null;

type S = {
  typed: string;
  focused: boolean;
  saving: boolean;
  /** The captured entry is in the list; `ready` once the background job has unfurled and tagged it */
  n: boolean;
  ready: boolean;
  /** The three entries that were already in the inbox */
  a: boolean;
  b: boolean;
  c: boolean;
  sel: 'n' | 'a' | 'b' | 'c' | null;
  legend: Legend;
  dialog: boolean;
  pick: boolean;
  empty: boolean;
};

const LINK = 'https://nextjs.org/learn';

/** The entries already in the inbox: one line of title and one of meta each (a domain, or a date for a note) */
const ENTRIES = {
  a: { title: msg('CSS Grid: hướng dẫn đầy đủ'), meta: 'developer.mozilla.org', thumb: true },
  b: { title: msg('Mẹo tập trung khi làm việc'), meta: 'dev.to', thumb: true },
  c: { title: msg('Ý tưởng: email nhắc trả tiền'), meta: null, thumb: false },
} as const;

const initial: S = {
  typed: '',
  focused: false,
  saving: false,
  n: false,
  ready: false,
  a: true,
  b: true,
  c: true,
  sel: 'a',
  legend: null,
  dialog: false,
  pick: false,
  empty: false,
};

// The still for thumbnails and reduced motion: the unfurled, selected card under the key legend
const POSTER: S = { ...initial, n: true, ready: true, sel: 'n' };

/** The key help row of the Inbox page (inbox-page.tsx keyHelp), the keys this guide presses. */
const LEGEND: { id: Exclude<Legend, null>; key: string; label: Msg }[] = [
  { id: 'jk', key: 'J / K', label: msg('xuống / lên') },
  { id: 'l', key: 'L', label: msg('đọc sau') },
  { id: 'a', key: 'A', label: msg('lưu trữ') },
  // The guide's own, shorter English: the row has a fixed width (lib/i18n/en/guides.ts)
  { id: 'o', key: 'O', label: msg('bằng chứng cho cơ hội', 'guide') },
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

  // 3. Esc leaves the capture box (single keys are ignored while typing); o: evidence for an opportunity, as
  // the AI suggested; 1 = ủng hộ the first one. The card leaves and the next entry takes the cursor
  a.mark('opportunity');
  await a.key('esc');
  await a.set({ focused: false });
  await a.wait(450);
  await a.key('o');
  await a.set({ legend: 'o', dialog: true });
  await a.wait(1400);
  await a.key('1');
  await a.set({ pick: true });
  await a.wait(260);
  await a.set({ dialog: false, legend: null });
  await a.wait(220);
  await a.set({ n: false, sel: 'a' });
  await a.wait(900);

  // 4. One key per decision: j down, k back up, l = đọc sau (the card leaves, the cursor stays in place)
  a.mark('triage');
  await a.key('j');
  await a.set({ legend: 'jk', sel: 'b' });
  await a.wait(700);
  await a.key('k');
  await a.set({ legend: 'jk', sel: 'a' });
  await a.wait(700);
  await a.key('l');
  await a.set({ legend: 'l', a: false, sel: 'b' });
  await a.wait(1000);

  // 5. a = lưu trữ the last two: inbox zero, the payoff, held
  a.mark('zero');
  await a.key('a');
  await a.set({ legend: 'a', b: false, sel: 'c' });
  await a.wait(800);
  await a.key('a');
  await a.set({ c: false, sel: null, empty: true });
  await a.wait(900);
  await a.set({ legend: null });
  await a.wait(1500);

  // Reset: the captured card is folded away, so it resets unseen; new entries arrive and the loop reopens
  await a.snap({ ready: false, pick: false });
  await a.set({ empty: false, a: true, b: true, c: true, sel: 'a' });
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
  const t = useT(guides);
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
                <Badge tone="outline">→ {t('Bằng chứng cho cơ hội')}</Badge>
              ) : (
                <Badge tone="secondary">
                  <Loader2 className="ib-spin" size={12} strokeWidth={2} aria-hidden />
                  {t('Đang xử lý')}
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
          <Badge tone="outline">{t('#hoc-lap-trinh')}</Badge>
        </div>
      </Collapse>
    </article>
  );
}

/** An entry already in the inbox: thumbnail (a link's) and date are placeholders, the title and domain real. */
function EntryCard({ entry, selected }: { entry: (typeof ENTRIES)[keyof typeof ENTRIES]; selected: boolean }) {
  const t = useT(guides);
  return (
    <article className="ib-card" data-selected={selected || undefined}>
      <div className="ib-panel ib-panel--entry">
        {entry.thumb && <Bar w={44} h={44} r={12} tone={3} className="ib-fthumb" />}
        <div className="ib-head">
          <span className="ib-title ib-title--entry">{t(entry.title)}</span>
          {entry.meta ? (
            <span className="ib-meta">{entry.meta}</span>
          ) : (
            <Bar w={64} h={6} r={3} tone={3} className="ib-meta-bar" />
          )}
        </div>
      </div>
    </article>
  );
}

const LABEL = msg(
  'Hình minh họa cách dùng Inbox: dán một link vào ô Thu thập nhanh rồi nhấn Cmd+Enter; thẻ mới hiện ảnh thu nhỏ, tag do AI gợi ý và nơi nên chuyển tới. Nhấn Esc để rời ô nhập, rồi dùng phím: J và K để xuống và lên, L để đọc sau, A để lưu trữ, O để gắn làm bằng chứng cho một cơ hội, cho tới khi inbox về 0.',
);

export default function InboxTriageGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  const t = useT(guides);
  return (
    <div role="img" aria-label={t(LABEL)} className={className}>
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
                  label={t('Thu thập nhanh')}
                  value={s.typed}
                  focused={s.focused}
                  placeholder={t('Dán một link hoặc ghi một ý tưởng…')}
                />
                <div className="ib-capture__foot">
                  <Text filler w={150} className="ib-hint-text">
                    {t('tag và tóm tắt được thêm sau, trong nền')}
                  </Text>
                  <span
                    className="ib-button"
                    data-off={(!s.typed && !s.saving) || undefined}
                    data-pressed={s.saving || undefined}
                  >
                    {t('Lưu vào inbox')}
                  </span>
                </div>
              </section>

              <div className="ib-legend">
                {LEGEND.map((h) => (
                  <span key={h.id} className="ib-legend__item" data-on={s.legend === h.id || undefined}>
                    <span className="ib-kbd">{h.key}</span>
                    <Text>{t(h.label)}</Text>
                  </span>
                ))}
              </div>

              <div className="ib-list">
                <Collapse open={s.n} reveal="drop">
                  <div className="ib-gap">
                    <CapturedCard s={s} />
                  </div>
                </Collapse>
                {(['a', 'b', 'c'] as const).map((k) => (
                  <Collapse key={k} open={s[k]} reveal="drop">
                    <div className="ib-gap">
                      <EntryCard entry={ENTRIES[k]} selected={s.sel === k} />
                    </div>
                  </Collapse>
                ))}
                <Collapse open={s.empty} reveal="drop">
                  <div className="ib-empty">
                    <span className="ib-empty__icon">
                      <Inbox size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <Text className="ib-empty__title">{t('Inbox đã về 0')}</Text>
                    <Text className="ib-empty__text">{t('Mọi thứ đã được xử lý.')}</Text>
                  </div>
                </Collapse>
              </div>
            </div>

            {/* The opportunity picker is a modal dialog over a soft backdrop, as in opportunity-dialog.tsx */}
            <div className="ib-scrim" data-show={s.dialog || undefined} />
            <Popover show={s.dialog} origin="center" className="ib-dialog">
              <Text className="ib-dialog__title">{t('Bằng chứng cho cơ hội nào?')}</Text>
              <Text className="ib-dialog__desc">Learn Next.js</Text>
              <div className="ib-dialog__list">
                <div className="ib-opp">
                  <span className="ib-kbd" data-on={s.pick || undefined}>
                    1
                  </span>
                  <Text className="ib-opp__title">{t('Khóa học Next.js tiếng Việt')}</Text>
                  <span className="ib-button ib-button--xs" data-pressed={s.pick || undefined}>
                    {t('Ủng hộ')}
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
