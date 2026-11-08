'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { weeksApi, type ApiAchievement } from '@/lib/api/weeks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { WriteError } from '../tuan/week-section';

/**
 * A one-line brag entry (POST /api/achievements): what was done and its number, dated `date`. Used in the Tuần
 * review and in the Thành tựu first-run panel; project and skills stay in the full dialog. Its own container query:
 * one row once the title field gets about 200px (432px wide), else the title on row 1, the impact and "Thêm" on row 2.
 */
export function AchievementQuickAdd({
  date,
  onAdded,
  titlePlaceholder,
  className,
}: {
  /** YYYY-MM-DD */
  date: string;
  onAdded: (a: ApiAchievement) => void;
  titlePlaceholder?: string;
  className?: string;
}) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function add() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await weeksApi.addAchievement({ title: title.trim(), impact: impact.trim(), date });
      onAdded(a);
      setTitle('');
      setImpact('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('@container flex w-full flex-col gap-2', className)}>
      <form
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 @min-[27rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={titlePlaceholder ?? t('Đã làm gì')}
          aria-label={t('Thành tựu', null, 'field')}
          maxLength={200}
          className="col-span-2 @min-[27rem]:col-span-1"
        />
        <Input
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          placeholder={t('Con số tác động')}
          aria-label={t('Tác động (con số)')}
          maxLength={200}
        />
        <Button type="submit" variant="outline" disabled={!title.trim()} loading={busy}>
          <Plus aria-hidden />
          {t('Thêm')}
        </Button>
      </form>
      <WriteError error={error} />
    </div>
  );
}
