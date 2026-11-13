"""A site's icon as a logo (DECISIONS 9.10: a tool's logo is the icon of its official site; library/logos.py
says which site that is).

The candidates: the icons the page declares (`<link rel>` apple-touch-icon and -precomposed, icon, shortcut
icon, also inline as a data: URL; a mask-icon is a one-colour outline for Safari's pinned tabs, and an icon
for a dark colour scheme is a light drawing that would vanish on the logo's white ground: both are left out),
the raster icons of its web app manifest when it links one, and the two files browsers ask a site's root for,
/apple-touch-icon.png and /favicon.ico (not on PLATFORM_HOSTS, which answer them with their own icon for every
site they host). On a project's page on PROJECT_PAGE_HOSTS (user.github.io/project/) the site's root and
everything above the project's path is its owner's site, whose icon is the owner's mark: left out. A small
page that only redirects with <meta http-equiv="refresh"> is followed once. rank() orders the candidates by
how useful they are as a logo; they are tried in that order, at most MAX_FETCHES: the first raster image
whose smaller side is at least GOOD_SIDE px is kept, else the largest of at least thumbnails.LOGO_MIN_SIDE px
among those tried, re-encoded by thumbnails.logo_to_webp (at most LOGO_SIZE px, never enlarged, transparency
kept, a wide white or transparent margin trimmed). When no candidate makes a logo at all, the last resort is a
raster logo the page itself shows (page_logo: a square og:image, else an <img> the page names as its logo).
DEFAULT_ICONS (a host's or a docs theme's own icon) are never a logo. SVG is never fetched or stored (there is
no rasteriser): an SVG icon is skipped, and the guard refuses an SVG answer.

Every request goes through safe_fetch (SSRF guard, 10 s, 2 MB): only call this from background jobs.
"""

import base64
import binascii
import contextlib
import hashlib
import io
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx
from PIL import Image

from core.services import safe_fetch, thumbnails, unfurl

ICON_TYPES = (
    *safe_fetch.IMAGE_TYPES,
    "image/jpg",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/ico",
    "image/icon",
    # an icon in a bucket without a type: Pillow reads the bytes, never the type the server claims
    "application/octet-stream",
)
MANIFEST_TYPES = ("application/manifest+json", "application/json", "text/plain", "application/octet-stream")
MAX_FETCHES = 5  # icons tried per site, each within safe_fetch's deadline
MAX_CANDIDATES = 40  # icon links, and manifest icons, read per document
TOUCH_SIZE = 180  # an apple-touch-icon without `sizes` (iOS's size since 2014)
GOOD_SIZES = range(128, 513)  # sharp at LOGO_SIZE px, and still a small download
GOOD_SIDE = 64  # an icon this big is taken at once; a smaller one only when no other gives a bigger one
REFRESH_PAGE_MAX = 16 * 1024  # a page that only redirects with a meta refresh is small
REFRESH_DELAY = 5  # seconds: a page that refreshes later is a page, not a redirect
# Hosts that answer /favicon.ico with their own icon for every site on them (checked 13/11/2026): there only
# the icons a page declares are the site's.
PLATFORM_HOSTS = ("readthedocs.io", "readthedocs-hosted.com")
# Hosts that serve a user's own site at <user>.<host>/ and each of their projects' at <user>.<host>/<project>/
# (checked 13/11/2026): on a project's page, the files above the project's path are the user's (their initials
# on junegunn.github.io for fzf's docs), not the project's.
PROJECT_PAGE_HOSTS = ("github.io", "gitlab.io")
# Icons that a host or a docs theme serves for every site without one of its own: never a tool's logo
# (SHA-256 of the bytes as served, each seen on several sites, 13/11/2026).
DEFAULT_ICONS = frozenset(
    {
        # Read the Docs' /favicon.ico, also on a project's own domain (docs.pytest.org)
        "4572d525a087c261031a23447de6eaaa37e399bd8283f6aaed7f1f23a66c9efd",
        # mdBook's default theme favicon.png (dandavison.github.io/delta, rustwasm.github.io/docs/book)
        "8114d1fc74f4b5621ad9afde7746ed9cf7e420be317a6e29023d2298d58aa15b",
    }
)
# The last resort (page_logo), checked on the tools' real sites (13/11/2026: pytest's sidebar logo,
# Prometheus's square og:image, lefthook's <img alt="Logo">); a looser rule took a cartoon of a logo and a
# showcase picture.
PAGE_LOGO_FETCHES = 2  # images the last resort fetches per page
MAX_LOGO_IMAGES = 3  # <img> elements named as the logo, read per page
SQUARE = 0.1  # an og:image whose sides differ by at most this share of the longer one is square
LOGO_IMAGE_ASPECT = 2.0  # a logo <img> is at most this many times wider than high (or higher than wide)
LOGO_ALT_WORDS = 3  # a longer alt describes a picture ("a cartoon showing the logo..."), not the logo
INLINE_TYPES = frozenset(ICON_TYPES) - {"application/octet-stream"}  # data:image/...;base64 icons
TOUCH_RELS = frozenset({"apple-touch-icon", "apple-touch-icon-precomposed"})
OG_IMAGE_KEYS = frozenset({"og:image", "og:image:url", "og:image:secure_url"})
_SIZES = re.compile(r"(\d{1,4})[xX](\d{1,4})")
_NAMED_SIZE = re.compile(r"(?<![0-9])(\d{2,4})x(\d{2,4})(?![0-9])")  # favicon-32x32.png
_INLINE = re.compile(r"data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)", re.IGNORECASE)
_REFRESH = re.compile(r"\s*(\d{1,6})(?:\.\d*)?\s*[;,]\s*(?:url\s*=\s*)?(.*)", re.IGNORECASE | re.DOTALL)
_DARK = re.compile(r"prefers-color-scheme\s*:\s*dark", re.IGNORECASE)
_WORDS = re.compile(r"[a-z]+")
_PIXELS = re.compile(r"[0-9]{1,5}")
_NOT_ALNUM = re.compile(r"[^a-z0-9]")


