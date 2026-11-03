// Capture from outside the app (DECISIONS 4.3): the bookmarklet and the PWA share target both open
// /inbox/them/?url=&title=&text=, which shows a confirm form and saves through POST /api/inbox.

/** Limits of POST /api/inbox (InboxEntryRequest in lib/api/openapi.yaml). */
export const MAX_URL = 2000;
export const MAX_TEXT = 20000;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const capturePath = `${basePath}/inbox/them/`;

/** The URL as an absolute http(s) href, or null for anything else (javascript:, chrome:, file:, garbage). */
export function httpUrl(value: string): string | null {
  const v = value.trim();
  if (!v || v.length > MAX_URL) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export interface CaptureDraft {
  url: string;
  note: string;
}

/**
 * The form's starting values from ?url=&title=&text=. Android share sheets often put the link inside `text`
 * (and leave `url` empty): the first http(s) link found there becomes the URL. The note is the title plus the
 * shared text (the selection, for the bookmarklet), without repeating the URL or the title.
 */
export function draftFromParams(params: URLSearchParams): CaptureDraft {
  let url = (params.get('url') ?? '').trim();
  const title = (params.get('title') ?? '').trim();
  let text = (params.get('text') ?? '').trim();
  if (!url) {
    const found = text.match(/https?:\/\/[^\s<>"]+/i)?.[0];
    if (found) {
      url = found;
      text = text
        .replace(found, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    }
  }
  const parts: string[] = [];
  for (const part of [title, text]) if (part && part !== url && !parts.includes(part)) parts.push(part);
  return { url, note: parts.join('\n\n').slice(0, MAX_TEXT) };
}

/**
 * The bookmarklet for an app served at `origin`: opens the capture page in a small window (or in the same tab
 * when popups are blocked) with the current tab's URL, title and selected text. Built at runtime from
 * window.location.origin, so the bookmarklet always points back at the origin it was dragged from.
 */
export function bookmarkletHref(origin: string): string {
  if (!/^https?:\/\/[^\s'"\\]+$/.test(origin)) throw new Error('bad origin');
  const target = `${origin}${capturePath}`;
  const code = [
    '(function(){',
    "var s=String(window.getSelection?getSelection():'').trim().slice(0,1500);",
    `var u='${target}?url='+encodeURIComponent(location.href)`,
    "+'&title='+encodeURIComponent(document.title.slice(0,300))",
    "+(s?'&text='+encodeURIComponent(s):'');",
    "if(!window.open(u,'alex-brain-capture','width=560,height=720'))location.href=u;",
    '})();',
  ].join('');
  return `javascript:${code}`;
}
