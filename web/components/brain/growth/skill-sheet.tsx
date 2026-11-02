'use client';
import { useState } from 'react';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { growthApi, type ApiSkillDetail, type ApiSkillEvidence } from '@/lib/api/growth';
import { toApiError, useApi } from '@/lib/api/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiErrorState, describeApiError } from '../api-state';
import { StatusBadge } from '../brain-card';
import { EvidenceForm } from './evidence-form';
import { evidenceKindLabel, formatDay, freshness } from './labels';

function EvidenceRow({
  evidence,
  skillId,
  onChanged,
  onError,
}: {
  evidence: ApiSkillEvidence;
  skillId: number;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (editing)
    return (
      <li>
        <EvidenceForm
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

  const remove = async () => {
    setBusy(true);
    try {
      await growthApi.deleteSkillEvidence(skillId, evidence.id);
      onChanged();
    } catch (err) {
      onError(describeApiError(toApiError(err)).title);
      setBusy(false);
      setConfirming(false);
    }
  };

  const isLink = evidence.kind === 'link' && /^https?:\/\//.test(evidence.url);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{evidenceKindLabel[evidence.kind]}</Badge>
        <span className="text-xs text-muted-foreground">{formatDay(evidence.date)}</span>
      </div>
      <p className="text-sm font-medium break-words">
        {isLink ? (
          <a
            href={evidence.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            {evidence.title}
            <ExternalLink className="size-3.5 shrink-0" aria-label="(mở tab mới)" />
          </a>
        ) : (
          evidence.title
        )}
      </p>
      {evidence.note && <p className="text-sm whitespace-pre-line text-muted-foreground">{evidence.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Sửa
        </Button>
        {confirming ? (
          <>
            <Button size="xs" variant="destructive" onClick={() => void remove()} disabled={busy} autoFocus>
              Xóa hẳn
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
              Giữ lại
            </Button>
          </>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Xóa
          </Button>
        )}
      </div>
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
  const detail = useApi(`skill:${id}:${version}`, () => growthApi.getSkill(id));
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
      <SheetPanel className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải">
        <Skeleton className="h-8 w-1/2 rounded-xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
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
            <StatusBadge tone={f.tone}>{f.label}</StatusBadge>
            <span>{f.hint}</span>
          </span>
          {skill.aliases.length > 0 && (
            <span className="flex flex-wrap items-center gap-1.5">
              <span>Tên khác:</span>
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
            Sửa tên, tên khác, ghi chú
          </Button>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden />
              Thêm bằng chứng
            </Button>
          )}
        </div>
        {notice && (
          <p className="text-sm text-destructive-foreground" role="alert">
            {notice}
          </p>
        )}
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
            Bằng chứng
          </h3>
          {skill.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có bằng chứng: thứ đã ship, case study, bài viết công khai. Không có bằng chứng thì kỹ năng ở trạng
              thái mờ.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {skill.evidence.map((e) => (
                <EvidenceRow key={e.id} evidence={e} skillId={skill.id} onChanged={changed} onError={setNotice} />
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
  return (
    <Sheet open={skillId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetPopup closeProps={{ 'aria-label': 'Đóng' }} className="max-w-lg">
        {skillId !== null && <SkillBody key={skillId} id={skillId} version={version} onEdit={onEdit} onChanged={onChanged} />}
      </SheetPopup>
    </Sheet>
  );
}
