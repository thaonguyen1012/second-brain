import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SINGLE_KEY_SHORTCUTS_KEY,
  isTyping,
  setSingleKeyShortcuts,
  singleKeyShortcut,
  singleKeyShortcutsOn,
  subscribeSingleKeyShortcuts,
} from './single-key-shortcuts';

type Listener = (e: { key: string | null }) => void;

/** A window with a localStorage (or one that throws, like a private window with blocked site data). */
function fakeWindow(blocked = false) {
  const items = new Map<string, string>();
  const listeners = new Set<Listener>();
  const refuse = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  const win = {
    localStorage: {
      getItem: (k: string) => (blocked ? refuse() : (items.get(k) ?? null)),
      setItem: (k: string, v: string) => (blocked ? refuse() : void items.set(k, v)),
    },
    addEventListener: (type: string, l: Listener) => type === 'storage' && listeners.add(l),
    removeEventListener: (type: string, l: Listener) => type === 'storage' && listeners.delete(l),
  };
  vi.stubGlobal('window', win);
  return { items, fireStorage: (key: string | null) => listeners.forEach((l) => l({ key })), listeners };
}

const key = (k: string, extra: Partial<KeyboardEvent> = {}, target: unknown = { tagName: 'BODY' }) =>
  ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target, ...extra }) as KeyboardEvent;

beforeEach(() => {
  // Back to "on", with storage that keeps it (clears a choice an earlier test left in memory)
  fakeWindow();
  setSingleKeyShortcuts(true);
});
afterEach(() => vi.unstubAllGlobals());

describe('the switch', () => {
  it('is on by default, also on the server', () => {
    fakeWindow();
    expect(singleKeyShortcutsOn()).toBe(true);
    vi.unstubAllGlobals();
    expect(singleKeyShortcutsOn()).toBe(true);
  });

  it('is remembered in this browser', () => {
    const { items } = fakeWindow();
    setSingleKeyShortcuts(false);
    expect(items.get(SINGLE_KEY_SHORTCUTS_KEY)).toBe('0');
    expect(singleKeyShortcutsOn()).toBe(false);
    setSingleKeyShortcuts(true);
    expect(items.get(SINGLE_KEY_SHORTCUTS_KEY)).toBe('1');
    expect(singleKeyShortcutsOn()).toBe(true);
  });

  it('follows another tab', () => {
    const { items } = fakeWindow();
    items.set(SINGLE_KEY_SHORTCUTS_KEY, '0');
    expect(singleKeyShortcutsOn()).toBe(false);
  });

  it('keeps the choice until reload when storage is blocked', () => {
    fakeWindow(true);
    expect(singleKeyShortcutsOn()).toBe(true);
    setSingleKeyShortcuts(false);
    expect(singleKeyShortcutsOn()).toBe(false);
    setSingleKeyShortcuts(true);
    expect(singleKeyShortcutsOn()).toBe(true);
  });

  it('tells subscribers about its own changes and those of other tabs', () => {
    const { fireStorage, listeners } = fakeWindow();
    const onChange = vi.fn();
    const stop = subscribeSingleKeyShortcuts(onChange);
    setSingleKeyShortcuts(false);
    fireStorage(SINGLE_KEY_SHORTCUTS_KEY);
    fireStorage(null);
    fireStorage('alex-brain:tools-view');
    expect(onChange).toHaveBeenCalledTimes(3);
    stop();
    expect(listeners.size).toBe(0);
    setSingleKeyShortcuts(true);
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

describe('singleKeyShortcut', () => {
  it('answers a key pressed alone, Shift included', () => {
    expect(singleKeyShortcut(key('n'))).toBe(true);
    expect(singleKeyShortcut(key('?', { shiftKey: true }))).toBe(true);
    expect(singleKeyShortcut(key('ArrowDown'))).toBe(true);
  });

  it('leaves ⌘, Ctrl and Alt shortcuts alone', () => {
    expect(singleKeyShortcut(key('k', { metaKey: true }))).toBe(false);
    expect(singleKeyShortcut(key('Enter', { ctrlKey: true }))).toBe(false);
    expect(singleKeyShortcut(key('ArrowUp', { altKey: true }))).toBe(false);
  });

  it('never takes a key typed into a field', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(singleKeyShortcut(key('n', {}, { tagName }))).toBe(false);
    }
    expect(singleKeyShortcut(key('n', {}, { tagName: 'DIV', isContentEditable: true }))).toBe(false);
    expect(isTyping(null)).toBe(false);
    expect(isTyping({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
  });

  it('answers nothing while the switch is off', () => {
    setSingleKeyShortcuts(false);
    expect(singleKeyShortcut(key('n'))).toBe(false);
    expect(singleKeyShortcut(key('/'))).toBe(false);
    expect(singleKeyShortcut(key('1', { shiftKey: true }))).toBe(false);
  });
});
