import { Be_Vietnam_Pro } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { appName } from '@/lib/shared';
import './global.css';

// next/font downloads the font at build time and self-hosts it; no runtime request to Google.
const font = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
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
