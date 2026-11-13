"""A tool's logo (DECISIONS 9.10), found by the item_image job (library/jobs.py): the icon of the tool's
official site (core/services/site_icon.py). Some links lead to a page whose icon is the host's, not the
tool's; route() says which:

* github.com/<owner>/<repo>[/...]: the GitHub API (no token, 60 requests an hour) gives the repository's
  homepage; when it is off github.com its site's icon is the logo. A person's repository follows its homepage
  only when the homepage names the repository (onefetch.dev, uptime.kuma.pet, dandavison.github.io/delta):
  a person's own site carries their own mark. With no homepage icon, or only a small one (under
  site_icon.GOOD_SIDE px), the owner's avatar when the owner is an organisation that is the tool itself (its
  login is the repository's name: gitleaks/gitleaks); an umbrella organisation's avatar (grafana/k6,
  pypa/pip-audit) is another mark, and a person's is a face: neither is the tool's logo. github.com/<owner>
  alone: the organisation's avatar. GitHub's own pages (GITHUB_PAGES: /features/..., /search,
  /marketplace...) are GitHub's products, so GitHub's icon is the right one there.
* STORES: a store page whose og:image is the item's own icon, kept only when its URL is the store's icon URL.
* NO_LOGO_HOSTS: other code hosts and stores, whose pages carry their own icon: no logo, no request.

The API's hourly limit: a 403 or 429 is that limit only when /rate_limit (never counted) says no request
remains; the job then waits until the limit resets (RateLimited), and this process asks no more until then.
Any other 403 or 429 is an error that the job retries a few times before it gives up.

Routes follow redirects: a link that lands on a store or a repository (aka.ms/codetour -> the marketplace)
is read as one. Every request goes through safe_fetch: only call this from background jobs.
"""

import enum
import json
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import httpx
from django.utils import timezone

from core.services import safe_fetch, site_icon, thumbnails, unfurl

GITHUB_HOSTS = frozenset({"github.com", "www.github.com"})
GITHUB_API = "https://api.github.com"
RATE_LIMIT_URL = f"{GITHUB_API}/rate_limit"  # never counted against the limit
RATE_LIMIT_WAIT = timedelta(minutes=15)  # when /rate_limit does not say when the limit resets
RESET_MARGIN = timedelta(seconds=30)
MIN_WAIT, MAX_WAIT = timedelta(minutes=1), timedelta(minutes=61)  # the limit without a token is per hour
AVATAR_SIZE = 256  # GitHub's `s` parameter: the avatar at thumbnails.LOGO_SIZE
# First path segments of github.com that are GitHub's own pages, not an account (no account can take them)
GITHUB_PAGES = frozenset(
    {
        "about",
        "account",
        "apps",
        "codespaces",
        "collections",
        "contact",
        "copilot",
        "customer-stories",
        "dashboard",
        "enterprise",
        "events",
        "explore",
        "features",
        "git-guides",
        "issues",
        "join",
        "login",
        "marketplace",
        "mobile",
        "new",
        "notifications",
        "organizations",
        "orgs",
        "pricing",
        "pulls",
        "readme",
        "resources",
        "search",
        "security",
        "settings",
        "signup",
        "site",
        "solutions",
        "sponsors",
        "team",
        "topics",
        "trending",
        "users",
    }
)
_OWNER = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})")
_REPO = re.compile(r"[A-Za-z0-9._-]{1,100}")
_NOT_ALNUM = re.compile(r"[^a-z0-9]")
# Store pages whose og:image is the item's own icon (checked 13/11/2026): the pattern of that icon's URL. Any
# other og:image (a store's card, a person's avatar) is no logo.
STORES = {
    # an extension's icon, also asked by the page itself
    "marketplace.visualstudio.com": re.compile(
        r"https://[a-z0-9-]+\.gallerycdn\.vsassets\.io/extensions/\S+/Microsoft\.VisualStudio\.Services\.Icons\.Default",
        re.IGNORECASE,
    ),
    # an extension's icon (128 px)
    "chromewebstore.google.com": re.compile(r"https://lh3\.googleusercontent\.com/\S+"),
    # a project's or a group's avatar (a user's is a face)
    "gitlab.com": re.compile(r"https://gitlab\.com/uploads/-/system/(?:project|group)/avatar/\S+"),
}
# Code hosts and stores without a cheap, reliable icon of the item (checked 13/11/2026: the page's icon and
# og:image are the host's, or the page needs a script or an API key).
NO_LOGO_HOSTS = frozenset(
    {
        "addons.mozilla.org",
        "apps.apple.com",
        "bitbucket.org",
        "codeberg.org",
        "npmjs.com",
        "play.google.com",
        "pypi.org",
        "sourceforge.net",
        "www.npmjs.com",
    }
)


