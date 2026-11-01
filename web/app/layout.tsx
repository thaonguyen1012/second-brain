import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { appName } from '@/lib/shared';
import './global.css';

// next/font downloads the font at build time and self-hosts it; no runtime request to Google.
// Inter is the Brainwave design system font (variable, all weights).
const font = Inter({
  subsets: ['vietnamese', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={font.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