@dataclass(frozen=True)
class Candidate:
    url: str  # http(s), or a data: URL (an icon inline in the page)
    size: int | None  # the declared size (a square's side; the smaller side otherwise), None when unknown
    touch: bool = False  # an apple-touch-icon: TOUCH_SIZE when it declares no size
    maskable: bool = False  # a manifest icon only for masks: the logo inside a padded square
    guessed: bool = False  # a file at the site's root that no page named: it may not exist


@dataclass(frozen=True)
class Logo:
    webp: bytes  # thumbnails.logo_to_webp
    url: str  # where the icon was found (after redirects; "data:<type>" for an inline icon)
    side: int  # the stored logo's smaller side, px

    @classmethod
    def of(cls, webp: bytes, url: str) -> "Logo":
        with Image.open(io.BytesIO(webp)) as image:
            return cls(webp, url, min(image.size))


def find(url: str) -> Logo | None:
    """The logo of the site at `url` (fetch_page, then from_page)."""
    return from_page(fetch_page(url), url)


def fetch_page(url: str) -> safe_fetch.Fetched | None:
    """The page at `url` (HTML, or an image when the link is the icon itself), or None when the site answers
    with a 4xx (gone, or a wall for robots) or with an answer the guard refuses that is no image (a page over
    2 MB or compressed, a PDF): the files at its root may still answer. A small page that only redirects with
    a meta refresh is followed once; when that fails for any reason, the page itself is kept. A refused
    address raises FetchBlocked, an error that may go away FetchError."""
    page = _get(url)
    if page is not None and (target := refresh_target(page)) is not None:
        with contextlib.suppress(safe_fetch.FetchError):  # following it is optional
            page = _get(target) or page
    return page


