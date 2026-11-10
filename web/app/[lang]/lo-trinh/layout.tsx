import { AppShell } from '@/components/app-shell';
import { hasRoadmap } from '@/lib/content/roadmap';

// `roadmap`: whether content/roadmap.json existed when this shell was prerendered (lib/content/roadmap.ts).
export default function Layout({ children }: LayoutProps<'/[lang]/lo-trinh'>) {
  return <AppShell roadmap={hasRoadmap()}>{children}</AppShell>;
}
