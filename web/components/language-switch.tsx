'use client';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LazyTooltip } from '@/components/lazy-tooltip';
import { switchLocale, useLocale } from '@/lib/i18n/client';

/**
 * The top bar's language switch (owner, 08/11/2026: an English version). It names the other language in that
 * language, so a reader who knows only that one finds it: "EN" with "Switch to English" on Vietnamese pages, "VI"
 * with "Chuyển sang tiếng Việt" on English ones. The lesson pages have Fumadocs' own switch in their sidebar.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const other = locale === 'vi' ? 'en' : 'vi';
  const label = other === 'en' ? 'Switch to English' : 'Chuyển sang tiếng Việt'; // i18n-ignore: in the target language
  return (
    <LazyTooltip label={label}>
      <Button variant="ghost" lang={other} aria-label={`${other.toUpperCase()}, ${label}`} onClick={() => switchLocale(other)}>
        <Languages aria-hidden />
        <span aria-hidden>{other.toUpperCase()}</span>
      </Button>
    </LazyTooltip>
  );
}
