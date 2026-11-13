"""OpenGraph card data for a link (DECISIONS 10.7): og:title, og:description, og:site_name, og:image,
falling back to <title> and meta description. Stored values are plain text cleaned by nh3.

The page is third-party input (security audit S-07, S-08): only the charsets browsers use are decoded
(punycode or idna from a Content-Type header would be slow or raise), each value is cut before nh3 sees it,
and a malformed character reference ends as an empty field, never as an exception."""

import codecs
import contextlib
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
# What nh3 and the entity decoder get of a raw value: a small multiple of the longest field (tags and
# entities shrink when stripped). nh3 is superlinear in nesting depth, so the 2 MiB page cap is too much.
MAX_RAW = 4 * MAX_DESCRIPTION
# Codec names (codecs.lookup(...).name) of the charsets a page may declare; anything else reads as UTF-8.
CHARSETS = frozenset(
    {
        "utf-8",
        "utf-8-sig",
        "ascii",
        "latin-1",
        "koi8-r",
        "koi8-u",
        "shift_jis",
        "euc_jp",
        "iso2022_jp",
        "gb2312",
        "gbk",
        "gb18030",
        "big5",
        "euc_kr",
        "cp949",
        "cp874",
        "utf-16",
        "utf-16-le",
        "utf-16-be",
    }
    | {f"iso8859-{n}" for n in range(2, 17)}
    | {f"cp125{n}" for n in range(9)}
)


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
    try:
        text = html.unescape(nh3.clean(value[:MAX_RAW], tags=set()))
    except ValueError:  # a character reference too long to convert
        return ""
    return " ".join(text.split())[:limit]


def page_text(page: safe_fetch.Fetched) -> str:
    """The page's HTML as text, in its declared charset when browsers use it, else UTF-8."""
    return page.body.decode(_charset(page), errors="replace")


def parse(page: safe_fetch.Fetched) -> Card:
    parser = _MetaParser()
    # a malformed character reference raises ValueError: keep what was read before it
    with contextlib.suppress(ValueError):
        parser.feed(page_text(page))
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
    try:
        name = codecs.lookup((page.charset or "utf-8").strip()).name
    except (LookupError, ValueError):
        return "utf-8"
    return name if name in CHARSETS else "utf-8"


def unfurl(url: str) -> Card:
    return parse(safe_fetch.fetch(url, safe_fetch.HTML_TYPES))
