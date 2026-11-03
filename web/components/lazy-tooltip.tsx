'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';

/*
 * Tooltip for the icon-only controls of the top bar (theme toggle, Inbox below sm; DESIGN.md D21), loaded after
 * hydration. The Space UI Tooltip pulls in Base UI's floating positioning (~17 kB gzip), which would push the
 * home page past its 220 kB First Load JS budget if the shell imported it directly. Until the chunk arrives the
 * control renders as is (it keeps its aria-label), then the same element becomes the tooltip's trigger.
 * Shell-only helper: pages outside the home page import components/ui/tooltip directly.
 *
 * The swap remounts the control (its parent changes), so a keyboard user already on it would drop to <body>: the
 * `display: contents` wrapper stays put across the swap and gives focus back to the new control. A failed chunk
 * load (offline, a deploy in between) keeps the plain control and lets a later mount try again.
 */

type TooltipModule = typeof import('@/components/ui/tooltip');

let pending: Promise<TooltipModule> | null = null;

export function LazyTooltip({ label, children }: { label: string; children: ReactElement }) {
  const [ui, setUi] = useState<TooltipModule | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    let live = true;
    pending ??= import('@/components/ui/tooltip');
    pending.then(
      (m) => {
        if (!live) return;
        refocus.current = !!wrapper.current?.contains(document.activeElement);
        setUi(m);
      },
      () => {
        pending = null;
      },
    );
    return () => {
      live = false;
    };
  }, []);
  useLayoutEffect(() => {
    if (!ui || !refocus.current) return;
    refocus.current = false;
    wrapper.current?.querySelector<HTMLElement>('a, button, [tabindex]')?.focus({ preventScroll: true });
  }, [ui]);
  return (
    <span ref={wrapper} className="contents">
      {ui ? (
        <ui.Tooltip>
          <ui.TooltipTrigger render={children} />
          <ui.TooltipPopup>{label}</ui.TooltipPopup>
        </ui.Tooltip>
      ) : (
        children
      )}
    </span>
  );
}
