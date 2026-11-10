import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { BrandMark } from '@/components/brand-mark';
import { hasRoadmap } from './content/roadmap';
import { appName } from './shared';
import type { T } from './i18n/translate';

/** The lesson layout's frame; its one link, Lộ trình, only while content/roadmap.json exists (server side). */
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
    links: hasRoadmap() ? [{ text: t('Lộ trình'), url: '/lo-trinh/', active: 'nested-url' }] : [],
  };
}
