"""Feed bodies for tests."""

import datetime as dt
import email.utils

import httpx

from core.tests.fakenet import Route


def rfc822(moment: dt.datetime) -> str:
    return email.utils.format_datetime(moment)


def rss(*items: tuple[str, str, dt.datetime | None, str]) -> str:
    """items: (title, link, published, description)."""
    body = "".join(
        f"<item><title>{title}</title><link>{link}</link>"
        + (f"<pubDate>{rfc822(published)}</pubDate>" if published else "")
        + f"<description>{description}</description></item>"
        for title, link, published, description in items
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed</title>'
        f"<link>https://news.test/</link>{body}</channel></rss>"
    )


def atom(*entries: tuple[str, str, dt.datetime, str]) -> str:
    body = "".join(
        f'<entry><title type="html">{title}</title><link rel="alternate" href="{href}"/>'
        f'<link rel="enclosure" href="https://cdn.test/a.mp3"/><published>{published.isoformat()}</published>'
        f'<summary type="html">{summary}</summary></entry>'
        for title, href, published, summary in entries
    )
    return f'<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>{body}</feed>'


def xml(body: str, content_type: str = "application/rss+xml; charset=utf-8") -> Route:
    return lambda request: httpx.Response(200, headers={"content-type": content_type}, text=body)
