"""RSS 2.0, RSS 1.0 and Atom parsing with the standard library (DECISIONS 5, 10.5).

The body arrives through `safe_fetch` (SSRF guard, 2 MB cap). A document with a DOCTYPE or ENTITY declaration
is refused before parsing (no entity expansion of any kind). Feed text is data: titles and descriptions become
plain text through nh3, and only http(s) links are kept.
"""

import datetime as dt
import email.utils
import hashlib
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from xml.parsers import expat

from core.services.unfurl import plain_text

MAX_ENTRIES = 50  # per feed and fetch
MAX_TITLE = 500
EXCERPT_CHARS = 500  # what the LLM sees (DECISIONS 10.4)
FORBIDDEN = re.compile(rb"<!\s*(DOCTYPE|ENTITY)", re.IGNORECASE)
TRACKING = ("utm_", "fbclid", "gclid", "mc_cid", "mc_eid")


class FeedError(Exception):
    """Not a feed we accept (malformed XML, DOCTYPE, not RSS or Atom)."""


@dataclass(frozen=True)
class Entry:
    title: str
    url: str
    published: dt.datetime | None
    excerpt: str


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _child(node: ET.Element, *names: str) -> ET.Element | None:
    for name in names:
        for child in node:
            if _local(child.tag) == name:
                return child
    return None


def _text(node: ET.Element, *names: str) -> str:
    child = _child(node, *names)
    return "".join(child.itertext()).strip() if child is not None else ""


def _date(value: str) -> dt.datetime | None:
    value = value.strip()
    if not value:
        return None
    try:
        parsed = email.utils.parsedate_to_datetime(value)  # RSS: RFC 822
    except (TypeError, ValueError):
        try:
            parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))  # Atom, dc:date: RFC 3339
        except ValueError:
            return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)


def _link(node: ET.Element, base: str) -> str:
    href = ""
    for child in node:
        if _local(child.tag) != "link":
            continue
        if child.get("href") is not None:  # Atom: the alternate link (rel missing means alternate)
            if child.get("rel", "alternate") == "alternate":
                href = child.get("href", "")
                break
        elif (child.text or "").strip():  # RSS
            href = (child.text or "").strip()
            break
    if not href:
        guid = _child(node, "guid")
        if guid is not None and guid.get("isPermaLink", "true") == "true":
            href = (guid.text or "").strip()
    try:
        url = urljoin(base, href) if href else ""
        return url if urlsplit(url).scheme in ("http", "https") and urlsplit(url).hostname else ""
    except ValueError:
        return ""


def _refuse_declaration(*args: object) -> None:
    raise FeedError("DOCTYPE or ENTITY declaration refused")


def parse(body: bytes, base_url: str) -> list[Entry]:
    """The newest MAX_ENTRIES entries with a title and an http(s) link, in feed order."""
    if FORBIDDEN.search(body):
        raise FeedError("DOCTYPE or ENTITY declaration refused")
    # The regex is a fast path; the parser hooks also catch encodings it cannot see (e.g. UTF-16).
    scan = expat.ParserCreate()
    scan.StartDoctypeDeclHandler = _refuse_declaration
    scan.EntityDeclHandler = _refuse_declaration
    try:
        scan.Parse(body, True)
        root = ET.fromstring(body)  # noqa: S314  no DOCTYPE or ENTITY declaration got this far
    except (expat.ExpatError, ET.ParseError) as exc:
        raise FeedError(f"malformed XML: {exc}") from exc
    if _local(root.tag) not in ("rss", "rdf", "feed"):
        raise FeedError(f"not a feed: <{_local(root.tag)}>")
    entries: list[Entry] = []
    for node in root.iter():
        if _local(node.tag) not in ("item", "entry"):
            continue
        title = plain_text(_text(node, "title"), MAX_TITLE)
        url = _link(node, base_url)
        if not title or not url or len(url) > 2000:
            continue
        description = _text(node, "description", "summary", "encoded", "content")
        published = _date(_text(node, "pubdate", "published", "date", "updated"))
        entries.append(Entry(title, url, published, plain_text(description, EXCERPT_CHARS)))
        if len(entries) >= MAX_ENTRIES:
            break
    return entries


def normalize_url(url: str) -> str:
    """Lowercase scheme and host, no fragment, no tracking parameters."""
    parts = urlsplit(url.strip())
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if not k.startswith(TRACKING)]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", urlencode(query), ""))


def dedupe_key(title: str, url: str) -> str:
    """sha256 of the normalised title and URL (DECISIONS 10.4): the same story is stored and tagged once."""
    material = " ".join(title.casefold().split()) + "\n" + normalize_url(url)
    return hashlib.sha256(material.encode()).hexdigest()
