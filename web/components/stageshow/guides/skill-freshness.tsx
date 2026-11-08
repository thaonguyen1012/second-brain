'use client';
import { useCallback, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, X } from 'lucide-react';
import { formatDay, todayPrague } from '@/lib/dates';
import { useT } from '@/lib/i18n/client';
import { guides } from '@/lib/i18n/en/guides';
import { msg, type Msg, type T } from '@/lib/i18n/translate';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Bar } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { Swap } from '../kit/motion/Swap';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import { GBadge, GButton, GRow, GSelect, GUIDE_SIZE, target, type Tone } from './parts';
import './skill-freshness.css';

// Skills fade without evidence, played once (about 12 s). The screen is the real Kỹ năng page
// (components/brain/growth/skills-page.tsx, skill-sheet.tsx, evidence-form.tsx) simplified: the matrix of
// tiles under its legend, and the skill's sheet with "Thêm bằng chứng".
//
// Beats: the faded TypeScript tile is opened; a link is added as evidence and the skill turns "Còn mới";
// the sheet closes on a green tile; then two time notes ("3 tháng sau", "6 tháng sau") show the tile turning
// "Đang cũ dần" and "Đã mờ" with no new evidence, the way freshness is computed (3 and 6 months from the
// newest evidence). The poster is the sheet with its new evidence and the "Còn mới" badge, the matrix behind
// it showing all three states and the legend.
//
// Built from the Stageshow gold `many-of-one` (a grid of one thing off the bottom edge, one tile in focus,
// the only one with words) with a sheet from `panel-annotation` (a panel over the product's margin) and the
// time notes of `corner-chip`. Freshness is never a number here, as in the app (DECISIONS 9.1).

type Fresh = 'fresh' | 'aging' | 'faded';

type S = {
  fresh: Fresh;
  sheet: boolean;
  form: boolean;
  title: string;
  typing: boolean;
  evidence: boolean;
  note: '' | '3' | '6';
};

const initial: S = { fresh: 'faded', sheet: false, form: false, title: '', typing: false, evidence: false, note: '' };
const EV_TITLE = msg('Bài viết: generics trong dự án thật');
const posterOf = (t: T): S => ({ ...initial, fresh: 'fresh', sheet: true, title: t(EV_TITLE), evidence: true });
const REST = { wide: { x: 300, y: 425 }, compact: { x: 40, y: 445 } };

/** freshness (growth/labels.ts): label, hint and badge tone, word for word */
const FRESH: Record<Fresh, { label: Msg; hint: Msg; tone: Tone }> = {
  fresh: { label: msg('Còn mới'), hint: msg('có bằng chứng trong 3 tháng'), tone: 'success' },
  aging: { label: msg('Đang cũ dần'), hint: msg('bằng chứng mới nhất 3 đến 6 tháng trước'), tone: 'warning' },
  faded: { label: msg('Đã mờ'), hint: msg('6 tháng không có bằng chứng mới, hoặc chưa có'), tone: 'outline' },
};

// The other tiles of the matrix: placeholder skills in a spread of states (name widths vary)
const FILLER: { fresh: Fresh; w: number }[] = [
  { fresh: 'fresh', w: 64 },
  { fresh: 'aging', w: 84 },
  { fresh: 'fresh', w: 52 },
  { fresh: 'faded', w: 74 },
  { fresh: 'aging', w: 58 },
  { fresh: 'fresh', w: 80 },
  { fresh: 'faded', w: 48 },
  { fresh: 'fresh', w: 70 },
  { fresh: 'aging', w: 62 },
  { fresh: 'faded', w: 86 },
  { fresh: 'fresh', w: 56 },
  { fresh: 'aging', w: 76 },
  { fresh: 'fresh', w: 66 },
  { fresh: 'faded', w: 60 },
  { fresh: 'aging', w: 72 },
];

async function script(a: Act<S>, t: T) {
  await a.wait(600);

  // 1. The faded skill opens in its sheet
  a.mark('open');
  await a.click('skill');
  await a.set({ sheet: true });
  await a.wait(700);

  // 2. Thêm bằng chứng: a link, typed and added; the skill is fresh again
  a.mark('evidence');
  await a.click('add');
  await a.set({ form: true, typing: true });
  await a.wait(300);
  await a.type('title', t(EV_TITLE), { interval: 22 });
  await a.wait(200);
  await a.click('save');
  await a.set({ form: false, typing: false, evidence: true });
  await a.wait(250);
  await a.set({ fresh: 'fresh' });
  await a.wait(1300);

  // 3. Esc closes the sheet on a green tile
  await a.key('esc');
  await a.set({ sheet: false });
  await a.move(REST);
  await a.wait(900);

  // 4. Months pass with no new evidence: the tile fades on its own (the payoff, held)
  a.mark('fade');
  await a.set({ note: '3', fresh: 'aging' });
  await a.wait(1700);
  await a.set({ note: '6', fresh: 'faded' });
  await a.wait(2400);
}

function Tile({ fresh, children, name }: { fresh: Fresh; children: React.ReactNode; name?: string }) {
  return (
    <span className="sk-tile" data-fresh={fresh} {...(name ? target(name) : {})}>
      {children}
    </span>
  );
}

function TileFoot({ fresh }: { fresh: Fresh }) {
  const t = useT(guides);
  return (
    <span className="sk-tile__foot">
      <span className="sk-dot" data-fresh={fresh} />
      <Swap id={fresh} className="sk-tile__state">
        {t(FRESH[fresh].label)}
      </Swap>
    </span>
  );
}

