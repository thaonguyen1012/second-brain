'use client';
import { useEffect, useRef } from 'react';
import { singleKeyShortcut } from '@/lib/single-key-shortcuts';

/**
 * Single-letter page shortcuts (lower case keys). Ignored while typing, with a modifier, with single-key shortcuts
 * off, or when `enabled` is false (a dialog is open).
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
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
