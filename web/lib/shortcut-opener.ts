/**
 * A single-key shortcut that opens a dialog while nothing holds the focus (after a page load, a click on the page's
 * background, J/K on a list's cursor, which moves no focus) first gives the focus to the control the key stands for,
 * as if that control had been pressed. A dialog gives the focus back to what held it as it opened, so closing it then
 * returns there instead of to <body> (WCAG 2.4.3), and a delete confirmed by Del knows the row it came from
 * (confirm-delete.tsx). That control is the first one in `scope` (the page, or the cursor's row) named with the key in
 * aria-keyshortcuts or showing it in a Kbd chip, else `fallback` (the row's menu, whose item shows the key). Nothing
 * changes while something holds the focus: the dialog returns there.
 */
export function focusShortcutOpener(key: string, scope: ParentNode = document, fallback?: HTMLElement | null): void {
  const held = document.activeElement;
  if (held && held !== document.body) return;
  const k = key.toLowerCase();
  const showsKey = (el: Element) =>
    !!el.getAttribute('aria-keyshortcuts')?.toLowerCase().split(' ').includes(k) ||
    Array.from(el.querySelectorAll('kbd')).some((kbd) => kbd.textContent?.trim().toLowerCase() === k);
  const controls = Array.from(scope.querySelectorAll<HTMLElement>('button, a[href]')).filter(showsKey);
  if (fallback) controls.push(fallback);
  // The first one that can take the focus (a hidden toolbar's button cannot)
  for (const el of controls) {
    el.focus({ preventScroll: true });
    if (document.activeElement === el) return;
  }
}
