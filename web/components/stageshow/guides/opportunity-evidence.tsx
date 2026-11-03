'use client';
import { Gauge, Lightbulb, Link2, MessagesSquare, Pencil, Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Stage } from '../kit/stage';
import type { Act } from '../kit/act';
import { Collapse } from '../kit/motion/Collapse';
import { Field } from '../kit/controls/Field';
import { useBrainLook } from '../brain-look';
import { GBadge, GButton, GCard, GDialog, GMenu, GRow, GScrim, GSelect, GUIDE_SIZE } from './parts';
import './opportunity-evidence.css';

// How an opportunity is worked, played once (about 15 s). The screens are the real Cơ hội pages
// (components/brain/opportunities/) simplified: the "Cơ hội mới" dialog over the list, the new card, then the
// detail page with "Điểm tự chấm" and "Bằng chứng", the evidence dialog and the "Chấm điểm lại" dialog.
//
// Beats: the hypothesis is written and the opportunity created; it is opened; a conversation is added as
// evidence for it (Ủng hộ), a link as evidence against it (Phản bác, picked in the select); S scores the four
// axes and the tiles fill. The poster is that end frame: both kinds of evidence and the four scores.
//
// Built from the Stageshow gold `stacked-cards` (the page's cards in one column on the well) with the dialogs
// of `ai-cards` (a card of choices answered and kept) and `form-error` (play once, hold the payoff). The
// opportunity, the evidence and the scores are a neutral example, not the owner's.

type Dialog = 'create' | 'evidence' | 'score' | null;

type S = {
  page: 'list' | 'detail';
  dialog: Dialog;
  hyp: string;
  created: boolean;
  kind: 'conversation' | 'link';
  against: boolean;
  menu: boolean;
  evTitle: string;
  evUrl: string;
  ev1: boolean;
  ev2: boolean;
  /** Score fields filled in the dialog (0-4), then `scored` once saved */
  filled: number;
  scored: boolean;
};

const TITLE = 'Mẫu hợp đồng cho freelancer';
const HYP = 'Freelancer mới vào nghề trả tiền cho mẫu hợp đồng dễ hiểu.';
const EV1 = 'Kế toán của một văn phòng dịch vụ';
const EV2 = 'Mẫu miễn phí trên một diễn đàn';

const initial: S = {
  page: 'list',
  dialog: 'create',
  hyp: '',
  created: false,
  kind: 'conversation',
  against: false,
  menu: false,
  evTitle: '',
  evUrl: '',
  ev1: false,
  ev2: false,
  filled: 0,
  scored: false,
};

const POSTER: S = {
  ...initial,
  page: 'detail',
  dialog: null,
  hyp: HYP,
  created: true,
  ev1: true,
  ev2: true,
  filled: 4,
  scored: true,
};

/** Where the cursor rests, off the content, in each design */
const REST = { wide: { x: 560, y: 425 }, compact: { x: 330, y: 445 } };

/** The four self-scores (labels.ts scoreDims) with an example value each. */
const SCORES = [
  { label: 'Cơ hội', value: 6 },
  { label: 'Nỗi đau', value: 7 },
  { label: 'Khả thi', value: 8 },
  { label: 'Thời điểm', value: 5 },
];

async function script(a: Act<S>) {
  await a.wait(500);

  // 1. The hypothesis: who, what pain, what they pay for; then "Tạo cơ hội"
  a.mark('create');
  await a.type('hyp', HYP, { interval: 20 });
  await a.wait(300);
  await a.click('create');
  await a.set({ dialog: null, created: true });
  await a.wait(800);
  await a.click('open');
  await a.set({ page: 'detail' });
  await a.wait(700);

  // 2. Evidence for: a real conversation, Ủng hộ by default
  a.mark('for');
  await a.click('add-conversation');
  await a.set({ dialog: 'evidence', kind: 'conversation', against: false });
  await a.wait(350);
  await a.type('evTitle', EV1, { interval: 20 });
  await a.wait(200);
  await a.click('add-evidence');
  await a.set({ dialog: null });
  await a.wait(150);
  await a.set({ ev1: true });
  await a.wait(500);
  await a.snap({ evTitle: '' });

  // 3. Evidence against: a link, Phản bác picked in "Ủng hộ hay phản bác"
  a.mark('against');
  await a.click('add-link');
  await a.set({ dialog: 'evidence', kind: 'link', evUrl: 'https://diendan.example/mau-hop-dong' });
  await a.wait(300);
  await a.click('stance');
  await a.set({ menu: true });
  await a.wait(250);
  await a.click('stance-against');
  await a.set({ against: true, menu: false });
  await a.wait(200);
  await a.type('evTitle', EV2, { interval: 20 });
  await a.wait(200);
  await a.click('add-evidence');
  await a.set({ dialog: null });
  await a.wait(150);
  await a.set({ ev2: true });
  await a.wait(600);

  // 4. S: the four scores, 1 to 10; the tiles fill (the payoff, held)
  a.mark('score');
  await a.key('s');
  await a.set({ dialog: 'score' });
  await a.wait(300);
  for (let i = 1; i <= 4; i++) {
    await a.set({ filled: i });
    await a.wait(130);
  }
  await a.click('save-score');
  await a.set({ dialog: null });
  await a.wait(150);
  await a.set({ scored: true });
  await a.move(REST);
  await a.wait(2000);
}