def from_page(page: safe_fetch.Fetched | None, url: str) -> Logo | None:
    """The logo of the page fetched from `url` (None: no page to read, fetch_page), or None when nothing makes
    one. An image instead of a page is the logo itself (ThumbnailError when it makes none). When nothing
    makes a logo and a candidate failed for a reason that may go away (a timeout, a 5xx), that error is
    raised, so the job is retried."""
    if page is not None and page.content_type not in safe_fetch.HTML_TYPES:
        return Logo.of(thumbnails.logo_to_webp(page.body), page.url)
    parsed = _parse(page) if page is not None else None
    candidates: list[Candidate] = []
    error: safe_fetch.FetchError | None = None
    if page is not None and parsed is not None:
        declared, manifest = _declared(page, parsed)
        candidates += declared
        if manifest:
            try:
                candidates += manifest_candidates(safe_fetch.fetch(manifest, MANIFEST_TYPES))
            except safe_fetch.FetchError as exc:
                error = None if is_final(exc) else exc
    candidates += root_candidates(page.url if page is not None else url)
    logo, failed = _best_logo(rank(candidates))
    if logo is None and page is not None and parsed is not None:
        logo = page_logo(page, parsed)
    if logo is None and (failed := failed or error) is not None:
        raise failed
    return logo


def fetch_logo(url: str) -> Logo | None:
    """The image at `url` as a logo (an organisation's avatar, a store's icon of the item), or None when it is
    refused, missing (a 4xx) or makes no logo. An error that may go away raises FetchError."""
    logo, failed = _best_logo([Candidate(url, None)])
    if failed is not None:
        raise failed
    return logo


def is_final(exc: safe_fetch.FetchError) -> bool:
    """Whether trying again cannot help: the guard refused it, or the server gave an answer other than an
    error that may go away (any status under 500 but 408 and 429: a 404, a 403 wall, a 204 for a silenced
    favicon)."""
    if isinstance(exc, safe_fetch.FetchBlocked):
        return True
    return exc.status is not None and exc.status < 500 and exc.status not in (408, 429)


def refresh_target(page: safe_fetch.Fetched) -> str | None:
    """Where a small HTML page that only redirects with <meta http-equiv="refresh"> (within REFRESH_DELAY s)
    sends the browser, as an http(s) URL other than the page's; else None."""
    if page.content_type not in safe_fetch.HTML_TYPES or len(page.body) > REFRESH_PAGE_MAX:
        return None
    if b"refresh" not in page.body.lower():
        return None
    match = _REFRESH.fullmatch(_parse(page).refresh)
    if match is None or int(match.group(1)) > REFRESH_DELAY:
        return None
    target = _absolute(page.url, match.group(2).strip().strip("'\""))
    return target if target != page.url else None


def _get(url: str) -> safe_fetch.Fetched | None:
    try:
        return safe_fetch.fetch(url, safe_fetch.HTML_TYPES + ICON_TYPES)
    except safe_fetch.ResponseRefused as exc:
        if exc.content_type in ICON_TYPES:
            raise  # the link is an image we may not take: no other file of the site is its logo
        return None
    except safe_fetch.FetchError as exc:
        if isinstance(exc, safe_fetch.FetchBlocked) or not is_final(exc):
            raise
        return None


def _best_logo(candidates: list[Candidate]) -> tuple[Logo | None, safe_fetch.FetchError | None]:
    """Among the first MAX_FETCHES candidates: the first that makes a logo of GOOD_SIDE px or more, else the
    largest one that makes a logo at all; with no logo, the first error among them that may go away."""
    best: Logo | None = None
    failed: safe_fetch.FetchError | None = None
    for candidate in candidates[:MAX_FETCHES]:
        try:
            if candidate.url.startswith("data:"):
                body, url = _inline_icon(candidate.url), candidate.url.partition(";")[0]
            else:
                icon = safe_fetch.fetch(candidate.url, ICON_TYPES)
                body, url = icon.body, icon.url
            if not body or hashlib.sha256(body).hexdigest() in DEFAULT_ICONS:
                continue
            logo = Logo.of(thumbnails.logo_to_webp(body), url)
        except thumbnails.ThumbnailError:
            continue  # not an image Pillow reads (SVG, HTML, a broken file), too small or blank
        except safe_fetch.FetchError as exc:
            if failed is None and not is_final(exc):
                failed = exc
            continue
        if logo.side >= GOOD_SIDE:
            return logo, None
        if best is None or logo.side > best.side:
            best = logo
    return best, None if best is not None else failed