class Route(enum.Enum):
    SITE = "site"  # the site's own icon
    GITHUB = "github"  # a repository or an account on github.com
    STORE = "store"  # STORES
    NONE = "none"  # NO_LOGO_HOSTS


class RateLimited(Exception):
    """The GitHub API's hourly limit (no token) is used up: ask again after `wait`, when it resets."""

    def __init__(self, message: str, wait: timedelta) -> None:
        super().__init__(message)
        self.wait = wait


# When the API's hourly limit resets, as this process (run_jobs) last saw it used up: until then a repository
# waits without a request.
_limit_resets_at: datetime | None = None


def tool_logo(url: str) -> site_icon.Logo | None:
    """The logo of the tool whose link is `url`, or None when it has none we can tell. Raises FetchBlocked for
    a refused link, FetchError for an error that may go away (try again), ThumbnailError when the link is an
    image that makes no logo, RateLimited while the GitHub API's hourly limit is used up."""
    return _logo(url, github=True)


def route(url: str) -> Route:
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower()
    except ValueError:
        return Route.SITE  # the fetch refuses it
    if host in GITHUB_HOSTS:
        return Route.GITHUB if github_account(parts.path) else Route.SITE
    if host in STORES:
        return Route.STORE
    return Route.NONE if host in NO_LOGO_HOSTS else Route.SITE


def github_account(path: str) -> tuple[str, str] | None:
    """(owner, repository) of a github.com path, the repository "" for an account's own page; None for
    GitHub's own pages."""
    segments = [segment for segment in path.split("/") if segment]
    if not segments or segments[0].lower() in GITHUB_PAGES or not _OWNER.fullmatch(segments[0]):
        return None
    repo = segments[1].removesuffix(".git") if len(segments) > 1 else ""
    if repo and (not _REPO.fullmatch(repo) or repo in (".", "..")):
        return None
    return segments[0], repo


def _logo(url: str, *, github: bool) -> site_icon.Logo | None:
    """`github` False: a repository's homepage, which must not lead back to GitHub."""
    way = route(url)
    if way is Route.GITHUB:
        return _github(url) if github else None
    if way is Route.NONE:
        return None
    page = site_icon.fetch_page(url)
    if page is not None and (landed := route(page.url)) is not way:
        if landed is Route.GITHUB:
            return _github(page.url) if github else None
        if landed is Route.NONE or way is Route.STORE:
            return None  # a store that sent the request elsewhere (a sign-in or consent page) shows no item
        way = landed  # a site that leads to a store
    if way is Route.STORE:
        return _store_icon(page)
    return site_icon.from_page(page, url)


def _github(url: str) -> site_icon.Logo | None:
    account = github_account(urlsplit(url).path)
    if account is None:
        return None
    owner, repo = account
    data = _github_json(f"{GITHUB_API}/repos/{owner}/{repo}" if repo else f"{GITHUB_API}/users/{owner}")
    if data is None:
        return None
    holder = data.get("owner") if repo else data
    holder = holder if isinstance(holder, dict) else {}
    organisation = holder.get("type") == "Organization"
    name = _text(data.get("name")) or repo  # the repository's name now (after a rename or a transfer)
    # an organisation's avatar is the tool's logo only when the organisation is the tool (or the link is the
    # organisation's own page)
    is_the_tool = organisation and (not repo or _alnum(_text(holder.get("login"))) == _alnum(name))
    avatar = _avatar(holder.get("avatar_url")) if is_the_tool else ""
    homepage = _homepage(data.get("homepage")) if repo else ""
    if homepage and not organisation and not names_repository(homepage, name):
        homepage = ""  # a person's own site (a blog, their initials) carries their mark, not the tool's
    site: site_icon.Logo | None = None
    failed: safe_fetch.FetchError | None = None
    if homepage:
        try:
            site = _logo(homepage, github=False)
        except (safe_fetch.FetchBlocked, thumbnails.ThumbnailError):
            pass  # a homepage we may not read, or an image that makes no logo: as if it had none
        except safe_fetch.FetchError as exc:
            failed = exc
    if site is not None and site.side >= site_icon.GOOD_SIDE:
        return site
    # no icon on the homepage, or a small one (a 32 px favicon): the tool's organisation's avatar is sharper
    if avatar:
        try:
            if (logo := site_icon.fetch_logo(avatar)) is not None:
                return logo
        except safe_fetch.FetchError:
            if site is None:
                raise  # nothing else: the avatar may answer next time
    if site is not None:
        return site
    if failed is not None:
        raise failed  # the homepage may answer next time
    return None


