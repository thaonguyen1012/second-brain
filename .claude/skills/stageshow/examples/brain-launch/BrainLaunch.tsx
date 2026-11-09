import type { ReactNode } from 'react'
import {
  BookOpen,
  Briefcase,
  CalendarRange,
  Clock,
  Dumbbell,
  Inbox,
  Library,
  Lightbulb,
  Link2,
  MessageCircle,
  Newspaper,
  NotebookPen,
  PanelLeftClose,
  Search,
  Sun,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Check as CheckIcon,
  type LucideIcon,
} from 'lucide-react'
import { Bar, Check, Collapse, Count, Roll, Segmented, Stage, States, Text, Window, type Act } from '../../kit'
import './launch.css'

/*
 * Alex's Brain, a launch video for LinkedIn, X and Threads (square, 1080 x 1080 from a 640 design at 1.6875x).
 *
 * Plan: one app window told as one continuous object. A brand lockup opens; the window rises under it and each
 * scene is a page of the app, named by a caption above the window (feeds autoplay muted, so the captions carry
 * the story). The sidebar's current row moves with the page. Seven beats, each one action and its result:
 *
 *   Today      a priority ticked done
 *   Inbox      L and A triage two entries; the Inbox count falls 3 -> 1
 *   Search     Cmd+K, "postgres", results from four areas
 *   Week       R opens the review: time per day, share on objectives rolls to 68%
 *   Opportunity evidence for and against arrives, Pain re-scored 6 -> 8
 *   Skills     time-lapse: untouched skills age, then fade
 *   Brief      the morning brief card sent to the Inbox; the count rolls 1 -> 2
 *
 * The window sinks and the lockup returns with the stack line: the last frame is the first, so it loops too.
 * Gold copied: hero-demo (named targets, a cursor that only travels to act), payout-flow (unhurried arrivals,
 * payoffs that hold), fade-crop/raycast (a window inset top and sides, off the bottom).
 */

type Pane = 'today' | 'inbox' | 'week' | 'opp' | 'skills'
type Nav = 'today' | 'week' | 'skills' | 'opp' | null
type Fresh = 'fresh' | 'aging' | 'faded'

type S = {
  lockup: 'in' | 'out' | 'end'
  win: boolean
  cap: number
  pane: Pane
  nav: Nav
  hooksDone: boolean
  inboxCount: number
  inA: boolean
  inC: boolean
  sel: 'a' | 'c' | 'b'
  legend: 'l' | 'a' | null
  search: boolean
  q: string
  weekTab: 0 | 1
  share: number
  ev1: boolean
  ev2: boolean
  pain: number
  months: 0 | 3 | 6
  scrolled: boolean
  sent: boolean
}

const initial: S = {
  lockup: 'in',
  win: false,
  cap: 0,
  pane: 'today',
  nav: 'today',
  hooksDone: false,
  inboxCount: 3,
  inA: true,
  inC: true,
  sel: 'a',
  legend: null,
  search: false,
  q: '',
  weekTab: 0,
  share: 0,
  ev1: false,
  ev2: false,
  pain: 6,
  months: 0,
  scrolled: false,
  sent: false,
}

const POSTER: S = { ...initial, lockup: 'in' }

const CAPTIONS: { eyebrow: string; icon: LucideIcon; text: string }[] = [
  { eyebrow: '', icon: Sun, text: '' },
  { eyebrow: 'Today', icon: Sun, text: 'Start every day from one page.' },
  { eyebrow: 'Inbox', icon: Inbox, text: 'Capture anything. Triage it with one key.' },
  { eyebrow: 'Search', icon: Search, text: 'One search across lessons, notes and links.' },
  { eyebrow: 'Week', icon: CalendarRange, text: 'Three priorities a week, then an honest review.' },
  { eyebrow: 'Opportunities', icon: Lightbulb, text: 'Ideas are hypotheses. Evidence decides.' },
  { eyebrow: 'Skills', icon: Dumbbell, text: 'Skills fade unless fresh work proves them.' },
  { eyebrow: 'Morning brief', icon: Newspaper, text: 'The news that matters, one tap from your inbox.' },
]

async function goTo(a: Act<S>, target: string, patch: Partial<S>) {
  await a.move(target)
  await a.wait(120)
  await a.click()
  await a.set(patch)
}

