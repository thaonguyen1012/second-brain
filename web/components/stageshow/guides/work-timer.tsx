'use client';
import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Play, Square, Timer } from 'lucide-react';
import { formatWeekRange } from '@/components/brain/work/format';
import { mondayOf, todayPrague } from '@/lib/dates';
import { Collapse, Count, Roll, Stage, Swap, type Act } from '../kit';
import { useBrainLook } from '../brain-look';
import { GButton, GSelect, GUIDE_SIZE } from './parts';
import './work-timer.css';

// The timer and the week summary, played once (about 10 s). The screen is the real Công việc · Giờ page
// (components/brain/work/timer-panel.tsx and week-summary.tsx) simplified: the "Bấm giờ" card, then the
// summary card of the current week with its three tiles and the bar per project.
//
// Beats: a project is picked and "Bắt đầu" starts the timer (the card turns into the running clock); the clock
// ticks, then a time-lapse note skips an hour and a half; T stops it; the summary tiles roll and the project's
// billable bar draws in. The poster is that end frame. The hours are the guide's own session (an example
// project), never the owner's.
//
// Built from the Stageshow gold `stacked-cards` (two cards of one page in a column), with the value motion of
// `table-edit` (a total that rolls a beat after the edit that feeds it) and `form-error` (play once, hold).

type S = {
  running: boolean;
  /** Seconds on the running clock */
  clock: number;
  lapse: boolean;
  /** Minutes recorded this week */
  minutes: number;
};

const initial: S = { running: false, clock: 0, lapse: false, minutes: 0 };
const POSTER: S = { running: false, clock: 0, lapse: false, minutes: 90 };

const PROJECT = 'Website cho tiệm bánh';
const CLIENT = 'Tiệm bánh Hoa Mai';
const REST = { wide: { x: 560, y: 425 }, compact: { x: 330, y: 445 } };

/** formatClock (work/format.ts): h:mm:ss */
const clockText = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** formatHours (work/format.ts): "45 phút", "1 giờ 30" */
function hoursText(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r ? `${h} giờ ${String(r).padStart(2, '0')}` : `${h} giờ`;
}

async function script(a: Act<S>) {
  await a.wait(600);

  // 1. Start: the project is already picked, billable is ticked
  a.mark('start');
  await a.click('start');
  await a.set({ running: true });
  await a.wait(900);
  await a.set({ clock: 1 });
  await a.wait(1000);
  await a.set({ clock: 2 });
  await a.wait(600);

  // 2. Time passes: the note says how much, the clock rolls to it
  a.mark('lapse');
  await a.set({ lapse: true, clock: 5400 });
  await a.wait(1500);

  // 3. T stops it; the week's tiles and the project's bar take the session
  a.mark('stop');
  await a.set({ lapse: false });
  await a.key('t');
  await a.set({ running: false });
  await a.wait(350);
  await a.set({ minutes: 90 });
  await a.move(REST);
  await a.wait(2400);
}

function TimerCard({ s, compact }: { s: S; compact: boolean }) {
  return (
    <div className="g-card wt-timer">
      <Swap id={s.running ? 'run' : 'idle'} className="wt-swap">
        {s.running ? (
          <div className="wt-run">
            <span className="wt-pulse" aria-hidden>
              <span />
            </span>
            <Count value={s.clock} format={clockText} duration={600} className="wt-clock" />
            <span className="wt-run__text">
              <span className="wt-run__title">{PROJECT}</span>
              <span className="g-desc">bắt đầu lúc 09:00</span>
            </span>
            <GButton variant="destructive" icon={Square} kbd="T" name="stop">
              Dừng
            </GButton>
          </div>
        ) : (
          <div className="wt-idle">
            <span className="wt-idle__head">
              <Timer size={14} strokeWidth={2} aria-hidden />
              Bấm giờ
            </span>
            <div className="wt-form">
              <GSelect value={PROJECT} className="wt-project" />
              <span className="g-box wt-note">Đang làm gì? (không bắt buộc)</span>
              <span className="wt-bill">
                <span className="wt-check" aria-hidden>
                  <Check size={11} strokeWidth={3} />
                </span>
                Tính tiền
              </span>
              <GButton icon={Play} kbd={compact ? undefined : 'T'} name="start" className="wt-start">
                Bắt đầu
              </GButton>
            </div>
          </div>
        )}
      </Swap>
    </div>
  );
}

