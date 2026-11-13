/**
 * Tabs that switch a region outside their Base UI `Tabs` root (a page's view switch or filter and the list below the
 * toolbar, where no `Tabs.Panel` fits): each tab names the region as the one it controls, and the region is their
 * tabpanel, named by the selected tab (the ARIA APG tabs pattern; WCAG 1.3.1, 4.1.2). Pass the same `panel` id to
 * both. The region gets no tab stop of its own (Base UI's panel would add one): Tab goes on to its rows and buttons.
 */
export function tabProps(panel: string, value: string) {
  return { id: `${panel}-${value}`, 'aria-controls': panel };
}

/** The region's half of `tabProps`: `value` is the selected tab's. */
export function tabPanelProps(panel: string, value: string) {
  return { id: panel, role: 'tabpanel', 'aria-labelledby': `${panel}-${value}` } as const;
}