async function script(a: Act<S>) {
  // The lockup, then the window rises under it
  await a.wait(2300)
  await a.set({ lockup: 'out', win: true, cap: 1 })
  await a.wait(1500)

  // Today: tick a priority
  await a.move('hooks-check')
  await a.wait(150)
  await a.click()
  await a.set({ hooksDone: true })
  await a.wait(1500)

  // Inbox: two keys, two decisions
  await goTo(a, 'inbox-btn', { pane: 'inbox', nav: null, cap: 2 })
  await a.move('rest-right')
  await a.wait(500)
  await a.key('l')
  await a.set({ legend: 'l', inA: false, sel: 'c', inboxCount: 2 })
  await a.wait(1100)
  await a.key('a')
  await a.set({ legend: 'a', inC: false, sel: 'b', inboxCount: 1 })
  await a.wait(1300)
  await a.set({ legend: null })

  // Search: Cmd+K across everything
  await a.key('cmd+k')
  await a.set({ search: true, cap: 3 })
  await a.wait(500)
  await a.type('q', 'postgres', { interval: 75 })
  await a.wait(2000)
  await a.key('esc')
  await a.set({ search: false })
  await a.wait(300)

  // Week: R opens the review
  await goTo(a, 'nav-week', { pane: 'week', nav: 'week', cap: 4 })
  await a.wait(900)
  await a.key('r')
  await a.set({ weekTab: 1 })
  await a.wait(500)
  await a.set({ share: 68 })
  await a.wait(2300)

  // Opportunity: evidence arrives, a score moves
  await goTo(a, 'nav-opp', { pane: 'opp', nav: 'opp', cap: 5 })
  await a.move('rest-right')
  await a.wait(500)
  await a.set({ ev1: true })
  await a.wait(900)
  await a.set({ ev2: true })
  await a.wait(900)
  await a.set({ pain: 8 })
  await a.wait(2000)

  // Skills: a time-lapse
  await goTo(a, 'nav-skills', { pane: 'skills', nav: 'skills', cap: 6 })
  await a.move('rest-right')
  await a.wait(800)
  await a.set({ months: 3 })
  await a.wait(1400)
  await a.set({ months: 6 })
  await a.wait(2000)

  // Morning brief: one tap to the Inbox
  await goTo(a, 'nav-today', { pane: 'today', nav: 'today', cap: 7, scrolled: true })
  await a.wait(900)
  await a.move({ at: 'send', x: 0.82, y: 0.6 })
  await a.wait(150)
  await a.click()
  await a.set({ sent: true })
  await a.wait(350)
  await a.set({ inboxCount: 2 })
  await a.wait(2200)

  // The lockup returns
  await a.move('rest-out')
  await a.set({ win: false, cap: 0, lockup: 'end' })
  await a.wait(4200)
}

/* ------------------------------------------------------------------ the sidebar */

type NavRow = { id?: Nav; title: string; icon: LucideIcon; count?: number }
const SIDE: { label?: string; rows: NavRow[] }[] = [
  {
    rows: [
      { id: 'today', title: 'Today', icon: Sun },
      { id: 'week', title: 'Week', icon: CalendarRange, count: 2 },
    ],
  },
  {
    label: 'Growth',
    rows: [
      { title: 'Handbooks', icon: BookOpen },
      { id: 'skills', title: 'Skills', icon: Dumbbell, count: 14 },
      { title: 'Market', icon: TrendingUp, count: 6 },
    ],
  },
  {
    label: 'Library',
    rows: [
      { title: 'Items', icon: Library, count: 48 },
      { title: 'Notes', icon: NotebookPen, count: 23 },
    ],
  },
  { label: 'Opportunities', rows: [{ id: 'opp', title: 'Opportunities', icon: Lightbulb, count: 3 }] },
  {
    label: 'Work',
    rows: [
      { title: 'Projects', icon: Briefcase, count: 2 },
      { title: 'Time', icon: Clock },
    ],
  },
]

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden className={className}>
      <path fill="#d97757" d="M61 62c-12-9-30-12-50-9-1 20-1 40 1 60 19-3 36 0 49 9 1-20 1-40 0-60z" />
      <path fill="#6a9bcc" d="M67 62c12-9 30-12 50-9 1 20 1 40-1 60-19-3-36 0-49 9-1-20-1-40 0-60z" />
      <path fill="#788c5d" d="M67 41c3-19 18-29 37-29-2 18-17 30-37 29zM63 50c-3-15-14-24-30-24 1 16 13 25 30 24z" />
      <path fill="none" stroke="currentColor" strokeWidth="6.4" strokeLinecap="round" d="M64 119c1-18 1-35 0-52-1-15 1-29 5-41" />
    </svg>
  )
}