def _inline_icon(url: str) -> bytes:
    """The bytes of a base64 data: URL of a raster image type, else b"" (no request: the page holds them)."""
    match = _INLINE.fullmatch(url)
    if match is None or match.group(1).lower() not in INLINE_TYPES:
        return b""
    try:
        return base64.b64decode("".join(match.group(2).split()), validate=True)
    except (binascii.Error, ValueError):
        return b""


# --- the last resort: a logo the page shows -----------------------------------------------------------------


def page_logo(page: safe_fetch.Fetched, parsed: "_IconLinks | None" = None) -> Logo | None:
    """A raster logo the page itself shows, the last resort when no icon makes a logo: its og:image when it is
    square (declared, then measured: sides within SQUARE), else an <img> the page names as its logo (a short
    alt or a class with the word "logo") whose file name holds "logo" or the site's name, at most
    LOGO_IMAGE_ASPECT:1. At most PAGE_LOGO_FETCHES images are fetched, the og:image first; any error leaves
    this resort without a logo (the icons' error, if any, is the one the job sees)."""
    parsed = parsed if parsed is not None else _parse(page)
    base = _base(page, parsed)
    tries: list[tuple[str, float]] = []  # (URL, the largest aspect ratio it may have)
    og = _absolute(base, parsed.og_image) if parsed.og_image else None
    if og is not None and not _is_svg(og, "") and _may_be_square(parsed.og_width, parsed.og_height):
        tries.append((og, 1 / (1 - SQUARE)))
    site = _site_name(page.url)
    for src in parsed.logo_images:
        url = _absolute(base, src)
        if url is not None and not _is_svg(url, "") and _logo_file(url, site):
            tries.append((url, LOGO_IMAGE_ASPECT))
    for url, aspect in tries[:PAGE_LOGO_FETCHES]:
        try:
            image = safe_fetch.fetch(url, ICON_TYPES)
            webp = thumbnails.logo_to_webp(image.body)
            width, height = thumbnails.image_size(image.body)  # the picture as published, before any trim
        except (safe_fetch.FetchError, thumbnails.ThumbnailError):
            continue
        if max(width, height) <= aspect * min(width, height):
            return Logo.of(webp, image.url)
    return None


def _may_be_square(width: str, height: str) -> bool:
    """False only when the page declares the og:image's size and it is not square."""
    if not (_PIXELS.fullmatch(width) and _PIXELS.fullmatch(height)):
        return True  # no size, or not one we read: measured once fetched
    w, h = int(width), int(height)
    return min(w, h) > 0 and abs(w - h) <= SQUARE * max(w, h)


def _site_name(url: str) -> str:
    """The site's name as its host says it (lefthook.dev, docs.pytest.org: the label before the last), in
    letters and digits."""
    labels = (urlsplit(url).hostname or "").split(".")
    return _NOT_ALNUM.sub("", (labels[-2] if len(labels) > 1 else labels[0]).lower())


def _logo_file(url: str, site: str) -> bool:
    """Whether an image's file name names a logo: it holds "logo" or the site's name (lefthook.png)."""
    name = urlsplit(url).path.rpartition("/")[2].lower()
    return "logo" in name or (len(site) >= 3 and site in _NOT_ALNUM.sub("", name))


# --- candidates ---------------------------------------------------------------------------------------------


