import { Geist, Inter, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { appName } from '@/lib/shared';
import { notFound } from 'next/navigation';
import { isLocale, localeNames, locales } from '@/lib/i18n/config';
import { getLocale, getT, pageDictionary } from '@/lib/i18n/server';
import { viTranslations } from '@/lib/i18n-vi';
import '../global.css';

// next/font downloads the fonts at build time and self-hosts them; no runtime request to Google.
// Space UI roles: Inter for UI and body, Geist for headings, JetBrains Mono for code (see global.css).
const inter = Inter({ subsets: ['vietnamese', 'latin'], display: 'swap', variable: '--font-inter' });
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
// Mono is only for code blocks: no preload, the browser fetches it when monospace text renders.
const mono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  display: 'swap',
  variable: '--font-jetbrains',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  // PWA icons (public/icons/, see app/manifest.ts); the manifest link itself is added by app/manifest.ts.
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }],
    apple: '/icons/apple-touch-icon.png',
  },
};

/**
 * Both languages are prerendered. The rewrites in next.config.mjs only ever send vi or en; a path that reaches here
 * with another first segment (/files/, /api/) is a 404. Not `dynamicParams = false`: it would also stop the lesson
 * pages below from rendering on request.
 */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function Layout({ children, params }: LayoutProps<'/[lang]'>) {
  if (!isLocale((await params).lang)) notFound();
  const locale = await getLocale();
  const t = await getT();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${geist.variable} ${mono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        {/* The English dictionary travels in this page's RSC payload, never in a JS bundle; Fumadocs is English by
            default and gets its Vietnamese strings the same way. Its language chooser (the lesson sidebar) shows the
            page's language, "Tiếng Việt" or "English": its name starts with those words in both (WCAG 2.5.3) */}
        <Provider
          locale={locale}
          dict={pageDictionary(locale)}
          fumadocs={{
            ...(locale === 'vi' ? viTranslations : null),
            'Choose a language(language switcher)(aria-label)': t('{language}, chọn ngôn ngữ', {
              language: localeNames[locale],
            }),
          }}
        >
          {children}
        </Provider>
      </body>
    </html>
  );
}