function Sidebar({ nav }: { nav: Nav }) {
  return (
    <nav className="bl-side">
      <span className="bl-brand">
        <BrandMark className="bl-brand__mark" />
        <span className="bl-brand__name">Alex&apos;s Brain</span>
        <PanelLeftClose size={14} strokeWidth={2} aria-hidden className="bl-brand__hide" />
      </span>
      {SIDE.map((group, i) => (
        <span key={group.rows[0].title} className="bl-group">
          {i === 1 && <span className="bl-tier" aria-hidden />}
          {group.label && <span className="bl-label">{group.label}</span>}
          {group.rows.map(({ id, title, icon: Icon, count }) => (
            <span
              key={title}
              className="bl-nav"
              data-active={(id && id === nav) || undefined}
              data-target={id ? `nav-${id}` : undefined}
            >
              <Icon size={15} strokeWidth={2} aria-hidden />
              <span className="bl-nav__title">{title}</span>
              {count !== undefined && <span className="bl-nav__count">{count}</span>}
            </span>
          ))}
        </span>
      ))}
    </nav>
  )
}

/* ------------------------------------------------------------------ pages */

function PageHead({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <span className="bl-head">
      <Icon size={18} strokeWidth={2} aria-hidden />
      <span className="bl-title">{title}</span>
      {children}
    </span>
  )
}

const OBJECTIVES = [
  { id: 'case', title: 'Write a case study', done: true },
  { id: 'hooks', title: 'Revise React hooks', done: false },
  { id: 'quotes', title: 'Send 2 quotes', done: false },
]

function TodayPage({ s }: { s: S }) {
  return (
    <div className="bl-scroll" data-scrolled={s.scrolled || undefined}>
      <PageHead icon={Sun} title="Today" />
      <span className="bl-desc">Keep learning, stick to the week&apos;s 3 priorities, clear the inbox and read the morning brief.</span>
      <span className="bl-continue">
        <span className="bl-continue__tag">
          <span className="bl-dot" aria-hidden />
          Continue learning
        </span>
        <span className="bl-continue__text">
          <span className="bl-continue__title">Branching and merging in Git</span>
          <Bar w={96} h={6} tone={3} />
        </span>
      </span>
      <span className="bl-panel">
        <span className="bl-panel__head">
          <CalendarRange size={14} strokeWidth={2} aria-hidden />
          <span className="bl-panel__title">3 priorities</span>
          <Bar w={34} h={6} tone={3} className="bl-panel__link" />
        </span>
        {OBJECTIVES.map((o) => {
          const done = o.done || (o.id === 'hooks' && s.hooksDone)
          return (
            <span key={o.id} className="bl-obj" data-done={done || undefined}>
              <span className="bl-obj__check" data-target={`${o.id}-check`} data-cursor="pointer">
                <Check on={done} size={16} />
              </span>
              <span className="bl-obj__title">{o.title}</span>
              <States
                align="end"
                value={done ? 'done' : 'doing'}
                className="bl-obj__badge"
                states={{
                  doing: (
                    <span className="bl-badge" data-tone="info">
                      In progress
                    </span>
                  ),
                  done: (
                    <span className="bl-badge" data-tone="success">
                      Done
                    </span>
                  ),
                }}
              />
            </span>
          )
        })}
      </span>
      <span className="bl-panel bl-brief">
        <span className="bl-panel__head">
          <Newspaper size={14} strokeWidth={2} aria-hidden />
          <span className="bl-panel__title">Today&apos;s brief</span>
          <span className="bl-panel__meta">6:30</span>
        </span>
        <span className="bl-story">
          <span className="bl-story__panel">
            <span className="bl-badges">
              <span className="bl-badge" data-tone="secondary">
                Hacker News
              </span>
              <span className="bl-badge" data-tone="info">
                New tool
              </span>
              <span className="bl-badge" data-tone="outline">
                #ai
              </span>
            </span>
            <span className="bl-story__title">Offline coding assistant launches</span>
            <span className="bl-story__lines">
              <Bar w={300} h={6} tone={3} />
              <Bar w={220} h={6} tone={3} />
            </span>
          </span>
          <span className="bl-actions">
            <span className="bl-btn" data-target="send" data-cursor="pointer" data-sent={s.sent || undefined}>
              <States
                align="start"
                value={s.sent ? 'sent' : 'send'}
                states={{
                  send: (
                    <span className="bl-btn__in">
                      <Inbox size={14} strokeWidth={2} aria-hidden />
                      Send to Inbox
                    </span>
                  ),
                  sent: (
                    <span className="bl-btn__in">
                      <CheckIcon size={14} strokeWidth={2.4} aria-hidden />
                      In the Inbox
                    </span>
                  ),
                }}
              />
            </span>
            <span className="bl-btn bl-btn--icon" aria-hidden>
              <ThumbsUp size={14} strokeWidth={2} />
            </span>
            <span className="bl-btn bl-btn--icon" aria-hidden>
              <ThumbsDown size={14} strokeWidth={2} />
            </span>
            <span className="bl-btn">Evidence…</span>
          </span>
        </span>
        <span className="bl-story bl-story--next">
          <span className="bl-story__panel">
            <span className="bl-badges">
              <Bar w={64} h={18} r={6} tone={2} />
              <Bar w={40} h={18} r={6} tone={2} />
            </span>
            <Bar w={210} h={9} r={4} tone={4} />
          </span>
        </span>
      </span>
    </div>
  )
}