class _IconLinks(HTMLParser):
    """What a page says about its icons and its logo, in document order: the <base href>, the icon links (an
    icon for a dark colour scheme left out), the first manifest link, the first meta refresh, the og:image
    with the size it declares, and the <img> elements named as the page's logo."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.base = ""
        self.manifest = ""
        self.refresh = ""
        self.links: list[tuple[bool, str, str, str]] = []  # (apple-touch-icon, href, sizes, type)
        self.og_image = self.og_width = self.og_height = ""
        self.logo_images: list[str] = []  # their src

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag not in ("link", "base", "meta", "img"):
            return
        values = {name.lower(): (value or "").strip() for name, value in attrs}
        if tag == "meta":
            self._meta(values)
        elif tag == "img":
            self._img(values)
        elif href := values.get("href", ""):
            if tag == "base":
                self.base = self.base or href
            else:
                self._link(values, href)

    def _meta(self, values: dict[str, str]) -> None:
        if values.get("http-equiv", "").lower() == "refresh" and not self.refresh:
            self.refresh = values.get("content", "")
        key = (values.get("property") or values.get("name") or "").lower()
        content = values.get("content", "")
        if key in OG_IMAGE_KEYS and content and not self.og_image:
            self.og_image = content
        elif key == "og:image:width" and self.og_image and not self.og_width:
            self.og_width = content
        elif key == "og:image:height" and self.og_image and not self.og_height:
            self.og_height = content

    def _img(self, values: dict[str, str]) -> None:
        alt, src = values.get("alt", ""), values.get("src", "")
        words = set(_WORDS.findall(f"{alt} {values.get('class', '')}".lower()))
        short = len(alt.split()) <= LOGO_ALT_WORDS
        if src and "logo" in words and short and len(self.logo_images) < MAX_LOGO_IMAGES:
            self.logo_images.append(src)

    def _link(self, values: dict[str, str], href: str) -> None:
        rel = set(values.get("rel", "").lower().split())
        if "manifest" in rel and not self.manifest:
            self.manifest = href
        touch = bool(rel & TOUCH_RELS)
        if not (touch or "icon" in rel) or _DARK.search(values.get("media", "")):
            return
        if len(self.links) < MAX_CANDIDATES:
            self.links.append((touch, href, values.get("sizes", ""), values.get("type", "")))


def _parse(page: safe_fetch.Fetched) -> _IconLinks:
    parser = _IconLinks()
    with contextlib.suppress(*unfurl.PARSE_ERRORS):  # markup it cannot read: keep what was read before it
        parser.feed(unfurl.page_text(page))
    return parser


def page_candidates(page: safe_fetch.Fetched) -> tuple[list[Candidate], str]:
    """The raster icons the page declares, their hrefs read against its <base href> and final URL (an inline
    data: URL as it is), and the absolute URL of its manifest ("" without one); on a project's page on
    PROJECT_PAGE_HOSTS, none from above the project's path."""
    return _declared(page, _parse(page))


def _declared(page: safe_fetch.Fetched, parsed: _IconLinks) -> tuple[list[Candidate], str]:
    base = _base(page, parsed)
    candidates = []
    for touch, href, sizes, kind in parsed.links:
        if href[:5].lower() == "data:":
            inline = _INLINE.fullmatch(href)
            if inline is not None and inline.group(1).lower() in INLINE_TYPES:
                candidates.append(Candidate(href, _declared_size(sizes, ""), touch=touch))
            continue
        url = _absolute(base, href)
        if url is not None and not _is_svg(url, kind) and not _above_project(page.url, url):
            candidates.append(Candidate(url, _declared_size(sizes, url), touch=touch))
    manifest = _absolute(base, parsed.manifest) if parsed.manifest else None
    if manifest is not None and _above_project(page.url, manifest):
        manifest = None
    return candidates, manifest or ""


def manifest_candidates(doc: safe_fetch.Fetched) -> list[Candidate]:
    """The raster icons of a web app manifest, their src read against the manifest's URL; an icon only for a
    monochrome mask is left out, and one only for masks is marked maskable."""
    try:
        data = json.loads(doc.body.decode("utf-8-sig", errors="replace"))
    except (ValueError, RecursionError):
        return []
    icons = data.get("icons") if isinstance(data, dict) else None
    if not isinstance(icons, list):
        return []
    candidates = []
    for icon in icons[:MAX_CANDIDATES]:
        if not isinstance(icon, dict):
            continue
        src, sizes, kind, purpose = (_text(icon.get(key)) for key in ("src", "sizes", "type", "purpose"))
        purposes = set(purpose.lower().split()) or {"any"}
        url = _absolute(doc.url, src)
        if url is None or _is_svg(url, kind) or not purposes & {"any", "maskable"}:
            continue
        if _above_project(doc.url, url):
            continue
        candidates.append(Candidate(url, _declared_size(sizes, url), maskable="any" not in purposes))
    return candidates


