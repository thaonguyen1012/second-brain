'use client';
import { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * "In hoặc lưu PDF" for the intro page. While the browser prints, the page is drawn in the light theme (a dark
 * page prints as light text on a dropped background); the theme the owner chose comes back after printing.
 * The print layout itself is the @media print block of intro.css.
 */
export function PrintButton({ className }: { className?: string }) {
  useEffect(() => {
    const root = document.documentElement;
    let restore: (() => void) | null = null;
    const before = () => {
      if (!root.classList.contains('dark')) return;
      const scheme = root.style.colorScheme;
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
      restore = () => {
        root.classList.add('dark');
        root.style.colorScheme = scheme;
      };
    };
    const after = () => {
      restore?.();
      restore = null;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      after();
    };
  }, []);

  return (
    <Button variant="outline" className={className} onClick={() => window.print()}>
      <Printer aria-hidden />
      In hoặc lưu PDF
    </Button>
  );
}
