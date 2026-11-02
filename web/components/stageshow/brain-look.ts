'use client';
import { useTheme } from 'next-themes';
import type { LookTokens, Theme } from './kit';

/**
 * The Alex's Brain look for Stageshow stages: the Space UI tokens of app/global.css mapped onto the kit's
 * --ss-* tokens (references/looks.md in the Stageshow skill).
 *
 * The values point at the app's own CSS variables (`var(--card)`, `var(--primary)`...), so a stage follows
 * global.css and the `.dark` class without a second copy of the palette. What var() cannot express (the
 * stage ground and the raised surface step) differs per theme below. The kit's placeholder inks, shadows and
 * status tints stay the kit's: the stage's `theme` prop ('light' | 'dark') switches those.
 */
const shared: LookTokens = {
  // Surfaces: cards are the app's cards, popovers its popovers
  '--ss-surface': 'var(--card)',
  '--ss-chrome': 'var(--card)',
  // Lines: Space UI draws hairlines with --border (black or white at 8%)
  '--ss-line': 'var(--border)',
  '--ss-line-faint': 'color-mix(in srgb, var(--border) 60%, transparent)',
  // Text: foreground, muted-foreground, and a faint step between muted and the card
  '--ss-text-strong': 'var(--foreground)',
  '--ss-text': 'var(--muted-foreground)',
  '--ss-text-faint': 'color-mix(in srgb, var(--muted-foreground) 62%, var(--card))',
  '--ss-icon': 'var(--muted-foreground)',
  '--ss-icon-faint': 'color-mix(in srgb, var(--muted-foreground) 40%, var(--card))',
  // One accent: the app's blue primary (#1f6ae0 light, #6aa5ff dark)
  '--ss-accent': 'var(--primary)',
  '--ss-accent-2': 'var(--primary)',
  '--ss-accent-soft': 'color-mix(in srgb, var(--primary) 14%, transparent)',
  '--ss-accent-text': 'var(--primary)',
  // Status tints: the app's Badge variants (lib/labels.ts tones)
  '--ss-success-soft': 'var(--success)',
  '--ss-success-text': 'var(--success-foreground)',
  '--ss-warning-soft': 'var(--warning)',
  '--ss-warning-text': 'var(--warning-foreground)',
  '--ss-danger-soft': 'var(--error)',
  '--ss-danger-text': 'var(--error-foreground)',
  // Brain-only tokens (not in the kit): text on a filled primary button, the tinted panel of a BrainCard
  // header and of a secondary badge, the popover shadow of global.css
  '--ss-on-accent': 'var(--primary-foreground)',
  '--ss-panel': 'var(--secondary)',
  '--ss-panel-text': 'var(--secondary-foreground)',
  '--ss-heading': 'var(--font-geist), var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  // More brain-only tokens for the page guides: the info badge, the destructive button, the chart series of
  // the week review (--chart-objective / --chart-other) and the week summary (--chart-billable /
  // --chart-nonbillable), and the skill freshness dots (bw-green / bw-yellow, with their hex as fallback)
  '--ss-info-soft': 'var(--info)',
  '--ss-info-text': 'var(--info-foreground)',
  '--ss-destructive': 'var(--destructive)',
  '--ss-muted': 'var(--muted)',
  '--ss-chart-objective': 'var(--chart-objective)',
  '--ss-chart-other': 'var(--chart-other)',
  '--ss-chart-billable': 'var(--chart-billable)',
  '--ss-chart-nonbillable': 'var(--chart-nonbillable)',
  '--ss-fresh': 'var(--color-bw-green, #49ba61)',
  '--ss-aging': 'var(--color-bw-yellow, #ffb73a)',
  // Type: Inter for UI (next/font sets --font-inter on <html>); no font is fetched by the kit
  '--ss-font': 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  '--ss-mono': 'var(--font-jetbrains), ui-monospace, SFMono-Regular, Menlo, monospace',
  // Shape: --radius is 10px; Space UI's sm / md / lg / xl steps
  '--ss-radius-sm': '6px',
  '--ss-radius-md': '8px',
  '--ss-radius-lg': '10px',
  '--ss-radius-window': '14px',
  '--ss-radius-pill': '999px',
  // Density: a default button (h-8) and a menu row
  '--ss-control': '32px',
  '--ss-row': '28px',
};

const light: LookTokens = {
  ...shared,
  // The stage ground: Space UI's secondary gray, the tint of a BrainCard header panel
  '--ss-well': 'var(--secondary)',
  '--ss-canvas': 'var(--secondary)',
  '--ss-raised': 'var(--popover)',
};

const dark: LookTokens = {
  ...shared,
  // Dark cards are zinc-950; the ground is the sidebar's 7% gray so cards read as cut out of it,
  // and raised surfaces (a dialog) take the muted step, since depth on dark comes from a lighter surface
  '--ss-well': 'var(--sidebar)',
  '--ss-canvas': 'var(--sidebar)',
  '--ss-raised': 'var(--muted)',
};

export const brainTokens: Record<'light' | 'dark', LookTokens> = { light, dark };

/** The stage theme that matches the app's theme (next-themes resolves "system"). Light until mounted. */
export function useBrainTheme(): Extract<Theme, 'light' | 'dark'> {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? 'dark' : 'light';
}

/** Props for a Stage in the Alex's Brain look: `<Stage {...useBrainLook()} ...>`. */
export function useBrainLook(): { theme: 'light' | 'dark'; tokens: LookTokens } {
  const theme = useBrainTheme();
  return { theme, tokens: brainTokens[theme] };
}
