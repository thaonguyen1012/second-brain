'use client';
import { useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { growthApi, type ApiSkillDetail, type ApiSkillEvidence } from '@/lib/api/growth';
import { useApi } from '@/lib/api/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MenuItem, MenuSeparator } from '@/components/ui/menu';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { ApiErrorState } from '../api-state';
import { StatusBadge } from '../brain-card';
import { ConfirmDelete } from '../confirm-delete';
import { RowMenu } from '../row-menu';
import { EvidenceForm } from './evidence-form';
import { evidenceKindLabel, formatDay, freshness } from './labels';

/**
 * One evidence row in the sheet's list (DESIGN.md §3 rows): kind and date as meta, the title (a link when it is
 * one), the note; edit and delete in the row menu, delete through the confirm dialog. Editing swaps the row for the
 * form, borderless inside the list.
 */
function EvidenceRow({
  evidence,
  skillId,
  onChanged,
}: {
  evidence: ApiSkillEvidence;
  skillId: number;
  onChanged: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (editing)
    return (
      <li>
        <EvidenceForm
          className="p-3"
          skillId={skillId}
          evidence={evidence}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );

  const isLink = evidence.kind === 'link' && /^https?:\/\//.test(evidence.url);
  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium break-words">
          {isLink ? (
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {evidence.title}
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-label={t('(mở tab mới)')} />
            </a>
          ) : (
            evidence.title
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(evidenceKindLabel[evidence.kind])} · {formatDay(evidence.date)}
        </p>
        {evidence.note && (
          <p className="pt-0.5 text-[13px] leading-relaxed whitespace-pre-line text-muted-foreground">
            {evidence.note}
          </p>
        )}
      </div>
      <RowMenu label={t('Thao tác với "{title}"', { title: evidence.title })}>
        <MenuItem onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          {t('Sửa')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden />
          {t('Xóa')}
        </MenuItem>
      </RowMenu>
      <ConfirmDelete
        open={deleting}
        onOpenChange={setDeleting}
        title={t('Xóa bằng chứng?')}
        description={t('"{title}" bị gỡ khỏi kỹ năng này; độ mới được tính lại. Không hoàn tác được.', {
          title: evidence.title,
        })}
        action={() => growthApi.deleteSkillEvidence(skillId, evidence.id)}
        onDeleted={onChanged}
      />
    </li>
  );
}

function SkillBody({
  id,
  version,
  onEdit,
  onChanged,
}: {
  id: number;
  version: number;
  onEdit: (skill: ApiSkillDetail) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const detail = useApi(`skill:${id}:${version}`, () => growthApi.getSkill(id));
  const [adding, setAdding] = useState(false);
  const skill = detail.data;

  const changed = () => {
    detail.reload();
    onChanged();
  };

  if (detail.error && !skill)
    return (
      <SheetPanel>
        <ApiErrorState error={detail.error} onRetry={detail.reload} />
      </SheetPanel>
    );
  if (!skill)
    return (
      <SheetPanel className="flex flex-col gap-3" aria-busy="true" aria-label={t('Đang tải')}>
        <Skeleton className="h-8 w-1/2 rounded-lg" />
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-36 rounded-xl" />
      </SheetPanel>
    );

  const f = freshness[skill.freshness];
  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2 pe-8">
          <span className={cn('size-3 shrink-0 rounded-full', f.dot)} aria-hidden />
          <SheetTitle>{skill.name}</SheetTitle>
        </div>
        <SheetDescription render={<div />} className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={f.tone}>{t(f.label)}</StatusBadge>
            <span>{t(f.hint)}</span>
          </span>
          {skill.aliases.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>{t('Tên khác:')}</span>
              {skill.aliases.map((a) => (
                <Badge key={a} variant="outline">
                  {a}
                </Badge>
              ))}
            </span>
          )}
        </SheetDescription>
      </SheetHeader>
      <SheetPanel className="flex flex-col gap-4">
        {skill.note && <p className="text-sm whitespace-pre-line">{skill.note}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(skill)}>
            <Pencil aria-hidden />
            {t('Sửa tên, tên khác, ghi chú')}
          </Button>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              {t('Thêm bằng chứng')}
            </Button>
          )}
        </div>
        {adding && (
          <EvidenceForm
            skillId={skill.id}
            evidence={null}
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              changed();
            }}
          />
        )}
        <section className="flex flex-col gap-2" aria-labelledby="evidence-title">
          <h3 id="evidence-title" className="text-sm font-semibold">
            {t('Bằng chứng')}
          </h3>
          {skill.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                'Chưa có bằng chứng: thứ đã ship, case study, bài viết công khai. Không có bằng chứng thì kỹ năng ở trạng thái mờ.',
              )}
            </p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {skill.evidence.map((e) => (
                <EvidenceRow key={e.id} evidence={e} skillId={skill.id} onChanged={changed} />
              ))}
            </ul>
          )}
        </section>
      </SheetPanel>
    </>
  );
}

/** One skill: freshness, aliases, evidence with add, edit and delete (GET /api/skills/{id}, evidence routes). */
export function SkillSheet({
  skillId,
  version,
  onClose,
  onEdit,
  onChanged,
}: {
  skillId: number | null;
  /** Bumped by the page after the skill itself was edited, to load it again. */
  version: number;
  onClose: () => void;
  onEdit: (skill: ApiSkillDetail) => void;
  onChanged: () => void;
}) {
  const t = useT();
  return (
    <Sheet open={skillId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetPopup closeProps={{ 'aria-label': t('Đóng') }} className="max-w-lg">
        {skillId !== null && <SkillBody key={skillId} id={skillId} version={version} onEdit={onEdit} onChanged={onChanged} />}
      </SheetPopup>
    </Sheet>
  );
}
