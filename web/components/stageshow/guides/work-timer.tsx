'use client';
import { useState, type CSSProperties } from 'react';
import { Check, ChevronLeft, ChevronRight, Play, Square, Timer } from 'lucide-react';
import { formatWeekRange } from '@/components/brain/work/format';
import { mondayOf, todayPrague } from '@/lib/dates';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Bar } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { Count } from '../kit/motion/Count';
import { Roll } from '../kit/motion/Roll';
import { Swap } from '../kit/motion/Swap';
import { useBrainLook } from '../brain-look';
import { GButton, GSelect, GUIDE_SIZE } from './parts';
import './work-timer.css';

// The timer and the week summary, played once (about 10 s). The screen is the real Công việc · Giờ page
// (components/brain/work/timer-panel.tsx and week-summary.tsx) simplified: the "Bấm giờ" card, then the
// summary card of the current week with its three tiles and the bar per project.
//
// Beats: a project is picked and "Bắt đầu" starts the timer (the card turns into the running clock); the clock
// ticks, then a time-lapse note skips an hour and a half; T stops it; the summary tiles roll and the project's
// billable bar draws in at the top of "Theo dự án" (rows are sorted by hours), carrying the week's other
// projects down. The poster is that end frame. The hours are the guide's own example week (an example project
// and five placeholder ones, enough to run off the bottom while the timer runs), never the owner's.
//
// Built from the Stageshow gold `stacked-cards` (two cards of one page in a column pinned a gutter from the top,
// the lower one running off the bottom on every frame), with the value motion of `table-edit` (a total that
// rolls a beat after the edit that feeds it) and `form-error` (play once, hold).

type S = {
  running: boolean;
  /** Seconds on the running clock */
  clock: number;
  lapse: boolean;
  /** The session is recorded in the week */
  logged: boolean;
};

const initial: S = { running: false, clock: 0, lapse: false, logged: false };
const POSTER: S = { running: false, clock: 0, lapse: false, logged: true };

const PROJECT = 'Website cho tiệm bánh';
const CLIENT = 'Tiệm bánh Hoa Mai';
const SESSION = 90;
const REST = { wide: { x: 580, y: 420 }, compact: { x: 330, y: 445 } };

/** The week's other projects, drawn as placeholders: minutes and whether they are billable. */
const OTHERS: {
  minutes: number;
  kind: 'billable' | 'nonbillable';
  name: number;
  client: number;
}[] = [
  { minutes: 60, kind: 'billable', name: 118, client: 64 },
  { minutes: 45, kind: 'nonbillable', name: 92, client: 0 },
  { minutes: 45, kind: 'billable', name: 104, client: 52 },
  { minutes: 30, kind: 'nonbillable', name: 84, client: 0 },
  { minutes: 30, kind: 'billable', name: 110, client: 58 },
];
const BASE = {
  billable: OTHERS.filter((o) => o.kind === 'billable').reduce((n, o) => n + o.minutes, 0),
  nonbillable: OTHERS.filter((o) => o.kind === 'nonbillable').reduce((n, o) => n + o.minutes, 0),
};

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

/** share (week-summary.tsx) */
const share = (part: number, total: number) => `${Math.round((part / total) * 100)}% tổng giờ`;

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
  await a.set({ lapse: true, clock: SESSION * 60 });
  await a.wait(1500);

  // 3. T stops it; the week's tiles and the project's bar take the session
  a.mark('stop');
  await a.set({ lapse: false });
  await a.key('t');
  await a.set({ running: false });
  await a.wait(350);
  await a.set({ logged: true });
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
      {/* The time-lapse note: on the card's top edge in wide, inside the running card's margin in compact */}
      <span className="g-note wt-lapse" data-show={s.lapse || undefined}>
        1 giờ 30 phút sau
      </span>
    </div>
  );
}

function SummaryCard({ s, compact, range }: { s: S; compact: boolean; range: string }) {
  const billable = BASE.billable + (s.logged ? SESSION : 0);
  const total = billable + BASE.nonbillable;
  // Bars are scaled to the longest row (BillableBar), so the new, longer row rescales the others
  const scale = Math.max(...OTHERS.map((o) => o.minutes), s.logged ? SESSION : 0);
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
          <Roll className="wt-tile__value">{hoursText(total)}</Roll>
        </span>
        <span className="wt-tile">
          <span className="wt-tile__label">Tính tiền</span>
          <Roll className="wt-tile__value" delay={120}>
            {hoursText(billable)}
          </Roll>
          <Roll className="wt-tile__hint" delay={240}>
            {share(billable, total)}
          </Roll>
        </span>
        <span className="wt-tile">
          <span className="wt-tile__label">Không tính tiền</span>
          <span className="wt-tile__value">{hoursText(BASE.nonbillable)}</span>
          <Roll className="wt-tile__hint" delay={240}>
            {share(BASE.nonbillable, total)}
          </Roll>
        </span>
      </div>
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
        <div className="wt-list">
          <Collapse open={s.logged} reveal="drop">
            <div className="wt-row wt-row--new">
              <span className="wt-row__name">
                {PROJECT}
                {!compact && <span className="wt-row__client">{CLIENT}</span>}
              </span>
              <span className="wt-row__track">
                <span
                  className="wt-row__bar"
                  data-kind="billable"
                  data-on={s.logged || undefined}
                  style={{ '--w': SESSION / scale } as CSSProperties}
                />
                <span className="wt-row__total">{hoursText(SESSION)}</span>
              </span>
            </div>
          </Collapse>
          {OTHERS.map((o, i) => (
            <div className="wt-row" key={i}>
              <span className="wt-row__name">
                <Bar w={compact ? Math.round(o.name * 0.85) : o.name} h={7} tone={3} />
                {o.client > 0 && !compact && <Bar w={o.client} h={6} tone={2} />}
              </span>
              <span className="wt-row__track">
                <span
                  className="wt-row__bar"
                  data-kind={o.kind}
                  data-on
                  style={{ '--w': o.minutes / scale } as CSSProperties}
                />
                <Bar w={30} h={6} tone={2} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const LABEL =
  'Hình minh họa trang Công việc, phần Giờ: chọn dự án rồi bấm Bắt đầu để bấm giờ; đồng hồ chạy, rồi nhấn T để dừng. ' +
  'Phiên vừa ghi được cộng ngay vào tổng kết tuần: tổng giờ và giờ tính tiền tăng, và dự án có một thanh mới ở đầu phần Theo dự án.';

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
            </>
          );
        }}
      </Stage>
    </div>
  );
}
