'use client';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  BookOpen,
  Brain,
  Briefcase,
  CalendarRange,
  Clock,
  Dumbbell,
  Inbox,
  Library,
  Lightbulb,
  NotebookPen,
  PanelLeftClose,
  Route,
  Search,
  Sun,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Stage, type LookTokens } from '../kit/stage';
import type { Act } from '../kit/act';
import { Bar, Text, Window } from '../kit/window';
import { Collapse } from '../kit/motion/Collapse';
import { useBrainLook } from '../brain-look';
import './pictures.css';

/*
 * The pictures of the intro page (/gioi-thieu/): one page hero and the six tiles of the feature grid.
 *
 * Plan (Stageshow references/bento.md), written before building:
 *
 *   Tile       Span   Kind        The one thing                                   Moves
 *   Hero       page   Hero UI     the shell: grouped sidebar, Hôm nay panels      still
 *   Inbox      2 x 2  Component   the card list under the key legend, triaged    L then A fold two cards, once
 *   ⌘K         1 x 1  Object      two keycaps at display size                     still
 *   Tuần       1 x 1  Diagram     day columns, objective hours vs other hours     still
 *   Cơ hội     1 x 1  Component   one hypothesis: scores, supporting + opposing   still
 *   Kỹ năng    1 x 1  Collection  skill tiles fading fresh -> aging -> faded      still
 *   Bản tin    1 x 1  Component   one story card and its two one-tap actions      still
 *
 * Gold examples: `bento` (tile frame, measured Stage per picture, pinned crops), `stacked-cards` (the inbox
 * column), `fade-crop`/`linear` (the hero: a sidebar window inset top and sides, off the bottom). Window chrome
 * appears once on the page (the hero), never inside the grid. Only the inbox tile moves: it plays once when it
 * scrolls in and ends on its poster, so the printed page and reduced motion show the same frame.
 *
 * Each picture fills the slot the page gives it (`.intro-pic`, sized by app/(home)/gioi-thieu/intro.css) and
 * draws its Stage at the slot's own width and height, so type stays at 1:1. Content is neutral example data; no
 * numbers about the owner's results.
 */

/** Measures the slot this picture fills. ResizeObserver reports the first size before paint. */
function useSlot() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type Look = { theme: 'light' | 'dark'; tokens: LookTokens };

