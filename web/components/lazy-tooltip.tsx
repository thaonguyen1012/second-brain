'use client';
import { useEffect, useState, type ReactElement } from 'react';

/*
 * Tooltip for the icon-only controls of the top bar (theme toggle, Inbox below sm; DESIGN.md D21), loaded after
 * hydration. The Space UI Tooltip pulls in Base UI's floating positioning (~17 kB gzip), which would push the
 * home page past its 220 kB First Load JS budget if the shell imported it directly. Until the chunk arrives the
 * control renders as is (it keeps its aria-label), then the same element becomes the tooltip's trigger.
 * Shell-only helper: pages outside the home page import components/ui/tooltip directly.
 */

type TooltipModule = typeof import('@/components/ui/tooltip');

let pending: Promise<TooltipModule> | null = null;

export function LazyTooltip({ label, children }: { label: string; children: ReactElement }) {
  const [ui, setUi] = useState<TooltipModule | null>(null);
  useEffect(() => {
    let live = true;
    pending ??= import('@/components/ui/tooltip');
    void pending.then((m) => {
      if (live) setUi(m);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!ui) return children;
  return (
    <ui.Tooltip>
      <ui.TooltipTrigger render={children} />
      <ui.TooltipPopup>{label}</ui.TooltipPopup>
    </ui.Tooltip>
  );
}