function ListPage({ s, compact }: { s: S; compact: boolean }) {
  return (
    <div className="op-page" data-show={s.page === 'list' || undefined}>
      <div className="op-toolbar">
        <GSelect value="Mọi quyết định" className="op-filter" />
        {!compact && <GSelect value="Mọi tình trạng" className="op-filter" />}
        <GButton icon={Plus} kbd={compact ? undefined : 'N'} className="op-new">
          Cơ hội mới
        </GButton>
      </div>
      <Collapse open={!s.created}>
        <div className="op-empty">
          <span className="op-empty__icon">
            <Lightbulb size={16} strokeWidth={2} aria-hidden />
          </span>
          <span className="op-empty__title">Chưa có cơ hội nào</span>
          <span className="g-desc">Ghi một giả thuyết: ai, đau gì, trả tiền cho gì.</span>
        </div>
      </Collapse>
      <Collapse open={s.created} reveal="drop">
        <div className="g-brain">
          <div className="g-brain__panel">
            <span className="g-brain__badges">
              <GBadge tone="secondary">Chưa quyết</GBadge>
            </span>
            <span className="g-brain__title">{TITLE}</span>
            <span className="op-meta">
              <span>
                <ThumbsUp size={12} strokeWidth={2} aria-hidden />0 ủng hộ
              </span>
              <span>
                <ThumbsDown size={12} strokeWidth={2} aria-hidden />0 phản bác
              </span>
            </span>
          </div>
          <div className="g-brain__body">
            <span className="g-actions">
              <GButton size="xs" name="open">
                Mở
              </GButton>
              <GButton size="xs" variant="outline" icon={Pencil}>
                Sửa
              </GButton>
            </span>
          </div>
        </div>
      </Collapse>
    </div>
  );
}

function EvidenceRow({ against }: { against: boolean }) {
  return (
    <div className="op-ev">
      <span className="op-ev__badges">
        <GBadge tone={against ? 'error' : 'success'}>{against ? 'Phản bác' : 'Ủng hộ'}</GBadge>
        <GBadge tone="secondary">{against ? 'Link' : 'Cuộc nói chuyện'}</GBadge>
      </span>
      <span className="op-ev__title">{against ? EV2 : EV1}</span>
    </div>
  );
}

function DetailPage({ s, compact }: { s: S; compact: boolean }) {
  return (
    <div className="op-page" data-show={s.page === 'detail' || undefined}>
      <div className="op-head">
        <span className="g-brain__badges">
          <GBadge tone="secondary">Chưa quyết</GBadge>
        </span>
        <span className="op-title">{TITLE}</span>
        <span className="op-hyp">{HYP}</span>
      </div>

      <GCard
        title="Điểm tự chấm"
        action={
          <GButton size={compact ? 'xs' : 'sm'} icon={Gauge} kbd={compact ? undefined : 'S'}>
            Chấm điểm
          </GButton>
        }
      >
        <Collapse open={!s.scored}>
          <span className="g-desc op-noscore">Chưa chấm lần nào. Chấm 4 điểm để bắt đầu lịch sử.</span>
        </Collapse>
        <Collapse open={s.scored} reveal="drop">
          <div className="op-scores">
            {SCORES.map((d) => (
              <span key={d.label} className="op-score">
                <span className="op-score__label">{d.label}</span>
                <span className="op-score__value">
                  {d.value}
                  <span className="op-score__of">/10</span>
                </span>
                <span className="op-score__plot" aria-hidden>
                  <span className="op-score__dot" style={{ bottom: `${((d.value - 1) / 9) * 100}%` }} />
                </span>
              </span>
            ))}
          </div>
        </Collapse>
      </GCard>

      <GCard
        title="Bằng chứng"
        className="op-evcard"
        action={
          <>
            <GButton
              size={compact ? 'xs' : 'sm'}
              variant="outline"
              icon={MessagesSquare}
              kbd={compact ? undefined : 'C'}
              name="add-conversation"
            >
              Cuộc nói chuyện
            </GButton>
            <GButton
              size={compact ? 'xs' : 'sm'}
              variant="outline"
              icon={Link2}
              kbd={compact ? undefined : 'L'}
              name="add-link"
            >
              Link
            </GButton>
          </>
        }
      >
        <Collapse open={!s.ev1}>
          <div className="op-noev">Chưa có bằng chứng</div>
        </Collapse>
        <div className="op-evs">
          <Collapse open={s.ev2} reveal="drop">
            <div className="op-gap">
              <EvidenceRow against />
            </div>
          </Collapse>
          <Collapse open={s.ev1} reveal="drop">
            <div className="op-gap">
              <EvidenceRow against={false} />
            </div>
          </Collapse>
        </div>
      </GCard>
    </div>
  );
}

