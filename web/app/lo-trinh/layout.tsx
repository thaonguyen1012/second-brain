import { AppShell } from '@/components/app-shell';

export default function Layout({ children }: LayoutProps<'/lo-trinh'>) {
  return <AppShell>{children}</AppShell>;
}