function Sheet({ s, today }: { s: S; today: string }) {
  const t = useT(guides);
  const f = FRESH[s.fresh];
  return (
    <div className="sk-sheet" data-open={s.sheet || undefined}>
      <span className="sk-sheet__close" aria-hidden>
        <X size={14} strokeWidth={2} />
      </span>
      <div className="sk-sheet__head">
        <span className="sk-sheet__name">
          <span className="sk-dot sk-dot--lg" data-fresh={s.fresh} />
          TypeScript
        </span>
        <span className="sk-sheet__state">
          <Swap id={s.fresh} className="sk-sheet__swap">
            <span className="sk-sheet__statebox">
              <GBadge tone={f.tone}>{t(f.label)}</GBadge>
              <span className="g-desc">{t(f.hint)}</span>
            </span>
          </Swap>
        </span>
        <span className="sk-sheet__aliases">
          <span className="g-desc">{t('Tên khác:')}</span>
          <GBadge tone="outline">TS</GBadge>
        </span>
      </div>
      <div className="sk-sheet__body">
        <span className="g-actions sk-sheet__actions">
          <GButton size="sm" variant="outline" icon={Pencil}>
            {t('Sửa tên, tên khác, ghi chú')}
          </GButton>
          <GButton size="sm" icon={Plus} name="add">
            {t('Thêm bằng chứng')}
          </GButton>
        </span>
        <Collapse open={s.form}>
          <div className="sk-form">
            <GRow label={t('Loại bằng chứng')}>
              <GSelect value={t('Link (bài viết, repo, case study)')} />
            </GRow>
            <Field className="g-field" label={t('Tiêu đề')} value={s.title} focused={s.typing} />
            <div className="g-dialog__foot">
              <GButton size="sm" variant="ghost">
                {t('Hủy')}
              </GButton>
              <GButton size="sm" name="save">
                {t('Thêm bằng chứng')}
              </GButton>
            </div>
          </div>
        </Collapse>
        <span className="sk-sheet__title">{t('Bằng chứng')}</span>
        <Collapse open={!s.evidence}>
          <span className="g-desc sk-sheet__none">
            {t(
              'Chưa có bằng chứng: thứ đã ship, case study, bài viết công khai. Không có bằng chứng thì kỹ năng ở trạng thái mờ.',
            )}
          </span>
        </Collapse>
        <Collapse open={s.evidence} reveal="drop">
          <div className="sk-ev">
            <span className="sk-ev__meta">
              <GBadge tone="secondary">Link</GBadge>
              <span className="g-desc">{today}</span>
            </span>
            <span className="sk-ev__title">
              {t(EV_TITLE)}
              <ExternalLink size={13} strokeWidth={2} aria-hidden />
            </span>
          </div>
        </Collapse>
      </div>
    </div>
  );
}

const LABEL = msg(
  'Hình minh họa trang Kỹ năng: mở một kỹ năng đã mờ, bấm Thêm bằng chứng và thêm một link; kỹ năng chuyển sang Còn mới. Nếu không có bằng chứng mới, ô kỹ năng tự đổi màu theo thời gian: sau 3 tháng là Đang cũ dần, sau 6 tháng là Đã mờ.',
);

export default function SkillFreshnessGuide({ className }: { className?: string }) {
  const look = useBrainLook();
  const t = useT(guides);
  const [today] = useState(() => formatDay(todayPrague()));
  // Typed text and poster in the page's language, kept stable (a new script would restart the scene)
  const run = useCallback((a: Act<S>) => script(a, t), [t]);
  const poster = useMemo(() => posterOf(t), [t]);
  return (
    <div role="img" aria-label={t(LABEL)} className={className}>
      <Stage
        width={GUIDE_SIZE.width}
        height={GUIDE_SIZE.height}
        compact={GUIDE_SIZE.compact}
        initial={initial}
        poster={poster}
        script={run}
        play="once"
        keys="bottom"
        cursor={{ at: REST, style: 'arrow' }}
        className="ssg-brain ssg-skill"
        {...look}
      >
        {(s, _rect, layout) => {
          const compact = layout === 'compact';
          return (
            <>
              <div className="g-col sk-col">
                <div className="sk-toolbar">
                  <GSelect value={t('Mọi độ mới')} className="sk-filter" />
                  {!compact && <span className="g-box sk-search">{t('Tìm theo tên hoặc tên khác')}</span>}
                  <GButton icon={Plus} kbd={compact ? undefined : 'N'} className="sk-new">
                    {t('Thêm kỹ năng')}
                  </GButton>
                </div>
                <div className="sk-legend">
                  {(['fresh', 'aging', 'faded'] as const).map((k) => (
                    <span key={k} className="sk-legend__item">
                      <span className="sk-swatch" data-fresh={k} />
                      {t(FRESH[k].label)}
                    </span>
                  ))}
                </div>
                <div className="sk-grid">
                  <Tile fresh={s.fresh} name="skill">
                    <span className="sk-tile__name">TypeScript</span>
                    <span className="sk-tile__alias">TS</span>
                    <TileFoot fresh={s.fresh} />
                  </Tile>
                  {FILLER.map((f, i) => (
                    <Tile key={i} fresh={f.fresh}>
                      <Bar w={f.w} h={8} r={3} tone={4} className="sk-tile__bar" />
                      <span className="sk-tile__foot">
                        <span className="sk-dot" data-fresh={f.fresh} />
                        <Bar w={40} h={6} r={3} tone={3} />
                      </span>
                    </Tile>
                  ))}
                </div>
              </div>
              <span className="g-note sk-note" data-show={s.note !== '' || undefined}>
                <Swap id={s.note || 'none'}>{t(s.note === '6' ? '6 tháng sau' : '3 tháng sau')}</Swap>
              </span>
              <Sheet s={s} today={today} />
            </>
          );
        }}
      </Stage>
    </div>
  );
}
