'use client';
import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CloudCheck, CloudUpload, PlugZap } from 'lucide-react';
import { api, type ApiError } from '@/lib/api/client';
import { toApiError, useApi } from '@/lib/api/use-api';
import { refreshProgress } from '@/lib/progress';
import {
  dismissMigration,
  markNothingToMigrate,
  migrateLegacyProgress,
  pendingPages,
  readLegacyProgress,
  type MigrationResult,
} from '@/lib/progress/migration';
import { describeApiError } from '@/components/brain/api-state';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Phase =
  | { kind: 'offer'; error?: ApiError }
  | { kind: 'running'; handled: number; total: number }
  | { kind: 'done'; result: MigrationResult }
  | { kind: 'closed' };

const TITLE_ID = 'progress-migration-title';

/** One-time offer to PUT the old localStorage "Đã học xong" pages to the progress API (lib/progress/migration.ts). */
export function ProgressMigrationBanner() {
  const [legacy] = useState(readLegacyProgress);
  const server = useApi('progress-migration', api.getProgress);
  const [phase, setPhase] = useState<Phase>({ kind: 'offer' });

  const pending = useMemo(
    () => (legacy && server.data ? pendingPages(legacy, server.data).length : null),
    [legacy, server.data],
  );

  // Everything is on the server already (e.g. the earlier automatic import): close the offer for good.
  useEffect(() => {
    if (pending === 0 && phase.kind === 'offer') markNothingToMigrate();
  }, [pending, phase.kind]);

  async function run() {
    if (!legacy) return;
    setPhase({ kind: 'running', handled: 0, total: pending ?? 0 });
    let result: MigrationResult;
    try {
      // fresh server state, so a retry only sends what is still missing
      const fresh = await api.getProgress();
      result = await migrateLegacyProgress(legacy, fresh, (handled, total) =>
        setPhase({ kind: 'running', handled, total }),
      );
    } catch (err) {
      result = { moved: 0, skipped: 0, error: toApiError(err) };
    }
    await refreshProgress();
    if (result.error) {
      server.reload();
      setPhase({ kind: 'offer', error: result.error });
    } else setPhase({ kind: 'done', result });
  }

  function dismiss() {
    dismissMigration();
    setPhase({ kind: 'closed' });
  }

  if (phase.kind === 'closed') return null;

  if (phase.kind === 'done') {
    const { moved, skipped } = phase.result;
    return (
      <Alert variant="success" role="status" className="mt-4 max-w-4xl">
        <CloudCheck aria-hidden />
        <AlertTitle>Đã chuyển tiến độ học lên server</AlertTitle>
        <AlertDescription>
          {moved} bài đã lên server.
          {skipped > 0 && ` ${skipped} bài thuộc sổ tay không còn trên server nên được bỏ qua.`} Bản trên trình duyệt
          này vẫn được giữ.
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={() => setPhase({ kind: 'closed' })}>
            Đóng
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  // Offer only once the server answered and something is missing there; load errors stay silent
  // (the other cards of the page already explain a missing backend), the offer comes back next visit.
  if (!pending) return null;

  const running = phase.kind === 'running';
  const error = phase.kind === 'offer' ? phase.error : undefined;
  const errorText = error && describeApiError(error);
  const Icon = error ? (error.reachable ? CircleAlert : PlugZap) : CloudUpload;

  return (
    <Alert
      variant={error ? 'error' : 'info'}
      role="region"
      aria-labelledby={TITLE_ID}
      aria-busy={running || undefined}
      className="mt-4 max-w-4xl"
    >
      <Icon aria-hidden />
      <AlertTitle id={TITLE_ID}>Chuyển tiến độ học cũ lên server</AlertTitle>
      <AlertDescription>
        <p>
          Trình duyệt này còn {pending} bài đã đánh dấu &quot;Đã học xong&quot; từ trước khi có server. Chuyển lên để
          mọi thiết bị đều thấy. Bản trên trình duyệt vẫn được giữ; trong tổng kết tuần, các bài này được tính là học
          xong hôm nay.
        </p>
        <p aria-live="polite" className="mt-1 font-medium text-foreground empty:hidden">
          {running && `Đang chuyển ${phase.handled}/${phase.total} bài…`}
        </p>
        {errorText && (
          <p role="alert" className="mt-1 text-foreground">
            {errorText.title}. {errorText.text} Các bài đã chuyển được giữ trên server; bấm lại để chuyển phần còn
            lại.
          </p>
        )}
      </AlertDescription>
      <AlertAction className="flex-wrap justify-end">
        <Button size="sm" onClick={run} loading={running}>
          {error ? 'Thử lại' : 'Chuyển lên server'}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss} disabled={running} aria-label="Bỏ qua, không hỏi lại">
          Bỏ qua
        </Button>
      </AlertAction>
    </Alert>
  );
}
