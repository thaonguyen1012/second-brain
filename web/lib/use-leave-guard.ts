'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * While `dirty` (unsaved note text on the Item page), leaving never drops it silently: the browser asks before a
 * reload or closing the tab (beforeunload), and a plain click on a link to another page of the app is held and handed
 * to `ask(go)`, where `go()` follows it. Links that open elsewhere (new tab, modifier keys, downloads, other sites)
 * and links to the page already shown pass. The click is caught on the document before React sees it, so Next's
 * <Link> never starts the navigation.
 */
export function useLeaveGuard(dirty: boolean, ask: (go: () => void) => void): void {
  const router = useRouter();
  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // older browsers ask only when returnValue is set
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== '_self') || link.hasAttribute('download'))
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      askRef.current(() => router.push(`${url.pathname}${url.search}${url.hash}`));
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty, router]);
}