/** The slot and its Stage: a still unless a script is given. */
function Picture<S extends object>({
  name,
  label,
  initial,
  poster,
  script,
  children,
}: {
  name: string;
  label: string;
  initial: S;
  poster?: S;
  script?: (a: Act<S>) => Promise<void>;
  children: (s: S, size: { w: number; h: number }) => ReactNode;
}) {
  const [ref, size] = useSlot();
  const look: Look = useBrainLook();
  return (
    <div ref={ref} className="intro-pic-fill" role="img" aria-label={label}>
      {size.w > 0 && size.h > 0 && (
        <Stage<S>
          width={size.w}
          height={size.h}
          initial={initial}
          poster={poster}
          script={script}
          play="once"
          className={`ssg-intro ssg-intro--${name}`}
          {...look}
        >
          {(s) => children(s, size)}
        </Stage>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Hero: the shell with Hôm nay */

/*
 * The app sidebar (lib/app-nav.ts, components/app-shell.tsx) at the picture's scale: the header (Brain tile, the
 * name, the hide button), Hôm nay and Tuần without a label, then the groups Phát triển, Thư viện, Cơ hội and
 * Công việc under their muted labels ("Khác" is left out). Every row icon takes the row's text colour, a row
 * with a count ends in it in muted digits, and Hôm nay, the page the main pane shows, is the darker grey current row.
 * Counts are example numbers; Tuần's 2 are the two open objectives of the panel beside it.
 *
 * The window runs off the bottom of the slot but no row may be cut by it: every group keeps its first row (the
 * page its area opens), and the other rows join by `rank` while they still fit whole above the crop (fitSide).
 */
type SideRow = { title: string; icon: LucideIcon; count?: number; rank: number };
type SideGroup = { label?: string; rows: SideRow[] };

const SIDE_NAV: SideGroup[] = [
  {
    rows: [
      { title: 'Hôm nay', icon: Sun, rank: 0 },
      { title: 'Tuần', icon: CalendarRange, count: 2, rank: 0 },
    ],
  },
  {
    label: 'Phát triển',
    rows: [
      { title: 'Sổ tay', icon: BookOpen, rank: 0 },
      { title: 'Lộ trình', icon: Route, rank: 5 },
      { title: 'Kỹ năng', icon: Dumbbell, count: 14, rank: 1 },
      { title: 'Thị trường', icon: TrendingUp, count: 6, rank: 4 },
      { title: 'Nhật ký thành tựu', icon: Trophy, count: 1, rank: 6 },
    ],
  },
  {
    label: 'Thư viện',
    rows: [
      { title: 'Item', icon: Library, count: 48, rank: 0 },
      { title: 'Ghi chú', icon: NotebookPen, count: 23, rank: 2 },
    ],
  },
  { label: 'Cơ hội', rows: [{ title: 'Cơ hội', icon: Lightbulb, count: 3, rank: 0 }] },
  {
    label: 'Công việc',
    rows: [
      { title: 'Dự án', icon: Briefcase, count: 2, rank: 0 },
      { title: 'Giờ', icon: Clock, rank: 3 },
    ],
  },
];

const MAX_RANK = 6;

/** Sidebar metrics in px; pictures.css reads them from custom properties set on .hs-side, so the two never drift. */
const SIDE = {
  /** The kit's lights band at the top of a sidebar window (window.css .ss-window__side-top) */
  lights: 38,
  pad: 0,
  brand: 30,
  brandGap: 8,
  row: 26,
  rowGap: 2,
  label: 20,
  groupGap: 6,
  /** Room kept between the last whole row and the crop */
  clear: 8,
};

/** Where the first group starts, from the window's top edge. */
const SIDE_TOP = SIDE.lights + SIDE.pad + SIDE.brand + SIDE.brandGap;

const sideHeight = (groups: SideGroup[]) =>
  groups.reduce(
    (h, g) =>
      h + (g.label ? SIDE.groupGap + SIDE.label : 0) + g.rows.length * SIDE.row + (g.rows.length - 1) * SIDE.rowGap,
    0,
  );

/**
 * The groups and rows that fit whole in `room` px: every group's first row, then the others by rank. Below the
 * design size (never at the page's slot sizes, 270 px and up) whole groups leave from the end instead.
 */
function fitSide(room: number): SideGroup[] {
  let fit: SideGroup[] | null = null;
  for (let k = 0; k <= MAX_RANK; k++) {
    const groups = SIDE_NAV.map((g) => ({ ...g, rows: g.rows.filter((r) => r.rank <= k) }));
    if (sideHeight(groups) > room) break;
    fit = groups;
  }
  if (fit) return fit;
  let groups = SIDE_NAV.map((g) => ({ ...g, rows: g.rows.filter((r) => r.rank === 0) }));
  while (groups.length > 1 && sideHeight(groups) > room) groups = groups.slice(0, -1);
  return groups;
}

function ShellSidebar({ room }: { room: number }) {
  const vars = {
    '--hs-pad': `${SIDE.pad}px`,
    '--hs-brand': `${SIDE.brand}px`,
    '--hs-brand-gap': `${SIDE.brandGap}px`,
    '--hs-row': `${SIDE.row}px`,
    '--hs-row-gap': `${SIDE.rowGap}px`,
    '--hs-label': `${SIDE.label}px`,
    '--hs-group-gap': `${SIDE.groupGap}px`,
  } as CSSProperties;
  return (
    <nav className="hs-side" style={vars}>
      <span className="hs-brand">
        <span className="hs-brand__tile" aria-hidden>
          <Brain size={16} strokeWidth={1.75} />
        </span>
        <span className="hs-brand__name">Alex&apos;s Brain</span>
        <PanelLeftClose size={14} strokeWidth={2} aria-hidden className="hs-brand__hide" />
      </span>
      {fitSide(room).map((group) => (
        <span key={group.rows[0].title} className="hs-group">
          {group.label && <span className="hs-label">{group.label}</span>}
          <span className="hs-rows">
            {group.rows.map(({ title, icon: Icon, count }) => (
              <span key={title} className="hs-nav" data-active={title === 'Hôm nay' || undefined}>
                <Icon size={16} strokeWidth={2} aria-hidden />
                <span className="hs-nav__title">{title}</span>
                {count !== undefined && <span className="hs-nav__count">{count}</span>}
              </span>
            ))}
          </span>
        </span>
      ))}
    </nav>
  );
}

function PanelHead({ icon, title, link }: { icon: ReactNode; title: ReactNode; link?: boolean }) {
  return (
    <span className="hs-panel__head">
      {icon}
      {title}
      {link && <Bar w={34} h={6} tone={3} className="hs-panel__link" />}
    </span>
  );
}

/** Example objectives (the same three as the week guide) and their status badges (lib/labels.ts objectiveStatuses) */
const HERO_OBJECTIVES: { title: string; status: string; tone: 'info' | 'success' }[] = [
  { title: 'Viết case study', status: 'Xong', tone: 'success' },
  { title: 'Ôn lại React hooks', status: 'Đang làm', tone: 'info' },
  { title: 'Gửi 2 báo giá', status: 'Đang làm', tone: 'info' },
];

const HERO_LABEL =
  "Màn hình Hôm nay của Alex's Brain: thanh bên chia theo nhóm như trong app, Hôm nay (đang mở) và Tuần ở trên, " +
  'rồi các nhóm Phát triển, Thư viện, Cơ hội và Công việc với trang của từng nhóm, biểu tượng cùng một màu xanh và ' +
  'số đếm ở cuối dòng; thanh trên có ô Tìm mọi thứ với phím tắt Cmd K và nút Inbox có số đếm; nội dung gồm Tiếp tục ' +
  'học (Nhánh và merge trong Git), 3 ưu tiên tuần (Viết case study, Ôn lại React hooks, Gửi 2 báo giá) và Inbox.';

/** The narrow window's top edge, in px from the slot's top. */
const NARROW_TOP = 20;

// The plate is the tile's own gray (a coloured stage), so the window is inset 8% of the tile's width on the
// top and both sides and runs off the bottom (framing rule 14). Narrow tiles keep a desktop-width window that
// runs off the right and the bottom instead. The sidebar gets the height left above the crop (fitSide).
export function HeroShell() {
  return (
    <Picture name="hero" label={HERO_LABEL} initial={{}}>
      {(_, { w, h }) => {
        const wide = w >= 600;
        const inset = Math.round(w * 0.08);
        const top = wide ? inset : NARROW_TOP;
        return (
          <Window
            className={wide ? 'hs-win' : 'hs-win hs-win--narrow'}
            style={
              wide
                ? { top, left: inset, width: w - 2 * inset, height: Math.round((h - inset) * 1.3) }
                : { top }
            }
            sidebarWidth={wide ? 200 : 172}
            sidebar={<ShellSidebar room={h - top - SIDE_TOP - SIDE.clear} />}
            lead={
              <span className="hs-search">
                <Search size={14} strokeWidth={2} aria-hidden />
                <span>Tìm mọi thứ...</span>
                {wide && <span className="hs-kbd">⌘ K</span>}
              </span>
            }
            toolbar={
              <span className="hs-tools">
                <span className="hs-btn">
                  <Inbox size={14} strokeWidth={2} aria-hidden />
                  <span>Inbox</span>
                  <span className="hs-count">3</span>
                </span>
                <span className="hs-btn hs-btn--icon">
                  <Sun size={14} strokeWidth={2} aria-hidden />
                </span>
              </span>
            }
          >
            <div className="hs-body">
              <span className="hs-head">
                <span className="hs-tile" aria-hidden>
                  <Sun size={16} strokeWidth={2} />
                </span>
                <span className="hs-title">Hôm nay</span>
              </span>
              <span className="hs-desc">Học tiếp, giữ 3 ưu tiên của tuần, dọn inbox và đọc bản tin sáng.</span>
              <span className="hs-continue">
                <span className="hs-continue__tag">
                  <span className="hs-dot" aria-hidden />
                  Tiếp tục học
                </span>
                <span className="hs-continue__text">
                  <span className="hs-continue__title">Nhánh và merge trong Git</span>
                  <Bar w={wide ? 132 : 90} h={6} tone={3} />
                </span>
                {wide && <span className="hs-primary">Học tiếp →</span>}
              </span>
              <span className="hs-panels">
                <span className="hs-panel">
                  <PanelHead
                    icon={
                      <CalendarRange size={14} strokeWidth={2} aria-hidden style={{ color: 'var(--ss-area-week)' }} />
                    }
                    title={<span className="hs-panel__title">3 ưu tiên tuần</span>}
                    link={wide}
                  />
                  {HERO_OBJECTIVES.map((o, i) => (
                    <span key={o.title} className="hs-objective">
                      <span className="hs-objective__n">{i + 1}.</span>
                      <span className="hs-objective__title">{o.title}</span>
                      <span className="ip-badge hs-objective__badge" data-tone={o.tone}>
                        {o.status}
                      </span>
                    </span>
                  ))}
                </span>
                {wide && (
                  <span className="hs-panel">
                    <PanelHead
                      icon={<Inbox size={14} strokeWidth={2} aria-hidden />}
                      title={<span className="hs-panel__title">Inbox</span>}
                      link
                    />
                    <span className="hs-inbox">
                      <span className="hs-inbox__n">3</span>
                      <Bar w={112} h={6} tone={3} />
                    </span>
                  </span>
                )}
              </span>
            </div>
          </Window>
        );
      }}
    </Picture>
  );
}

/* ------------------------------------------------------------------ Inbox: the list, triaged by keys */

type InboxS = { a: boolean; c: boolean; sel: 'a' | 'c' | 'b'; legend: 'jk' | 'l' | 'a' | 'o' | null };

const INBOX_START: InboxS = { a: true, c: true, sel: 'a', legend: null };
const INBOX_END: InboxS = { a: false, c: false, sel: 'b', legend: null };

const LEGEND: { id: Exclude<InboxS['legend'], null>; key: string; label: string }[] = [
  { id: 'jk', key: 'J / K', label: 'xuống / lên' },
  { id: 'l', key: 'L', label: 'đọc sau' },
  { id: 'a', key: 'A', label: 'lưu trữ' },
  { id: 'o', key: 'O', label: 'bằng chứng cho cơ hội' },
];

// L sends the top entry to Đọc sau, A archives the next; the cursor stays in place, so the tagged entry rises
// to the top with the keyboard cursor on it. That frame is the poster.
async function inboxScript(a: Act<InboxS>) {
  await a.wait(700);
  await a.key('l');
  await a.set({ legend: 'l', a: false, sel: 'c' });
  await a.wait(1100);
  await a.key('a');
  await a.set({ legend: 'a', c: false, sel: 'b' });
  await a.wait(1000);
  await a.set({ legend: null });
}

/** An entry the keys act on: thumbnail placeholder, a short real title and its domain (neutral examples). */
function EntryCard({ selected, title, meta }: { selected?: boolean; title: string; meta: string }) {
  return (
    <span className="ip-card" data-selected={selected || undefined}>
      <span className="ip-panel">
        <Bar w={44} h={44} r={12} tone={3} />
        <span className="ip-head">
          <span className="ip-title ip-title--entry">{title}</span>
          <span className="ip-meta">{meta}</span>
        </span>
      </span>
    </span>
  );
}

/** An entry that is not the story (below the focal card): placeholder lines. */
function FillerCard({ selected, title, meta }: { selected?: boolean; title: number; meta: number }) {
  return (
    <span className="ip-card" data-selected={selected || undefined}>
      <span className="ip-panel">
        <Bar w={44} h={44} r={12} tone={3} />
        <span className="ip-head ip-head--filler">
          <Bar w={40} h={14} r={5} tone={3} />
          <Bar w={title} h={8} r={3} tone={5} />
          <Bar w={meta} h={6} r={3} tone={3} />
        </span>
      </span>
    </span>
  );
}

const INBOX_LABEL =
  'Inbox xử lý bằng phím: hàng phím tắt J/K xuống lên, L đọc sau, A lưu trữ, O bằng chứng cho cơ hội. ' +
  'Nhấn L (CSS Grid: hướng dẫn đầy đủ) rồi A (Mẹo tập trung khi làm việc), hai mục rời danh sách; mục đã được gắn tag #postgres #tim-kiem và gợi ý Đọc sau lên đầu, đang được chọn.';

export function InboxTile() {
  return (
    <Picture name="inbox" label={INBOX_LABEL} initial={INBOX_START} poster={INBOX_END} script={inboxScript}>
      {(s, { w }) => (
        <div className="ip-col" data-narrow={w < 520 || undefined}>
          <span className="ip-legend">
            {LEGEND.map((h) => (
              <span key={h.id} className="ip-legend__item" data-on={s.legend === h.id || undefined}>
                <span className="ip-kbd">{h.key}</span>
                <span>{h.label}</span>
              </span>
            ))}
          </span>
          <Collapse open={s.a} reveal="drop">
            <span className="ip-gap">
              <EntryCard selected={s.sel === 'a'} title="CSS Grid: hướng dẫn đầy đủ" meta="developer.mozilla.org" />
            </span>
          </Collapse>
          <Collapse open={s.c} reveal="drop">
            <span className="ip-gap">
              <EntryCard selected={s.sel === 'c'} title="Mẹo tập trung khi làm việc" meta="dev.to" />
            </span>
          </Collapse>
          <span className="ip-gap">
            <span className="ip-card" data-selected={s.sel === 'b' || undefined}>
              <span className="ip-panel">
                <span className="ip-thumb" aria-hidden>
                  <span className="ip-thumb__line" style={{ width: 26 }} />
                  <span className="ip-thumb__line" data-faint style={{ width: 34 }} />
                </span>
                <span className="ip-head">
                  <span className="ip-badges">
                    <span className="ip-badge" data-tone="warning">
                      Inbox
                    </span>
                    <span className="ip-badge" data-tone="outline">
                      → Đọc sau
                    </span>
                  </span>
                  <span className="ip-title">Text search in Postgres</span>
                  <span className="ip-meta">postgresql.org</span>
                </span>
              </span>
              <span className="ip-tags">
                <span className="ip-badge" data-tone="outline">
                  #postgres
                </span>
                <span className="ip-badge" data-tone="outline">
                  #tim-kiem
                </span>
              </span>
            </span>
          </span>
          <span className="ip-gap">
            <FillerCard title={150} meta={84} />
          </span>
          <span className="ip-gap">
            <FillerCard title={120} meta={110} />
          </span>
          <span className="ip-gap">
            <FillerCard title={176} meta={96} />
          </span>
          <span className="ip-gap">
            <FillerCard title={140} meta={88} />
          </span>
        </div>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ ⌘K: two keycaps */

export function SearchTile() {
  return (
    <Picture name="search" label="Hai phím Command và K: phím tắt mở ô tìm kiếm chung." initial={{}}>
      {() => (
        <div className="sk-keys">
          <span className="sk-cap">⌘</span>
          <span className="sk-cap">K</span>
        </div>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ Tuần: hours for objectives vs other */

// Shares of the tallest day, not hours: the picture has no axis and no values (no numbers about the owner).
const DAYS: { day: string; f: number; o: number }[] = [
  { day: 'T2', f: 0.52, o: 0.22 },
  { day: 'T3', f: 0.66, o: 0.14 },
  { day: 'T4', f: 0.3, o: 0.42 },
  { day: 'T5', f: 0.6, o: 0.24 },
  { day: 'T6', f: 0.44, o: 0.3 },
  { day: 'T7', f: 0.14, o: 0.18 },
  { day: 'CN', f: 0, o: 0.08 },
];

export function WeekTile() {
  return (
    <Picture
      name="week"
      label="Biểu đồ cột theo ngày từ thứ Hai tới Chủ nhật: phần giờ cho mục tiêu của tuần ở dưới, giờ khác ở trên."
      initial={{}}
    >
      {() => (
        <div className="wk-chart">
          <span className="wk-legend">
            <span>
              <span className="wk-swatch" data-series="for" aria-hidden />
              Giờ cho mục tiêu
            </span>
            <span>
              <span className="wk-swatch" data-series="other" aria-hidden />
              Giờ khác
            </span>
          </span>
          <span className="wk-plot">
            <span className="wk-grid" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {DAYS.map((d) => (
              <span key={d.day} className="wk-day">
                <span className="wk-stack" style={{ height: `${(d.f + d.o) * 100}%` }}>
                  {d.o > 0 && <span className="wk-seg" data-series="other" data-top style={{ flexGrow: d.o }} />}
                  {d.f > 0 && <span className="wk-seg" data-series="for" style={{ flexGrow: d.f }} />}
                </span>
              </span>
            ))}
          </span>
          <span className="wk-days">
            {DAYS.map((d) => (
              <span key={d.day}>{d.day}</span>
            ))}
          </span>
        </div>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ Cơ hội: a hypothesis and its evidence */

const SCORES = [
  { label: 'Cơ hội', v: 7 },
  { label: 'Nỗi đau', v: 8 },
  { label: 'Khả thi', v: 6 },
  { label: 'Thời điểm', v: 7 },
];

export function OpportunityTile() {
  return (
    <Picture
      name="opp"
      label="Một cơ hội ví dụ, Đặt lịch online cho tiệm nail: bốn điểm tự chấm Cơ hội, Nỗi đau, Khả thi, Thời điểm, và hai bằng chứng: ủng hộ, nói chuyện với 3 tiệm nail; phản bác, đã có app đặt lịch miễn phí."
      initial={{}}
    >
      {() => (
        <div className="op-card">
          <span className="op-panel">
            <span className="ip-badges">
              <span className="ip-badge" data-tone="secondary">
                Chưa quyết
              </span>
            </span>
            <span className="op-title">Đặt lịch online cho tiệm nail</span>
            <span className="op-scores">
              {SCORES.map((x) => (
                <span key={x.label}>
                  <span className="op-scores__k">{x.label}</span>
                  <span className="op-scores__v">{x.v}</span>
                </span>
              ))}
            </span>
          </span>
          <span className="op-evidence">
            <span className="op-row">
              <span className="ip-badge" data-tone="success">
                Ủng hộ
              </span>
              <span className="op-row__text">Nói chuyện với 3 tiệm nail</span>
            </span>
            <span className="op-row">
              <span className="ip-badge" data-tone="error">
                Phản bác
              </span>
              <span className="op-row__text">Đã có app đặt lịch miễn phí</span>
            </span>
          </span>
        </div>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ Kỹ năng: tiles that fade */

type Fresh = 'fresh' | 'aging' | 'faded';
const FRESH_WORD: Record<Fresh, string> = { fresh: 'Còn mới', aging: 'Đang cũ dần', faded: 'Đã mờ' };

// Three named tiles, one per state; the rest are the same tiles in placeholder lines, bleeding off the tile.
const SKILLS: { name?: string; f: Fresh; w?: number }[] = [
  { name: 'Django', f: 'fresh' },
  { name: 'Docker', f: 'aging' },
  { f: 'fresh', w: 60 },
  { f: 'fresh', w: 70 },
  { name: 'Figma', f: 'faded' },
  { f: 'aging', w: 54 },
  { f: 'faded', w: 64 },
  { f: 'fresh', w: 48 },
  { f: 'faded', w: 58 },
  { f: 'aging', w: 66 },
  { f: 'fresh', w: 52 },
  { f: 'faded', w: 44 },
];

export function SkillsTile() {
  return (
    <Picture
      name="skills"
      label="Ma trận kỹ năng: Django còn mới, Docker đang cũ dần, Figma đã mờ. Kỹ năng không có bằng chứng mới thì nhạt màu dần."
      initial={{}}
    >
      {() => (
        <div className="sm-grid">
          {SKILLS.map((x, i) => (
            <span key={i} className="sm-tile" data-f={x.f}>
              {x.name ? (
                <>
                  <span className="sm-name">{x.name}</span>
                  <span className="sm-state">
                    <span className="sm-dot" aria-hidden />
                    {FRESH_WORD[x.f]}
                  </span>
                </>
              ) : (
                <>
                  <Bar w={x.w ?? 56} h={8} r={3} tone={4} className="sm-bar" />
                  <span className="sm-state">
                    <span className="sm-dot" aria-hidden />
                    <Bar w={40} h={6} r={3} tone={3} className="sm-bar" />
                  </span>
                </>
              )}
            </span>
          ))}
        </div>
      )}
    </Picture>
  );
}

/* ------------------------------------------------------------------ Bản tin sáng: one story, two taps */

export function BriefTile() {
  return (
    <Picture
      name="brief"
      label="Một tin trong bản tin sáng, Trợ lý viết code chạy offline ra mắt, có tag Công cụ mới và #ai, với các nút Đưa vào Inbox, hữu ích hoặc không, và Bằng chứng cho cơ hội."
      initial={{}}
    >
      {(_, { w }) => (
        <div className="bf-card" data-narrow={w < 400 || undefined}>
          <span className="op-panel">
            <span className="ip-badges">
              <span className="ip-badge" data-tone="secondary">
                Hacker News
              </span>
              <span className="ip-badge" data-tone="info">
                Công cụ mới
              </span>
              <span className="ip-badge" data-tone="outline">
                #ai
              </span>
            </span>
            <span className="bf-title">Trợ lý viết code chạy offline ra mắt</span>
            <Bar w={96} h={6} r={3} tone={3} />
          </span>
          <span className="bf-body">
            <Text filler w={220} className="bf-summary">
              Tóm tắt hai câu, vì sao đáng quan tâm.
            </Text>
            <span className="bf-actions">
              <span className="bf-btn">
                <Inbox size={14} strokeWidth={2} aria-hidden />
                Đưa vào Inbox
              </span>
              {/* The thumbs only where the four actions fit on one row */}
              {w >= 440 && (
                <>
                  <span className="bf-btn bf-btn--icon" aria-hidden>
                    <ThumbsUp size={14} strokeWidth={2} />
                  </span>
                  <span className="bf-btn bf-btn--icon" aria-hidden>
                    <ThumbsDown size={14} strokeWidth={2} />
                  </span>
                </>
              )}
              <span className="bf-btn">Bằng chứng cho cơ hội…</span>
            </span>
          </span>
        </div>
      )}
    </Picture>
  );
}