def names_repository(url: str, repo: str) -> bool:
    """Whether a URL names the repository: its name in letters and digits is one of the host's labels, or
    labels run together (uptime.kuma.pet for uptime-kuma), or one of the path's segments
    (dandavison.github.io/delta)."""
    target = _alnum(repo)
    if not target:
        return False
    parts = urlsplit(url)
    labels = [_alnum(label) for label in (parts.hostname or "").split(".")]
    for start in range(len(labels)):
        joined = ""
        for label in labels[start:]:
            joined += label
            if len(joined) >= len(target):
                break
        if joined == target:
            return True
    return any(_alnum(segment) == target for segment in parts.path.split("/"))


def _github_json(url: str) -> dict[str, object] | None:
    """The API's answer, or None for a repository or account that is not there (a 4xx: gone, private). Raises
    RateLimited while the hourly limit is used up (without a request once this process has seen it), and the
    FetchError of a 403 or 429 that is not that limit (a block, a short-term limit), which the job retries a
    few times before it gives up."""
    if _limit_resets_at is not None and _limit_resets_at > timezone.now():
        raise RateLimited("GitHub API limit used up", max(_limit_resets_at - timezone.now(), MIN_WAIT))
    try:
        doc = safe_fetch.fetch(url, ("application/json",))
    except safe_fetch.FetchError as exc:
        if exc.status in (403, 429):
            if (wait := _limit_wait()) is not None:
                raise RateLimited(f"GitHub API answered {exc.status}: limit used up", wait) from exc
            raise
        if isinstance(exc, safe_fetch.FetchBlocked) or not site_icon.is_final(exc):
            raise
        return None
    try:
        data = json.loads(doc.body)
    except (ValueError, RecursionError):
        return None
    return data if isinstance(data, dict) else None


def _limit_wait() -> timedelta | None:
    """After a 403 or 429: how long until the hourly limit resets, when /rate_limit says no request remains
    (the reset is then remembered, so the other repositories wait without a request); None when requests
    remain or it cannot be read (the refusal is something else)."""
    global _limit_resets_at  # the limit as this process saw it (module docstring)
    try:
        data = json.loads(safe_fetch.fetch(RATE_LIMIT_URL, ("application/json",)).body)
    except (safe_fetch.FetchError, ValueError, RecursionError):
        return None
    resources = data.get("resources") if isinstance(data, dict) else None
    core = resources.get("core") if isinstance(resources, dict) else None
    if not isinstance(core, dict) or core.get("remaining") != 0:
        return None
    reset = core.get("reset")
    wait = RATE_LIMIT_WAIT
    if isinstance(reset, int) and not isinstance(reset, bool) and 0 < reset < 2**40:
        wait = datetime.fromtimestamp(reset, UTC) - timezone.now() + RESET_MARGIN
    wait = min(max(wait, MIN_WAIT), MAX_WAIT)
    _limit_resets_at = timezone.now() + wait
    return wait


def _alnum(text: str) -> str:
    return _NOT_ALNUM.sub("", text.lower())


def _text(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def _homepage(value: object) -> str:
    """A repository's homepage as an http(s) URL off github.com ("example.com" read as https), else ""."""
    if not isinstance(value, str) or not (text := value.strip()) or len(text) > 2000:
        return ""
    if "://" not in text:
        if ":" in text.partition("/")[0]:
            return ""  # another scheme (mailto:, javascript:)
        text = f"https://{text}"
    try:
        parts = urlsplit(text)
        host = (parts.hostname or "").lower()
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https") or not host or host in GITHUB_HOSTS:
        return ""
    return text


def _avatar(value: object) -> str:
    """An avatar's https URL asked at AVATAR_SIZE px, or ""."""
    if not isinstance(value, str):
        return ""
    try:
        url = httpx.URL(value)
    except (httpx.InvalidURL, ValueError):
        return ""
    if url.scheme != "https" or not url.host:
        return ""
    return str(url.copy_set_param("s", str(AVATAR_SIZE)))


def _store_icon(page: safe_fetch.Fetched | None) -> site_icon.Logo | None:
    """The item's own icon from a STORES page: its og:image, when the URL is the store's icon URL."""
    if page is None or page.content_type not in safe_fetch.HTML_TYPES:
        return None
    pattern = STORES.get((urlsplit(page.url).hostname or "").lower())
    image = unfurl.parse(page).image_url
    if pattern is None or not pattern.fullmatch(image):
        return None
    return site_icon.fetch_logo(image)
