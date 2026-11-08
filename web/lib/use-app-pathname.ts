'use client';
import { usePathname } from 'next/navigation';
import { stripLocale } from '@/lib/i18n/config';

/**
 * The page's path without the language: "/thu-vien/" in both languages. Use it instead of next/navigation's
 * usePathname (eslint.config.mjs forbids that one): pages are prerendered at /vi/... and /en/... and the rewrites in
 * next.config.mjs send the browser's /thu-vien/ to them, so on the server usePathname() says "/en/thu-vien" while the browser
 * says "/thu-vien/", and anything drawn from it would not hydrate (Next docs, usePathname "rewrites").
 */
export function useAppPathname(): string {
  return stripLocale(usePathname());
}
