'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

// Every tile of "Hôm nay" is a next/dynamic chunk, so the home First Load JS carries only these loaders and the hero
// (components/progress.tsx); the tile frame (Panel) lives in today-main. Fetch the chunks as soon as this module
// runs in the browser (before hydration), so the tiles' API requests do not wait for a chunk request that only
// starts when they first render. The placeholders keep each tile's height, so nothing jumps when they arrive.
if (typeof window !== 'undefined') {
  void import('./today-main');
  void import('./today-learning');
  void import('./today-extras');
}
const tile = () => <Skeleton className="h-36 rounded-xl" />;

export const TodayRhythm = dynamic(() => import('./today-learning').then((m) => m.TodayRhythm), {
  ssr: false,
  loading: tile,
});
export const TodayWeek = dynamic(() => import('./today-main').then((m) => m.TodayWeek), { ssr: false, loading: tile });
export const TodayInbox = dynamic(() => import('./today-main').then((m) => m.TodayInbox), { ssr: false, loading: tile });
export const TodayBooks = dynamic(() => import('./today-learning').then((m) => m.TodayBooks), {
  ssr: false,
  loading: tile,
});
// The checklist is often hidden (done or dismissed): no placeholder, so a hidden one never flashes a skeleton.
export const TodaySetup = dynamic(() => import('./today-learning').then((m) => m.TodaySetup), { ssr: false });
export const TodayRoadmap = dynamic(() => import('./today-learning').then((m) => m.TodayRoadmap), {
  ssr: false,
  loading: () => <Skeleton className="h-52 rounded-xl" />,
});
export const TodayBrief = dynamic(() => import('./today-main').then((m) => m.TodayBrief), {
  ssr: false,
  loading: () => <Skeleton className="h-16 rounded-xl" />,
});
// Rarely due and hidden while loading (today-extras): no placeholder either.
export const TodayPredictions = dynamic(() => import('./today-extras').then((m) => m.TodayPredictions), {
  ssr: false,
});
export const TodayStatus = dynamic(() => import('./today-extras').then((m) => m.TodayStatus), {
  ssr: false,
  loading: () => <Skeleton className="h-4 w-72 rounded" />,
});
