import type { MetadataRoute } from 'next';
import { appName } from '@/lib/shared';
import { capturePath } from '@/lib/capture';

// Web app manifest (DECISIONS 4.3): installable app with a share target that opens the inbox capture page.
// Colours from app/global.css: --primary (light) and --background. No service worker: current Chrome and
// Safari install without one, and none is needed for the share target (GET). Icons: public/icons/.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: appName,
    short_name: 'Bộ não Alex',
    description: 'Sổ tay học tập và bộ não thứ hai của Alex.',
    lang: 'vi',
    start_url: `${base}/`,
    scope: `${base}/`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1f6ae0',
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}/icons/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    share_target: {
      action: capturePath,
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { url: 'url', title: 'title', text: 'text' },
    },
    shortcuts: [
      { name: 'Inbox', url: `${base}/inbox/` },
      { name: 'Thêm vào Inbox', url: capturePath },
    ],
  };
}