function EntryCard({ selected, title, meta }: { selected?: boolean; title: string; meta: string }) {
  return (
    <span className="bl-card" data-selected={selected || undefined}>
      <span className="bl-card__panel">
        <Bar w={44} h={44} r={12} tone={3} />
        <span className="bl-card__head">
          <span className="bl-card__title">{title}</span>
          <span className="bl-card__meta">{meta}</span>
        </span>
      </span>
    </span>
  )
}

function FillerCard({ title, meta }: { title: number; meta: number }) {
  return (
    <span className="bl-card">
      <span className="bl-card__panel">
        <Bar w={44} h={44} r={12} tone={3} />
        <span className="bl-card__head bl-card__head--filler">
          <Bar w={40} h={14} r={5} tone={3} />
          <Bar w={title} h={8} r={3} tone={5} />
          <Bar w={meta} h={6} r={3} tone={3} />
        </span>
      </span>
    </span>
  )
}

const LEGEND = [
  { id: 'jk', key: 'J / K', label: 'move' },
  { id: 'l', key: 'L', label: 'read later' },
  { id: 'a', key: 'A', label: 'archive' },
  { id: 'o', key: 'O', label: 'evidence' },
] as const

function InboxPage({ s }: { s: S }) {
  return (
    <div className="bl-page-in">
      <PageHead icon={Inbox} title="Inbox">
        <span className="bl-head__count">
          <Count value={s.inboxCount} />
        </span>
      </PageHead>
      <span className="bl-legend">
        {LEGEND.map((h) => (
          <span key={h.id} className="bl-legend__item" data-on={s.legend === h.id || undefined}>
            <span className="bl-kbd">{h.key}</span>
            <span>{h.label}</span>
          </span>
        ))}
      </span>
      <Collapse open={s.inA} reveal="drop">
        <span className="bl-gap">
          <EntryCard selected={s.sel === 'a'} title="CSS Grid: a complete guide" meta="developer.mozilla.org" />
        </span>
      </Collapse>
      <Collapse open={s.inC} reveal="drop">
        <span className="bl-gap">
          <EntryCard selected={s.sel === 'c'} title="Tips for staying focused at work" meta="dev.to" />
        </span>
      </Collapse>
      <span className="bl-gap">
        <span className="bl-card" data-selected={s.sel === 'b' || undefined}>
          <span className="bl-card__panel">
            <span className="bl-thumb" aria-hidden>
              <span className="bl-thumb__line" style={{ width: 26 }} />
              <span className="bl-thumb__line" data-faint style={{ width: 34 }} />
            </span>
            <span className="bl-card__head">
              <span className="bl-badges">
                <span className="bl-badge" data-tone="warning">
                  Inbox
                </span>
                <span className="bl-badge" data-tone="outline">
                  → Read later
                </span>
              </span>
              <span className="bl-card__title bl-card__title--big">Text search in Postgres</span>
              <span className="bl-card__meta">postgresql.org</span>
            </span>
          </span>
          <span className="bl-tags">
            <span className="bl-badge" data-tone="outline">
              #postgres
            </span>
            <span className="bl-badge" data-tone="outline">
              #search
            </span>
          </span>
        </span>
      </span>
      <span className="bl-gap">
        <FillerCard title={150} meta={84} />
      </span>
      <span className="bl-gap">
        <FillerCard title={120} meta={110} />
      </span>
      <span className="bl-gap">
        <FillerCard title={176} meta={96} />
      </span>
    </div>
  )
}

