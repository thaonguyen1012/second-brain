import { NextResponse, type NextRequest } from 'next/server';
import { docsSlug, lessonExists } from '@/lib/content/known-path';

// Unknown lesson paths are answered here, before the docs route renders and caches them forever (security audit S-17).
export function proxy(request: NextRequest) {
  const slug = docsSlug(request.nextUrl.pathname, request.nextUrl.basePath);
  if (slug && !lessonExists(slug)) return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.next();
}

export const config = { matcher: ['/docs/:path*', '/vi/docs/:path*', '/en/docs/:path*'] };
