"""OpenGraph card data for a link (DECISIONS 10.7): og:title, og:description, og:site_name, og:image,
falling back to <title> and meta description. Stored values are plain text cleaned by nh3."""

import html
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin

import httpx
import nh3

from core.services import safe_fetch

MAX_TITLE = 500
MAX_DESCRIPTION = 2000
MAX_SITE = 200


@dataclass(frozen=True)
class Card:
    url: str  # final URL after redirects
    title: str
    description: str
    site_name: str
    image_url: str  # absolute http(s) URL or ""


class _MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.meta: dict[str, str] = {}
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            values = {k.lower(): v or "" for k, v in attrs}
            name = (values.get("property") or values.get("name") or "").lower()
            if name and name not in self.meta and "content" in values:
                self.meta[name] = values["content"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title and len(self.title) < MAX_TITLE:
            self.title += data


def plain_text(value: str, limit: int) -> str:
    """Strip every tag (nh3), decode entities, collapse whitespace. The result is text, escaped at render."""
    text = html.unescape(nh3.clean(value, tags=set()))
    return " ".join(text.split())[:limit]


def parse(page: safe_fetch.Fetched) -> Card:
    parser = _MetaParser()
    parser.feed(page.body.decode(_charset(page), errors="replace"))
    meta = parser.meta
    image = meta.get("og:image") or meta.get("og:image:url") or meta.get("twitter:image") or ""
    try:
        image_url = urljoin(page.url, image.strip()) if image.strip() else ""
        if httpx.URL(image_url).scheme not in ("http", "https"):
            image_url = ""
    except (ValueError, httpx.InvalidURL):  # malformed og:image: no thumbnail, the card still counts
        image_url = ""
    return Card(
        url=page.url,
        title=plain_text(meta.get("og:title") or parser.title, MAX_TITLE),
        description=plain_text(meta.get("og:description") or meta.get("description", ""), MAX_DESCRIPTION),
        site_name=plain_text(meta.get("og:site_name", ""), MAX_SITE),
        image_url=image_url[:2000],
    )


def _charset(page: safe_fetch.Fetched) -> str:
    candidate = (page.charset or "utf-8").lower()
    try:
        "".encode(candidate)
    except LookupError:
        return "utf-8"
    return candidate


def unfurl(url: str) -> Card:
    return parse(safe_fetch.fetch(url, safe_fetch.HTML_TYPES))
