import { AppShell } from '@/components/app-shell';

export default function Layout({ children }: LayoutProps<'/[lang]'>) {
  return <AppShell>{children}</AppShell>;
}