function SummaryCard({ s, compact, range }: { s: S; compact: boolean; range: string }) {
  const has = s.minutes > 0;
  return (
    <div className="g-card wt-summary">
      <div className="wt-summary__head">
        <span className="g-card__title wt-summary__title">Tuần {range}</span>
        <span className="wt-stepper">
          <span className="g-button" data-variant="outline" data-size="xs" aria-hidden>
            <ChevronLeft size={12} strokeWidth={2} />
          </span>
          {!compact && (
            <GButton size="xs" variant="outline" off>
              Tuần này
            </GButton>
          )}
          <span className="g-button" data-variant="outline" data-size="xs" aria-hidden>
            <ChevronRight size={12} strokeWidth={2} />
          </span>
        </span>
      </div>
      <div className="wt-tiles">
        <span className="wt-tile">
          <span className="wt-tile__label">Tổng giờ</span>
          <Roll className="wt-tile__value">{hoursText(s.minutes)}</Roll>
        </span>
        <span className="wt-tile">
          <span className="wt-tile__label">Tính tiền</span>
          <Roll className="wt-tile__value" delay={120}>
            {hoursText(s.minutes)}
          </Roll>
          <Collapse open={has}>
            <span className="wt-tile__hint">100% tổng giờ</span>
          </Collapse>
        </span>
        <span className="wt-tile">
          <span className="wt-tile__label">Không tính tiền</span>
          <span className="wt-tile__value">0 phút</span>
          <Collapse open={has}>
            <span className="wt-tile__hint">0% tổng giờ</span>
          </Collapse>
        </span>
      </div>
      <Collapse open={!has}>
        <span className="g-desc">Chưa có giờ nào trong tuần này.</span>
      </Collapse>
      <Collapse open={has} reveal="drop">
        <div className="wt-by">
          <div className="wt-by__head">
            <span className="wt-by__title">Theo dự án</span>
            <span className="wt-legend">
              <span>
                <i data-kind="billable" />
                Tính tiền
              </span>
              <span>
                <i data-kind="nonbillable" />
                Không tính tiền
              </span>
            </span>
          </div>
          <div className="wt-row">
            <span className="wt-row__name">
              {PROJECT}
              {!compact && <span className="wt-row__client">{CLIENT}</span>}
            </span>
            <span className="wt-row__track">
              <span className="wt-row__bar" data-kind="billable" data-on={has || undefined} />
              <span className="wt-row__total">1 giờ 30</span>
            </span>
          </div>
        </div>
      </Collapse>
    </div>
  );
}

const LABEL =
  'Hình minh họa trang Công việc, phần Giờ: chọn dự án rồi bấm Bắt đầu để bấm giờ; đồng hồ chạy, rồi nhấn T để dừng. ' +
  'Phiên vừa ghi hiện ngay trong tổng kết tuần: tổng giờ, giờ tính tiền và không tính tiền, và một thanh cho dự án.';

export default function WorkTimerGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  const [range] = useState(() => formatWeekRange(mondayOf(todayPrague())));
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
        className="ssg-brain ssg-work"
        {...look}
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact';
          return (
            <>
              <div className="g-col wt-col">
                <TimerCard s={s} compact={compact} />
                <SummaryCard s={s} compact={compact} range={range} />
              </div>
              <span className="g-note wt-lapse" data-show={s.lapse || undefined}>
                1 giờ 30 phút sau
              </span>
            </>
          );
        }}
      </Stage>
    </div>
  );
}
