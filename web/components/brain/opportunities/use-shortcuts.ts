'use client';
import { useEffect, useRef } from 'react';
import { focusShortcutOpener } from '@/lib/shortcut-opener';
import { singleKeyShortcut } from '@/lib/single-key-shortcuts';

/**
 * Single-letter page shortcuts (lower case keys). Ignored while typing, with a modifier, with single-key shortcuts
 * off, or when `enabled` is false (a dialog is open). With nothing focused, the control showing the key takes the
 * focus first, so a dialog the key opens gives it back there.
 */
export function useShortcuts(map: Record<string, () => void>, enabled: boolean) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || !singleKeyShortcut(e)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const run = ref.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      focusShortcutOpener(e.key);
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
