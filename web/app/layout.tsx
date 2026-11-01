import { Geist, Inter, JetBrains_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import { Provider } from '@/components/provider';
import { appName } from '@/lib/shared';
import './global.css';

// next/font downloads the fonts at build time and self-hosts them; no runtime request to Google.
// Space UI roles: Inter for UI and body, Geist for headings, JetBrains Mono for code (see global.css).
const inter = Inter({ subsets: ['vietnamese', 'latin'], display: 'swap', variable: '--font-inter' });
const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const mono = JetBrains_Mono({ subsets: ['vietnamese', 'latin'], display: 'swap', variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${geist.variable} ${mono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
