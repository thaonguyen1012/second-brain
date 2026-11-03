'use client';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Popover } from '../kit/motion/Popover';
import './base.css';

// Shared faux pieces of the app for the page guides: the app's Badge, Button, Kbd, section card, select box,
// dialog and choice menu, drawn small with the kit's tokens (base.css, scoped under .ssg-brain). Each guide
// composes the real page from these; none of them is interactive (the stage's script drives them).

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

/** Cursor target attributes: `data-target` for a.click(name), with the pointer cursor over it. */
export const target = (name: string) => ({ 'data-target': name, 'data-cursor': 'pointer' });

export function GBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('g-badge', className)} data-tone={tone}>
      {children}
    </span>
  );
}

export function GKbd({ children }: { children: ReactNode }) {
  return <span className="g-kbd">{children}</span>;
}

export function GButton({
  variant,
  size,
  name,
  off,
  icon: Icon,
  kbd,
  children,
  className,
}: {
  variant?: 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'xs';
  /** data-target for the cursor */
  name?: string;
  /** Disabled look (64%) */
  off?: boolean;
  icon?: LucideIcon;
  kbd?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx('g-button', className)}
      data-variant={variant}
      data-size={size}
      data-off={off || undefined}
      {...(name ? target(name) : {})}
    >
      {Icon && <Icon size={size === 'xs' ? 12 : 14} strokeWidth={2} aria-hidden />}
      {children}
      {kbd && <GKbd>{kbd}</GKbd>}
    </span>
  );
}

/** A section card (WeekSection, the detail page's Section): icon, title, optional action, then content. */
export function GCard({
  icon: Icon,
  title,
  action,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('g-card', className)}>
      <div className="g-card__head">
        {Icon && <Icon className="g-card__icon" size={14} strokeWidth={2} aria-hidden />}
        <span className="g-card__title">{title}</span>
        {action && <span className="g-card__action">{action}</span>}
      </div>
      {children}
    </div>
  );
}

/** A select box (ChoiceSelect): the value and a chevron. */
export function GSelect({
  value,
  name,
  open,
  className,
}: {
  value: ReactNode;
  name?: string;
  open?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('g-box', className)} data-open={open || undefined} {...(name ? target(name) : {})}>
      {value}
      <ChevronDown className="g-box__chev" size={14} strokeWidth={2} aria-hidden />
    </span>
  );
}

/** A labelled form row. */
export function GRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="g-row">
      <span className="g-label">{label}</span>
      {children}
      {hint && <span className="g-hint">{hint}</span>}
    </div>
  );
}

export function GScrim({ show }: { show: boolean }) {
  return <div className="g-scrim" data-show={show || undefined} />;
}

/** A modal dialog: title, description, body, footer. Position it with its className. */
export function GDialog({
  show,
  title,
  desc,
  foot,
  children,
  className,
}: {
  show: boolean;
  title: ReactNode;
  desc?: ReactNode;
  foot?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Popover show={show} origin="center" className={cx('g-dialog', className)}>
      <div className="g-dialog__head">
        <span className="g-dialog__title">{title}</span>
        {desc && <span className="g-desc">{desc}</span>}
      </div>
      {children}
      {foot && <div className="g-dialog__foot">{foot}</div>}
    </Popover>
  );
}

/** The popup of a select box: one row per choice; `on` marks the highlighted one. */
export function GMenu({
  show,
  items,
  on,
  className,
  style,
}: {
  show: boolean;
  items: { label: ReactNode; name?: string }[];
  on?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Popover show={show} className={cx('g-menu', className)} style={style}>
      {items.map((it, i) => (
        <span key={i} className="g-menu__item" data-on={on === i || undefined} {...(it.name ? target(it.name) : {})}>
          {it.label}
        </span>
      ))}
    </Popover>
  );
}

/** The design sizes every page guide shares (the lazy placeholder in lazy.tsx keeps the same ratios). */
export const GUIDE_SIZE = { width: 600, height: 452, compact: { below: 560, width: 358, height: 470 } } as const;