const DAYS = [
  { d: 'Mon', f: 0.52, o: 0.22 },
  { d: 'Tue', f: 0.66, o: 0.14 },
  { d: 'Wed', f: 0.3, o: 0.42 },
  { d: 'Thu', f: 0.6, o: 0.24 },
  { d: 'Fri', f: 0.44, o: 0.3 },
  { d: 'Sat', f: 0.14, o: 0.18 },
  { d: 'Sun', f: 0, o: 0.08 },
]

function WeekPage({ s }: { s: S }) {
  const review = s.weekTab === 1
  return (
    <div className="bl-page-in">
      <PageHead icon={CalendarRange} title="Week">
        <span className="bl-head__meta">Nov 2 – 8</span>
      </PageHead>
      <Segmented className="bl-seg" items={['Plan', 'Review']} value={s.weekTab} />
      <div className="bl-week">
        <div className="bl-week__layer" data-show={!review || undefined}>
          {OBJECTIVES.map((o, i) => (
            <span key={o.id} className="bl-card bl-objcard">
              <span className="bl-objcard__n">{i + 1}</span>
              <span className="bl-objcard__title">{o.title}</span>
              <span className="bl-badge" data-tone={i < 2 ? 'success' : 'info'}>
                {i < 2 ? 'Done' : 'In progress'}
              </span>
            </span>
          ))}
          <span className="bl-add">
            <Bar w={14} h={14} r={4} tone={2} />
            <Bar w={150} h={7} tone={2} />
          </span>
        </div>
        <div className="bl-week__layer" data-show={review || undefined}>
          <span className="bl-card bl-review">
            <span className="bl-stat">
              <span className="bl-stat__n">
                <Count value={s.share} duration={900} />
                <span className="bl-stat__unit">%</span>
              </span>
              <span className="bl-stat__label">of tracked time went to this week&apos;s objectives</span>
            </span>
            <span className="bl-legend bl-legend--chart">
              <span>
                <span className="bl-swatch" data-series="for" aria-hidden />
                Time for objectives
              </span>
              <span>
                <span className="bl-swatch" data-series="other" aria-hidden />
                Other time
              </span>
            </span>
            <span className="bl-plot">
              <span className="bl-grid" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {DAYS.map((d, i) => (
                <span key={d.d} className="bl-day">
                  <span
                    className="bl-stack"
                    data-grow={review || undefined}
                    style={{ height: `${(d.f + d.o) * 100}%`, transitionDelay: review ? `${150 + i * 70}ms` : '0ms' }}
                  >
                    {d.o > 0 && <span className="bl-seg-bar" data-series="other" style={{ flexGrow: d.o }} />}
                    {d.f > 0 && <span className="bl-seg-bar" data-series="for" style={{ flexGrow: d.f }} />}
                  </span>
                </span>
              ))}
            </span>
            <span className="bl-days">
              {DAYS.map((d) => (
                <span key={d.d}>{d.d}</span>
              ))}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

const SCORES = [
  { k: 'Opportunity', v: 7 },
  { k: 'Pain', v: 6 },
  { k: 'Feasibility', v: 6 },
  { k: 'Timing', v: 7 },
]

function OppPage({ s }: { s: S }) {
  return (
    <div className="bl-page-in">
      <PageHead icon={Lightbulb} title="Opportunities" />
      <span className="bl-card bl-opp">
        <span className="bl-story__panel">
          <span className="bl-badges">
            <span className="bl-badge" data-tone="secondary">
              Undecided
            </span>
            <span className="bl-badge" data-tone="outline">
              Decide by Dec 15
            </span>
          </span>
          <span className="bl-story__title">Online booking for nail salons</span>
          <Text filler w={300} className="bl-opp__hyp">
            Salons lose bookings to missed calls.
          </Text>
          <span className="bl-scores">
            {SCORES.map((x) => (
              <span key={x.k} className="bl-score" data-moved={(x.k === 'Pain' && s.pain !== 6) || undefined}>
                <span className="bl-score__k">{x.k}</span>
                <span className="bl-score__v">{x.k === 'Pain' ? <Count value={s.pain} /> : x.v}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="bl-evidence">
          <span className="bl-evidence__label">Evidence</span>
          <Collapse open={s.ev1} reveal="drop">
            <span className="bl-ev">
              <span className="bl-badge" data-tone="success">
                For
              </span>
              <MessageCircle size={14} strokeWidth={2} aria-hidden className="bl-ev__icon" />
              <span className="bl-ev__text">Talked to 3 nail salons</span>
            </span>
          </Collapse>
          <Collapse open={s.ev2} reveal="drop">
            <span className="bl-ev">
              <span className="bl-badge" data-tone="error">
                Against
              </span>
              <Link2 size={14} strokeWidth={2} aria-hidden className="bl-ev__icon" />
              <span className="bl-ev__text">Free booking apps already exist</span>
            </span>
          </Collapse>
          <span className="bl-ev bl-ev--filler">
            <Bar w={44} h={18} r={6} tone={2} />
            <Bar w={170} h={7} tone={2} />
          </span>
          <span className="bl-ev bl-ev--filler">
            <Bar w={44} h={18} r={6} tone={2} />
            <Bar w={130} h={7} tone={2} />
          </span>
          <span className="bl-ev bl-ev--filler">
            <Bar w={44} h={18} r={6} tone={2} />
            <Bar w={190} h={7} tone={2} />
          </span>
        </span>
      </span>
    </div>
  )
}

const FRESH_WORD: Record<Fresh, string> = { fresh: 'Fresh', aging: 'Ageing', faded: 'Faded' }

// Each named skill at 0, 3 and 6 months without new evidence (React keeps getting some)
const SKILLS: { name?: string; at: [Fresh, Fresh, Fresh]; w?: number }[] = [
  { name: 'Django', at: ['fresh', 'fresh', 'fresh'] },
  { name: 'React', at: ['fresh', 'fresh', 'fresh'] },
  { name: 'Docker', at: ['fresh', 'aging', 'aging'] },
  { name: 'Figma', at: ['fresh', 'aging', 'faded'] },
  { name: 'Postgres', at: ['fresh', 'fresh', 'aging'] },
  { name: 'Kubernetes', at: ['aging', 'faded', 'faded'] },
  { at: ['fresh', 'fresh', 'fresh'], w: 54 },
  { at: ['aging', 'aging', 'faded'], w: 64 },
  { at: ['fresh', 'aging', 'aging'], w: 48 },
  { at: ['fresh', 'fresh', 'aging'], w: 60 },
  { at: ['aging', 'faded', 'faded'], w: 50 },
  { at: ['fresh', 'fresh', 'fresh'], w: 66 },
]

function SkillsPage({ s }: { s: S }) {
  const step = s.months === 0 ? 0 : s.months === 3 ? 1 : 2
  return (
    <div className="bl-page-in">
      <PageHead icon={Dumbbell} title="Skills">
        <span className="bl-lapse" data-on={s.months > 0 || undefined}>
          <Clock size={12} strokeWidth={2.2} aria-hidden />
          <Roll variant="fade">{s.months === 0 ? "Today" : `${s.months} months later`}</Roll>
        </span>
      </PageHead>
      <span className="bl-skills">
        {SKILLS.map((x, i) => {
          const f = x.at[step]
          return (
            <span key={i} className="bl-skill" data-f={f}>
              {x.name ? <span className="bl-skill__name">{x.name}</span> : <Bar w={x.w ?? 56} h={8} r={3} tone={4} className="bl-skill__bar" />}
              <span className="bl-skill__state">
                <span className="bl-skill__dot" aria-hidden />
                {x.name ? <Roll variant="fade">{FRESH_WORD[f]}</Roll> : <Bar w={40} h={6} r={3} tone={3} className="bl-skill__bar" />}
              </span>
            </span>
          )
        })}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ search */

const RESULTS: { group: string; icon: LucideIcon; title: string; meta: string; at: number }[] = [
  { group: 'Handbooks', icon: BookOpen, title: 'Full-text search in PostgreSQL', meta: 'Databases', at: 3 },
  { group: 'Library', icon: Library, title: 'Text search in Postgres', meta: 'Article', at: 4 },
  { group: 'Notes', icon: NotebookPen, title: 'Postgres search: tsvector or trigram?', meta: 'Note', at: 5 },
  { group: 'Inbox', icon: Inbox, title: 'pgvector 0.8 release notes', meta: 'github.com', at: 6 },
]

function SearchDialog({ s }: { s: S }) {
  return (
    <div className="bl-search" data-show={s.search || undefined}>
      <span className="bl-search__field">
        <Search size={16} strokeWidth={2} aria-hidden />
        <span className="bl-search__q" data-target="q" data-cursor="ibeam">
          {s.q ? s.q : <span className="bl-search__ph">Search everything...</span>}
          <span className="bl-caret" aria-hidden />
        </span>
        <span className="bl-kbd">esc</span>
      </span>
      <span className="bl-search__list">
        {RESULTS.map((r, i) => {
          const Icon = r.icon
          return (
            <Collapse key={r.title} open={s.q.length >= r.at}>
              <span className="bl-result__group">{r.group}</span>
              <span className="bl-result" data-first={i === 0 || undefined}>
                <Icon size={15} strokeWidth={2} aria-hidden />
                <span className="bl-result__title">{r.title}</span>
                <span className="bl-result__meta">{r.meta}</span>
              </span>
            </Collapse>
          )
        })}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ the film */

function Lockup({ state }: { state: S['lockup'] }) {
  return (
    <div className="bl-lockup" data-state={state}>
      <BrandMark className="bl-lockup__mark" />
      <span className="bl-lockup__name">Alex&apos;s Brain</span>
      <span className="bl-lockup__tag">A self-hosted second brain for learning, work and what comes next.</span>
      <span className="bl-lockup__stack">Next.js · Django · Postgres · built with an AI agent</span>
    </div>
  )
}

export function BrainLaunch() {
  return (
    <Stage
      width={640}
      height={640}
      initial={initial}
      poster={POSTER}
      script={script}
      play="once"
      keys="bottom"
      cursor={{ at: 'rest-out', style: 'large' }}
      className="bl"
    >
      {(s) => (
        <>
          <Lockup state={s.lockup} />

          <div className="bl-captions" aria-live="polite">
            {CAPTIONS.map((c, i) =>
              i === 0 ? null : (
                <div key={c.eyebrow} className="bl-cap" data-state={s.cap === i ? 'on' : s.cap > i || s.cap === 0 && s.lockup === 'end' ? 'past' : 'next'}>
                  <span className="bl-cap__eyebrow">
                    <c.icon size={14} strokeWidth={2.2} aria-hidden />
                    {c.eyebrow}
                  </span>
                  <span className="bl-cap__text">{c.text}</span>
                </div>
              ),
            )}
          </div>

          <div className="bl-winwrap" data-show={s.win || undefined}>
            <Window
              className="bl-win"
              sidebarWidth={150}
              sidebar={<Sidebar nav={s.nav} />}
              lead={
                <span className="bl-searchbox">
                  <Search size={13} strokeWidth={2} aria-hidden />
                  <span>Search everything...</span>
                  <span className="bl-kbd bl-kbd--small">⌘ K</span>
                </span>
              }
              toolbar={
                <span className="bl-tools">
                  <span className="bl-tbtn" data-target="inbox-btn" data-cursor="pointer" data-on={s.pane === 'inbox' || undefined}>
                    <Inbox size={13} strokeWidth={2} aria-hidden />
                    <span>Inbox</span>
                    <span className="bl-count">
                      <Count value={s.inboxCount} />
                    </span>
                  </span>
                </span>
              }
            >
              <div className="bl-main">
                <div className="bl-page" data-show={s.pane === 'today' || undefined}>
                  <TodayPage s={s} />
                </div>
                <div className="bl-page" data-show={s.pane === 'inbox' || undefined}>
                  <InboxPage s={s} />
                </div>
                <div className="bl-page" data-show={s.pane === 'week' || undefined}>
                  <WeekPage s={s} />
                </div>
                <div className="bl-page" data-show={s.pane === 'opp' || undefined}>
                  <OppPage s={s} />
                </div>
                <div className="bl-page" data-show={s.pane === 'skills' || undefined}>
                  <SkillsPage s={s} />
                </div>
              </div>
            </Window>
            <div className="bl-scrim" data-show={s.search || undefined} />
            <SearchDialog s={s} />
          </div>

          <span data-target="rest-right" className="bl-anchor" style={{ left: 618, top: 372 }} />
          <span data-target="rest-out" className="bl-anchor" style={{ left: 600, top: 700 }} />
        </>
      )}
    </Stage>
  )
}
