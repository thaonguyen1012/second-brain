import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <span className="font-semibold tracking-tight">{appName}</span>,
      url: '/',
    },
    links: [{ text: 'Lộ trình', url: '/lo-trinh/', active: 'nested-url' }],
  };
}
