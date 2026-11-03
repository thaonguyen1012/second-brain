'use client';
import { ArrowRightLeft, Check, Clock, Info, MessageSquareText, Plus, Target } from 'lucide-react';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Collapse } from '../kit/motion/Collapse';
import { Swap } from '../kit/motion/Swap';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import { GBadge, GButton, GCard, GKbd, GUIDE_SIZE } from './parts';
import './week-ritual.css';

// The week ritual, played once (about 12 s): planning, then the review. The screen is the real Tuần page
// (components/brain/tuan/) simplified: the Kế hoạch / Nhìn lại tabs, "Kéo mục tiêu chưa xong sang",
// "Mục tiêu tuần" with its 3-5 hint, then the review's time chart and the six questions of "Nhật ký nhìn lại".
//
// Beats: carry last week's two open objectives over; type a third (the app's own placeholder example) and
// the hint says 3 is right; R switches to the review, where the week's hours draw in (objective hours vs
// other hours) and the question about lost time is answered next to the chart. The poster is that end frame.
//
// Built from the Stageshow gold `stacked-cards` (one column of the page's cards on the well, running off the
// bottom), the motion of `choreography` (content changing in place, retained rows) and `form-error` (play
// once, hold the payoff). The chart has no axis or values: its shape is an example, never the owner's hours.

type S = {
  carried: boolean;
  /** Objectives in the list: 0, 2 (carried) or 3 (one added) */
  count: 0 | 2 | 3;
  draft: string;
  typing: boolean;
  tab: 'plan' | 'review';
  answering: boolean;
};

const initial: S = { carried: false, count: 0, draft: '', typing: false, tab: 'plan', answering: false };
const POSTER: S = { carried: true, count: 3, draft: '', typing: false, tab: 'review', answering: true };

// Short enough to show whole in the review's "Theo mục tiêu" name column (no ellipsis on the poster)
const CARRIED = ['Viết case study', 'Ôn lại React hooks'];
const ADDED = 'Gửi 2 báo giá';

/** ObjectiveHint (objectives-editor.tsx) for 0, 2 and 3 objectives, word for word. */
const HINT: Record<S['count'], string> = {
  0: 'Chọn 3–5 mục tiêu cho tuần: kết quả muốn có, không phải danh sách task.',
  2: 'Đang có 2 mục tiêu. 3–5 là vừa cho một tuần, ít hơn cũng được.',
  3: '3 mục tiêu: vừa đủ cho một tuần.',
};

/** reviewQuestions (week-utils.ts), word for word; the second one points at the chart. */
const QUESTIONS = [
  'Thắng lớn nhất tuần này là gì?',
  'Cái gì kéo thời gian khỏi ưu tiên?',
  'Học được gì?',
  'Có hài lòng với tuần này không?',
  'Tuần này điều gì làm mình đổi ý?',
  'Cơ hội nào có thêm bằng chứng?',
];
const Q2_HINT = 'Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở bên trái.';
/** The compact design stacks the chart above the journal, so its hint points up instead */
const Q2_HINT_COMPACT = 'Nhìn biểu đồ giờ cho mục tiêu và giờ khác ở trên.';

// Example shape of a week (share of the tallest day): objective hours at the baseline, other hours on top
const DAYS: { day: string; obj: number; other: number }[] = [
  { day: 'T2', obj: 0.62, other: 0.2 },
  { day: 'T3', obj: 0.42, other: 0.34 },
  { day: 'T4', obj: 0.78, other: 0.12 },
  { day: 'T5', obj: 0.3, other: 0.46 },
  { day: 'T6', obj: 0.55, other: 0.22 },
  { day: 'T7', obj: 0, other: 0.16 },
  { day: 'CN', obj: 0, other: 0 },
];
const BY_OBJECTIVE = [0.9, 0.55, 0.3];

async function script(a: Act<S>) {
  await a.wait(600);

  // 1. Carry over: last week's open objectives, both ticked, moved in one action
  a.mark('carry');
  await a.click('carry');
  await a.set({ carried: true, count: 2 });
  await a.wait(1100);

  // 2. A third objective, typed and added with Enter: the hint now says the week is planned
  a.mark('add');
  await a.click('add');
  await a.set({ typing: true });
  await a.type('draft', ADDED, { interval: 40 });
  await a.wait(250);
  await a.key('enter');
  await a.set({ count: 3, draft: '' });
  await a.wait(1400);

  // 3. End of the week: R opens the review; the hours draw in, objective hours against the rest
  a.mark('review');
  await a.set({ typing: false });
  await a.key('r');
  await a.set({ tab: 'review' });
  await a.wait(1700);

  // 4. The question about lost time, answered next to the chart (the payoff, held)
  a.mark('answer');
  await a.click('q2');
  await a.set({ answering: true });
  await a.move({ at: 'q2', x: 0.85, y: 2.4 });
  await a.wait(2600);
}

function Checkbox() {
  return (
    <span className="wk-check" aria-hidden>
      <Check size={11} strokeWidth={3} />
    </span>
  );
}

