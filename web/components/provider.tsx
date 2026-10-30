'use client';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { type ReactNode } from 'react';
import { viTranslations } from '@/lib/i18n-vi';

export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider i18n={{ locale: 'vi', translations: viTranslations }} search={{ enabled: false }}>
      {children}
    </RootProvider>
  );
}