const LABEL =
  'Hình minh họa trang Cơ hội: viết một giả thuyết (ai, đau gì, trả tiền cho gì) trong hộp thoại Cơ hội mới rồi bấm Tạo cơ hội; mở cơ hội vừa tạo; ' +
  'thêm một cuộc nói chuyện làm bằng chứng ủng hộ và một link làm bằng chứng phản bác; nhấn S để chấm bốn điểm từ 1 đến 10: ' +
  'cơ hội, nỗi đau, khả thi, thời điểm.';

export default function OpportunityEvidenceGuide({ className }: { className?: string }) {
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
        cursor={{ at: REST, style: 'arrow' }}
        className="ssg-brain ssg-opp"
        {...look}
      >
        {(s, rect, layout) => {
          const compact = layout === 'compact';
          const stance = s.dialog === 'evidence' ? rect('stance') : null;
          return (
            <>
              <div className="g-col op-col">
                <ListPage s={s} compact={compact} />
                <DetailPage s={s} compact={compact} />
              </div>

              <GScrim show={s.dialog !== null} />
              <GDialog
                show={s.dialog === 'create'}
                className="op-dialog"
                title="Cơ hội mới"
                desc="Một giả thuyết của mình, sẽ được giữ, bỏ hoặc làm khi đủ bằng chứng."
                foot={
                  <>
                    <GButton variant="ghost">Hủy</GButton>
                    <GButton name="create">Tạo cơ hội</GButton>
                  </>
                }
              >
                <GRow label="Tên">
                  <span className="g-box">{TITLE}</span>
                </GRow>
                <Field
                  className="g-field op-hypfield"
                  label="Giả thuyết (một câu: ai, đau gì, trả tiền cho gì)"
                  value={s.hyp}
                  focused={s.dialog === 'create'}
                />
              </GDialog>

              <GDialog
                show={s.dialog === 'evidence'}
                className="op-dialog"
                title="Thêm bằng chứng"
                desc={compact ? undefined : 'Cuộc nói chuyện thật hoặc một nguồn bên ngoài.'}
                foot={
                  <>
                    <GButton variant="ghost">Hủy</GButton>
                    <GButton name="add-evidence">Thêm bằng chứng</GButton>
                  </>
                }
              >
                <GRow label="Ủng hộ hay phản bác">
                  <GSelect value={s.against ? 'Phản bác' : 'Ủng hộ'} name="stance" open={s.menu} />
                </GRow>
                <Field
                  className="g-field"
                  label={s.kind === 'conversation' ? 'Nói chuyện với ai (vai trò, công ty)' : 'Tiêu đề'}
                  value={s.evTitle}
                  focused={s.dialog === 'evidence' && !s.menu}
                />
                {s.kind === 'link' && (
                  <GRow label="Link">
                    <span className="g-box op-url">{s.evUrl}</span>
                  </GRow>
                )}
              </GDialog>

              <GDialog
                show={s.dialog === 'score'}
                className="op-dialog"
                title="Chấm điểm lại"
                desc="Mỗi điểm từ 1 đến 10. Lần chấm cũ được giữ làm lịch sử."
                foot={
                  <>
                    <GButton variant="ghost">Hủy</GButton>
                    <GButton name="save-score">Lưu điểm</GButton>
                  </>
                }
              >
                <div className="op-scoregrid">
                  {SCORES.map((d, i) => (
                    <GRow key={d.label} label={d.label}>
                      <span className="g-box" data-focused={(s.filled === i + 1 && s.dialog === 'score') || undefined}>
                        {i < s.filled ? d.value : ''}
                      </span>
                    </GRow>
                  ))}
                </div>
              </GDialog>

              <GMenu
                show={s.menu}
                className="op-menu"
                on={s.against ? 1 : 0}
                items={[{ label: 'Ủng hộ' }, { label: 'Phản bác', name: 'stance-against' }]}
                {...(stance && stance.width > 0
                  ? { style: { top: stance.y + stance.height + 4, left: stance.x, width: stance.width } }
                  : {})}
              />
            </>
          );
        }}
      </Stage>
    </div>
  );
}