function PlanPane({ s, compact }: { s: S; compact: boolean }) {
  return (
    <div className="wk-pane" data-show={s.tab === 'plan' || undefined}>
      <Collapse open={!s.carried}>
        <div className="wk-gap">
          <GCard icon={ArrowRightLeft} title="Kéo mục tiêu chưa xong sang">
            <span className="g-desc">Mục tiêu còn mở của tuần trước. Bỏ chọn cái không còn quan trọng.</span>
            <div className="wk-carry">
              {CARRIED.map((t) => (
                <span key={t} className="wk-carry__row">
                  <Checkbox />
                  {t}
                </span>
              ))}
            </div>
            <GButton name="carry">Kéo 2 mục tiêu sang tuần này</GButton>
          </GCard>
        </div>
      </Collapse>

      <GCard icon={Target} title="Mục tiêu tuần">
        <span className="wk-hint">
          <Info size={13} strokeWidth={2} aria-hidden />
          <Swap id={s.count} className="wk-hint__text">
            {HINT[s.count]}
          </Swap>
        </span>
        <div className="wk-list">
          {[...CARRIED, ADDED].map((t, i) => (
            <Collapse key={t} open={i < s.count} reveal="drop">
              <div className="wk-obj">
                <span className="wk-obj__n">{i + 1}.</span>
                <span className="wk-obj__title">{t}</span>
                {i < 2 && <GBadge tone="outline">Từ tuần trước</GBadge>}
                {!compact && <GBadge tone="info">Đang làm</GBadge>}
              </div>
            </Collapse>
          ))}
        </div>
        <div className="wk-add">
          <Field
            className="g-field wk-add__field"
            value={s.draft}
            focused={s.typing}
            placeholder="Thêm mục tiêu, ví dụ: Gửi báo giá cho 2 khách"
            box={{ 'data-target': 'add', 'data-cursor': 'ibeam' }}
          />
          <GButton variant="outline" icon={Plus} off={!s.draft}>
            Thêm
          </GButton>
        </div>
      </GCard>
    </div>
  );
}

function ReviewPane({ s, compact }: { s: S; compact: boolean }) {
  const shown = s.tab === 'review';
  return (
    <div className="wk-pane wk-review" data-show={shown || undefined}>
      <GCard icon={Clock} title="Giờ cho mục tiêu và giờ khác" className="wk-time">
        <span className="wk-legend">
          <span className="wk-legend__item">
            <span className="wk-swatch" data-kind="obj" />
            Giờ cho mục tiêu
          </span>
          <span className="wk-legend__item">
            <span className="wk-swatch" data-kind="other" />
            Giờ khác
          </span>
        </span>
        <div className="wk-chart" aria-hidden>
          {DAYS.map((d, i) => (
            <span key={d.day} className="wk-day">
              <span className="wk-day__bar" style={{ ['--d' as string]: `${i * 70}ms` }}>
                {d.other > 0 && <span className="wk-seg" data-kind="other" style={{ height: `${d.other * 100}%` }} />}
                {d.obj > 0 && <span className="wk-seg" data-kind="obj" style={{ height: `${d.obj * 100}%` }} />}
              </span>
              <span className="wk-day__label">{d.day}</span>
            </span>
          ))}
        </div>
        {!compact && (
          <div className="wk-by">
            <span className="wk-by__title">Theo mục tiêu</span>
            {[...CARRIED, ADDED].map((t, i) => (
              <span key={t} className="wk-by__row">
                <span className="wk-by__name">{t}</span>
                <span
                  className="wk-by__bar"
                  style={{ width: `${BY_OBJECTIVE[i] * 100}%`, ['--d' as string]: `${500 + i * 80}ms` }}
                />
              </span>
            ))}
          </div>
        )}
      </GCard>

      <GCard icon={MessageSquareText} title="Nhật ký nhìn lại" className="wk-journal">
        <div className="wk-qs">
          {QUESTIONS.map((q, i) => (
            <div key={q} className="wk-q">
              <span className="wk-q__label">
                <span className="wk-q__n">{i + 1}.</span>
                {q}
              </span>
              {i === 1 && (
                <Collapse open={s.answering}>
                  <span className="g-hint wk-q__hint">{compact ? Q2_HINT_COMPACT : Q2_HINT}</span>
                </Collapse>
              )}
              <span
                className="wk-q__box"
                data-focused={(i === 1 && s.answering) || undefined}
                {...(i === 1 ? { 'data-target': 'q2', 'data-cursor': 'ibeam' } : {})}
              >
                {i === 1 && s.answering && <span className="wk-caret" />}
              </span>
            </div>
          ))}
        </div>
      </GCard>
    </div>
  );
}

const LABEL =
  'Hình minh họa trang Tuần. Đầu tuần, ở thẻ Kế hoạch: bấm "Kéo 2 mục tiêu sang tuần này" để mang mục tiêu chưa xong của tuần trước sang, ' +
  'rồi thêm mục tiêu mới; gợi ý cho biết 3 đến 5 mục tiêu là vừa. Cuối tuần, nhấn R để mở Nhìn lại: biểu đồ cho thấy giờ cho mục tiêu so với giờ khác ' +
  'theo từng ngày, bên cạnh sáu câu hỏi của nhật ký nhìn lại, như "Cái gì kéo thời gian khỏi ưu tiên?".';

export default function WeekRitualGuide({ className }: { className?: string }) {
  const look = useBrainLook();
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
        cursor={{ at: { wide: { x: 560, y: 420 }, compact: { x: 330, y: 440 } }, style: 'arrow' }}
        className="ssg-brain ssg-week"
        {...look}
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact';
          return (
            <div className="g-col wk-col">
              <div className="wk-top">
                <span className="wk-tabs" data-tab={s.tab}>
                  <span className="wk-tabs__thumb" />
                  <span className="wk-tab" data-on={s.tab === 'plan' || undefined}>
                    Kế hoạch
                  </span>
                  <span className="wk-tab" data-on={s.tab === 'review' || undefined}>
                    Nhìn lại
                  </span>
                </span>
                {!compact && (
                  <span className="wk-keys">
                    <GKbd>P</GKbd> kế hoạch · <GKbd>R</GKbd> nhìn lại
                  </span>
                )}
              </div>
              <div className="wk-panes">
                <PlanPane s={s} compact={compact} />
                <ReviewPane s={s} compact={compact} />
              </div>
            </div>
          );
        }}
      </Stage>
    </div>
  );
}
