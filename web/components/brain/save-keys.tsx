'use client';
import { useSyncExternalStore } from 'react';
import { Kbd } from '@/components/ui/kbd';

const noSubscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The save shortcut of every form: "Cmd+Enter" (shown as the Apple key symbol) on Apple devices, "Ctrl+Enter" elsewhere (both keys work). */
export function SaveKeys() {
  // The server renders the Mac form (Mac-first app); the browser corrects it after hydration.
  const apple = useSyncExternalStore(noSubscribe, isApple, () => true);
  return (
    <>
      <Kbd>{apple ? '⌘' : 'Ctrl'}</Kbd>+<Kbd>Enter</Kbd>
    </>
  );
}
