'use client';
import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { bookmarkletHref } from '@/lib/capture';

/**
 * "Bookmarklet" help on the Inbox page: a link to drag to the bookmarks bar. Its javascript: href is set on the
 * DOM after mount, from window.location.origin (so it targets the origin the page is served from), and outside
 * React on purpose: React 19 replaces javascript: URLs passed as props.
 */
export function BookmarkletHelp() {
  const ref = useRef<HTMLAnchorElement>(null);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    ref.current?.setAttribute('href', bookmarkletHref(window.location.origin));
  }, []);

  return (
    <div className="flex max-w-2xl flex-col gap-1.5 text-sm text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          Nút này không bấm ở đây: kéo nó lên thanh dấu trang (Cmd+Shift+B để hiện thanh này).
        </p>
      )}
      <p className="text-xs">
        Trên điện thoại: cài app (Thêm vào màn hình chính), rồi Chia sẻ → Alex&apos;s Brain.
      </p>
    </div>
  );
}
