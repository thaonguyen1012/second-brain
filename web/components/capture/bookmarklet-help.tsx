'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BookmarkPlus, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookmarkletHref } from '@/lib/capture';

/**
 * "Bookmarklet" help on the Inbox page: a link to drag to the bookmarks bar, and "Sao chép mã bookmarklet" as the
 * keyboard and touch alternative (a phone cannot drag to a bookmarks bar). Its javascript: href is set on the DOM
 * after mount, from window.location.origin (so it targets the origin the page is served from), and outside React
 * on purpose: React 19 replaces javascript: URLs passed as props.
 *
 * The phone line depends on the platform: Android can install the app and share into it (Web Share Target);
 * iOS Safari does not support share targets (deploy/README.md), so iPhone and iPad use the copied bookmarklet.
 */

type Platform = 'mac' | 'ios' | 'android' | 'other';

const noSubscribe = () => () => {};

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const platform = navigator.platform || '';
  // iPadOS reports itself as a Mac; touch points tell them apart
  if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(platform || ua)) return 'mac';
  return 'other';
}

export function BookmarkletHelp() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [clicked, setClicked] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  // The server renders the Mac form (Mac-first app, like SaveKeys); the browser corrects it after hydration.
  const platform = useSyncExternalStore(noSubscribe, detectPlatform, () => 'mac' as Platform);
  const phone = platform === 'ios' || platform === 'android';

  useEffect(() => {
    ref.current?.setAttribute('href', bookmarkletHref(window.location.origin));
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletHref(window.location.origin));
      setCopied('ok');
    } catch {
      setCopied('failed');
    }
  };

  const copyButton = (
    <Button type="button" size="xs" variant="outline" onClick={() => void copy()}>
      <Copy aria-hidden />
      Sao chép mã bookmarklet
    </Button>
  );

  return (
    <div className="flex max-w-2xl flex-col gap-1.5 text-sm text-muted-foreground">
      {!phone && (
        <>
          {/* Dragging needs a mouse: hidden on touch screens, where the copy button below is the way */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pointer-coarse:hidden">
            <span className="font-medium text-foreground">Bookmarklet:</span>
            kéo nút
            <a
              ref={ref}
              draggable
              title="Kéo lên thanh dấu trang"
              className="inline-flex cursor-grab items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground shadow-depth-1 active:cursor-grabbing"
              onClick={(e) => {
                e.preventDefault();
                setClicked(true);
              }}
            >
              <BookmarkPlus className="size-3.5" aria-hidden />
              Lưu vào Brain
            </a>
            lên thanh dấu trang, rồi bấm nó ở trang bất kỳ để gửi link (và đoạn đang chọn) vào inbox.
          </p>
          {clicked && (
            <p role="status" className="text-xs">
              Nút này không bấm ở đây: kéo nó lên thanh dấu trang ({platform === 'mac' ? 'Cmd' : 'Ctrl'}+Shift+B để hiện
              thanh này), hoặc sao chép mã bên dưới.
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="pointer-coarse:hidden">Không kéo được?</span>
            {copyButton}
            rồi tạo một dấu trang mới và dán mã vào ô địa chỉ (URL) của nó.
          </p>
          <p className="text-xs">
            Trên Android: cài app (Thêm vào màn hình chính), rồi Chia sẻ → Alex&apos;s Brain. Trên iPhone, iPad: Safari
            chưa hỗ trợ chia sẻ thẳng vào app, hãy dùng bookmarklet.
          </p>
        </>
      )}
      {platform === 'android' && (
        <p className="text-xs">Gửi link từ app khác: cài app (Thêm vào màn hình chính), rồi Chia sẻ → Alex&apos;s Brain.</p>
      )}
      {platform === 'ios' && (
        <>
          <p className="text-xs">
            Safari trên iPhone, iPad chưa hỗ trợ chia sẻ thẳng vào app. Dùng bookmarklet: sao chép mã, lưu một dấu trang
            bất kỳ, rồi sửa dấu trang đó và dán mã vào ô địa chỉ.
          </p>
          <p className="flex text-xs">{copyButton}</p>
        </>
      )}
      {/* Always mounted, so screen readers announce the result when it appears */}
      <p role="status" className="text-xs empty:hidden">
        {copied === 'ok' && 'Đã sao chép mã bookmarklet. Tạo dấu trang mới và dán mã vào ô địa chỉ (URL).'}
        {copied === 'failed' && 'Không sao chép được. Trên máy tính, hãy kéo nút Lưu vào Brain lên thanh dấu trang.'}
      </p>
    </div>
  );
}
