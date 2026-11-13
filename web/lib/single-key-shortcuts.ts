// Single-key shortcuts (N, J, /, ?, [, 1-9, the arrows and Del a page listens for...) and the one switch that turns
// them all off (WCAG 2.1.4 Character Key Shortcuts): on by default, set in a page's key legend
// (components/brain/key-legend.tsx) and remembered in this browser. Every page-wide handler of a key pressed on its own
// asks singleKeyShortcut(e) first, or singleKeyShortcutsOn() after its own modifier and typing checks (Ghi chú, the
// timer); a focused objective row asks singleKeyShortcutsOn() for its letters only (its arrows, Enter and Del act on
// the row in place, like any focused control). Shortcuts with ⌘, Ctrl or Alt (⌘K, Ctrl+Enter, Alt+↑) never go through
// it, so they keep working.

/** localStorage key: '0' when the owner turned single-key shortcuts off, '1' (or nothing) when they are on. */
export const SINGLE_KEY_SHORTCUTS_KEY = 'alex-brain:single-key-shortcuts';

const listeners = new Set<() => void>();
// The choice while storage refuses to keep it (private window, blocked site data): it lasts until the page reloads.
let unsaved: boolean | null = null;

/** Whether single-key shortcuts are on in this browser: yes unless turned off, and on the server or blocked storage. */
export function singleKeyShortcutsOn(): boolean {
  if (unsaved !== null) return unsaved;
  try {
    return window.localStorage.getItem(SINGLE_KEY_SHORTCUTS_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Turns single-key shortcuts on or off in this browser (every page and tab follows at its next key). */
export function setSingleKeyShortcuts(on: boolean): void {
  try {
    window.localStorage.setItem(SINGLE_KEY_SHORTCUTS_KEY, on ? '1' : '0');
    unsaved = null;
  } catch {
    unsaved = on;
  }
  for (const l of listeners) l();
}

/** For useSyncExternalStore: calls `onChange` when the switch moves here or in another tab. */
export function subscribeSingleKeyShortcuts(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SINGLE_KEY_SHORTCUTS_KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** The focus is in a field (input, textarea, select, editable text): a key there is typing, never a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Whether a page's single-key shortcut may answer this keydown: no ⌘, Ctrl or Alt (Shift belongs to the key: "?",
 * "!"), not typed into a field, and single-key shortcuts on.
 */
export function singleKeyShortcut(e: KeyboardEvent): boolean {
  return !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target) && singleKeyShortcutsOn();
}
