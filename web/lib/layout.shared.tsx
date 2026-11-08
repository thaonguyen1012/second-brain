import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BrandMark } from '@/components/brand-mark';
import { appName } from './shared';
import type { T } from './i18n/translate';

export function baseOptions(t: T): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <BrandMark className="size-6 shrink-0" />
          <span className="font-semibold tracking-tight">{appName}</span>
        </>
      ),
      url: '/',
    },
    links: [{ text: t('Lộ trình'), url: '/lo-trinh/', active: 'nested-url' }],
  };
}