def root_candidates(url: str) -> list[Candidate]:
    """/apple-touch-icon.png and /favicon.ico at the root of `url`'s site, which browsers ask for when a page
    names no icon; none on PLATFORM_HOSTS, nor for a project's page on PROJECT_PAGE_HOSTS (that root is its
    owner's site)."""
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
    except ValueError:
        return []
    if parts.scheme not in ("http", "https") or not host:
        return []
    if any(host == platform or host.endswith(f".{platform}") for platform in PLATFORM_HOSTS):
        return []
    if _project_path(url) is not None:
        return []
    origin = f"{parts.scheme}://{parts.netloc.rpartition('@')[2]}"
    return [
        Candidate(f"{origin}/apple-touch-icon.png", None, touch=True, guessed=True),
        Candidate(f"{origin}/favicon.ico", None, guessed=True),
    ]


def _project_path(url: str) -> str | None:
    """The path a project's page on PROJECT_PAGE_HOSTS lives under ("/fzf/"), else None (another host, or a
    user's own site at the root)."""
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
    except ValueError:
        return None
    if not any(host.endswith(f".{platform}") for platform in PROJECT_PAGE_HOSTS):
        return None
    project = parts.path.lstrip("/").partition("/")[0]
    return f"/{project.lower()}/" if project else None


def _above_project(page_url: str, url: str) -> bool:
    """Whether `url` is a file of the site that hosts a project's page (PROJECT_PAGE_HOSTS) but outside the
    project's path: its owner's."""
    project = _project_path(page_url)
    if project is None:
        return False
    try:
        parts, page = urlsplit(url), urlsplit(page_url)
    except ValueError:
        return False
    same_site = (parts.hostname or "").lower() == (page.hostname or "").lower()
    return same_site and not parts.path.lower().startswith(project)


def rank(candidates: list[Candidate]) -> list[Candidate]:
    """The most useful first, each URL once: declared sizes of 128-512 px (an apple-touch-icon without one
    counts as TOUCH_SIZE), larger first; then larger declared sizes, nearest first; then declared sizes from
    LOGO_MIN_SIDE up, larger first; then icons of unknown size, in page order; then smaller ones. Within one
    group an icon for any use comes before one only for masks, and the icons a page named before a guessed
    file at the site's root."""

    def key(candidate: Candidate) -> tuple[int, bool, bool, int]:
        size = candidate.size if candidate.size is not None else TOUCH_SIZE if candidate.touch else None
        if size is None:
            return 3, candidate.maskable, candidate.guessed, 0
        if size in GOOD_SIZES:
            group, order = 0, -size
        elif size > GOOD_SIZES[-1]:
            group, order = 1, size
        else:
            group, order = (2 if size >= thumbnails.LOGO_MIN_SIDE else 4), -size
        return group, candidate.maskable, candidate.guessed, order

    seen: set[str] = set()
    ranked = []
    for candidate in sorted(candidates, key=key):  # sorted() is stable: page order within a group
        if candidate.url not in seen:
            seen.add(candidate.url)
            ranked.append(candidate)
    return ranked


def _declared_size(sizes: str, url: str) -> int | None:
    """The largest size in `sizes` ("16x16 32x32"; "any" is a vector, no size), else one in the file's name
    (favicon-32x32.png), else None. A size is the smaller side of its box."""
    if found := [min(int(width), int(height)) for width, height in _SIZES.findall(sizes)]:
        return max(found)
    name = urlsplit(url).path.rpartition("/")[2]
    if (match := _NAMED_SIZE.search(name)) and match.group(1) == match.group(2):
        return int(match.group(1))
    return None


def _is_svg(url: str, kind: str) -> bool:
    return kind.lower().startswith("image/svg") or urlsplit(url).path.lower().endswith((".svg", ".svgz"))


def _base(page: safe_fetch.Fetched, parsed: _IconLinks) -> str:
    """What the page's relative URLs are read against: its <base href>, else its final URL."""
    return (_absolute(page.url, parsed.base) or page.url) if parsed.base else page.url


def _absolute(base: str, href: str) -> str | None:
    """`href` read against `base`, when it is an http(s) URL (not data:, javascript: or a broken one)."""
    if not href or len(href) > 2000:
        return None
    try:
        url = urljoin(base, href)
        if httpx.URL(url).scheme not in ("http", "https"):
            return None
    except (ValueError, httpx.InvalidURL):
        return None
    return url


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""
