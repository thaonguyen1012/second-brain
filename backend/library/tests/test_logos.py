"""A tool's logo (library/logos.py, DECISIONS 9.10): which site's icon is the tool's, GitHub repositories and
stores, with fake DNS and HTTP (no test reaches the network)."""

import datetime as dt
import io
import json
from typing import Any

import pytest
from django.utils import timezone
from PIL import Image

from core.services import safe_fetch
from core.testing import icon_bytes
from core.tests.fakenet import FakeNet, Files, files, redirect
from library import logos
from library.logos import Route

PUBLIC = "93.184.215.14"
AVATAR = "https://avatars.githubusercontent.com/u/9919?v=4"
TOUCH_PAGE = '<link rel="apple-touch-icon" href="/touch.png">'


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch) -> FakeNet:
    fake = FakeNet(monkeypatch)
    site(fake, "avatars.githubusercontent.com", {"/u/9919": ("image/png", icon_bytes((460, 460), "black"))})
    return fake


def site(net: FakeNet, host: str, paths: Files) -> None:
    net.site(host, PUBLIC, files(paths))


def api(net: FakeNet, answers: dict[str, dict[str, Any] | int]) -> None:
    """api.github.com answering each path with its JSON (or a bare status)."""
    site(
        net,
        "api.github.com",
        {
            path: answer if isinstance(answer, int) else ("application/json", json.dumps(answer))
            for path, answer in answers.items()
        },
    )


def repo(
    homepage: str | None, kind: str = "Organization", login: str = "acme", name: str = "tool"
) -> dict[str, Any]:
    """The API's answer for a repository: an organisation is the tool itself only when its login is the
    repository's name."""
    return {"name": name, "homepage": homepage, "owner": {"type": kind, "login": login, "avatar_url": AVATAR}}


def asked(net: FakeNet) -> list[str]:
    return [f"{r.headers['host']}{r.url.path}" for r in net.requests]


def logo_from(url: str) -> str:
    logo = logos.tool_logo(url)
    assert logo is not None, url
    with Image.open(io.BytesIO(logo.webp)) as image:
        assert image.format == "WEBP" and max(image.size) <= 256
    return logo.url


def test_route() -> None:
    cases = {
        "https://github.com/acme/tool": Route.GITHUB,
        "https://github.com/acme/tool.git": Route.GITHUB,
        "https://www.github.com/acme/tool/tree/main/docs": Route.GITHUB,
        "https://github.com/acme": Route.GITHUB,  # an account's page: its avatar when an organisation
        "https://github.com/features/actions": Route.SITE,  # GitHub's own product: GitHub's icon
        "https://github.com/search?type=code": Route.SITE,
        "https://github.com/marketplace/actions/x": Route.SITE,
        "https://github.com/": Route.SITE,
        "https://github.com/-bad/x": Route.SITE,
        "https://docs.github.com/en/code-security/dependabot": Route.SITE,
        "https://marketplace.visualstudio.com/items?itemName=acme.tool": Route.STORE,
        "https://chromewebstore.google.com/detail/tool/abc": Route.STORE,
        "https://gitlab.com/acme/tool": Route.STORE,
        "https://pypi.org/project/tool/": Route.NONE,
        "https://www.npmjs.com/package/tool": Route.NONE,
        "https://docs.npmjs.com/cli/commands/npm-audit": Route.SITE,  # npm's own docs: npm's icon
        "https://tool.test/": Route.SITE,
        "http://[::1": Route.SITE,  # the fetch refuses it
    }
    assert {url: logos.route(url) for url in cases} == cases
    assert logos.github_account("/acme/tool/blob/main/README.md") == ("acme", "tool")
    assert logos.github_account("/acme/") == ("acme", "")
    assert logos.github_account("/acme/..") is None
    assert logos.github_account("/Features/x") is None


def test_a_repository_with_a_homepage_takes_its_sites_icon(net: FakeNet) -> None:
    api(net, {"/repos/acme/tool": repo("tool.test")})  # a homepage written without its scheme
    site(
        net,
        "tool.test",
        {"/": ("text/html", TOUCH_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))},
    )
    assert logo_from("https://github.com/acme/tool/tree/main") == "https://tool.test/touch.png"
    assert asked(net) == ["api.github.com/repos/acme/tool", "tool.test/", "tool.test/touch.png"]
    assert net.requests[0].headers["accept"] == "application/json"


def test_an_organisation_that_is_the_tool_gives_its_avatar_when_no_homepage_does(net: FakeNet) -> None:
    site(net, "plain.test", {"/": ("text/html", "<title>No icon</title>")})
    for homepage in (
        None,
        "",
        "https://github.com/gitleaks/gitleaks#readme",
        "javascript:alert(1)",
        "https://plain.test/",
    ):
        api(net, {"/repos/gitleaks/gitleaks": repo(homepage, login="gitleaks", name="gitleaks")})
        net.requests.clear()
        assert logo_from("https://github.com/gitleaks/gitleaks") == f"{AVATAR}&s=256"
        avatar = net.requests[-1]
        assert (avatar.headers["host"], avatar.url.params["s"], avatar.url.params["v"]) == (
            "avatars.githubusercontent.com",
            "256",
            "4",
        )
        assert "github.com" not in [r.headers["host"] for r in net.requests]  # never the repository page
    # the same name in letters and digits, whatever the case and the marks between them
    api(net, {"/repos/arzzen/git-quick-stats": repo(None, login="Git-Quick-Stats", name="git_quick.stats")})
    assert logo_from("https://github.com/arzzen/git-quick-stats") == f"{AVATAR}&s=256"


def test_an_umbrella_organisations_avatar_is_not_the_tools_logo(net: FakeNet) -> None:
    """grafana/k6, pypa/pip-audit, PyCQA/bandit: the organisation's mark is another product's or a group's."""
    api(net, {"/repos/pypa/pip-audit": repo(None, login="pypa", name="pip-audit")})
    assert logos.tool_logo("https://github.com/pypa/pip-audit") is None
    assert asked(net) == ["api.github.com/repos/pypa/pip-audit"]  # no avatar asked
    # its homepage is still the tool's site
    site(
        net,
        "tool.test",
        {
            "/": ("text/html", '<link rel="icon" href="/fav32.png">'),
            "/fav32.png": ("image/png", icon_bytes((32, 32))),
        },
    )
    api(net, {"/repos/grafana/k6": repo("https://tool.test/", login="grafana", name="k6")})
    assert (
        logo_from("https://github.com/grafana/k6") == "https://tool.test/fav32.png"
    )  # small, but its own site's
    assert "avatars.githubusercontent.com" not in [r.headers["host"] for r in net.requests]


def test_a_persons_repository_gives_no_logo_but_the_site_that_names_it(net: FakeNet) -> None:
    api(net, {"/repos/someone/tool": repo(None, kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None  # a face is not a tool's logo
    assert asked(net) == ["api.github.com/repos/someone/tool"]
    touch: Files = {"/": ("text/html", TOUCH_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))}
    for host in ("tool.test", "uptime.kuma.test", "blog.test"):
        site(net, host, touch)
    api(
        net,
        {
            "/repos/someone/tool": repo("https://tool.test/", kind="User"),  # the host names the repository
            "/repos/someone/uptime-kuma": repo("uptime.kuma.test", kind="User", name="uptime-kuma"),
            "/repos/someone/notes": repo("https://blog.test/about", kind="User", name="notes"),
        },
    )
    assert logo_from("https://github.com/someone/tool") == "https://tool.test/touch.png"
    assert logo_from("https://github.com/someone/uptime-kuma") == "https://uptime.kuma.test/touch.png"
    net.requests.clear()
    # a person's own site carries their mark, not the tool's: never asked
    assert logos.tool_logo("https://github.com/someone/notes") is None
    assert asked(net) == ["api.github.com/repos/someone/notes"]


def test_a_project_page_of_a_persons_site_never_gives_the_persons_icon(net: FakeNet) -> None:
    """fzf's docs on junegunn.github.io/fzf/: the site's root holds the author's initials, not fzf's logo."""
    site(
        net,
        "someone.github.io",
        {
            "/tool/": (
                "text/html",
                '<link rel="icon" href="/favicon.ico"><link rel="manifest" href="/m.json">',
            ),
            "/favicon.ico": ("image/png", icon_bytes((180, 180), "black")),
            "/apple-touch-icon.png": ("image/png", icon_bytes((180, 180), "black")),
            "/m.json": ("application/json", json.dumps({"icons": [{"src": "/i.png", "sizes": "512x512"}]})),
            "/tool/icon.png": ("image/png", icon_bytes((128, 128))),
        },
    )
    api(net, {"/repos/someone/tool": repo("https://someone.github.io/tool/", kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None
    assert asked(net) == ["api.github.com/repos/someone/tool", "someone.github.io/tool/"]
    # an icon inside the project's own path is the project's
    paths: dict[str, tuple[str, bytes | str] | int] = {
        "/tool/": ("text/html", '<link rel="icon" href="icon.png">'),
        "/tool/icon.png": ("image/png", icon_bytes((128, 128))),
    }
    site(net, "someone.github.io", paths)
    assert logo_from("https://github.com/someone/tool") == "https://someone.github.io/tool/icon.png"
    assert logos.names_repository("https://someone.github.io/tool/", "tool")
    assert not logos.names_repository("https://someone.github.io/", "tool")
    assert not logos.names_repository("https://tool-maker.test/", "tool")
    assert not logos.names_repository("https://x.test/", "")


def test_a_small_homepage_icon_gives_way_to_the_organisations_avatar(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": ("text/html", '<link rel="icon" href="/fav32.png">'),
            "/fav32.png": ("image/png", icon_bytes((32, 32))),
        },
    )
    api(
        net,
        {
            "/repos/tool/tool": repo("https://tool.test/", login="tool", name="tool"),
            "/repos/someone/tool": repo("https://tool.test/", kind="User"),
            "/repos/bare/bare": repo(None, login="bare", name="bare"),
        },
    )
    assert logo_from("https://github.com/tool/tool") == f"{AVATAR}&s=256"  # sharper than a 32 px favicon
    assert logo_from("https://github.com/someone/tool") == "https://tool.test/fav32.png"  # better than none
    # an avatar that does not answer now: the small icon rather than nothing
    site(net, "avatars.githubusercontent.com", {"/u/9919": 502})
    assert logo_from("https://github.com/tool/tool") == "https://tool.test/fav32.png"
    with pytest.raises(safe_fetch.FetchError, match="502"):
        logos.tool_logo("https://github.com/bare/bare")  # nothing else: the job retries


def test_an_account_page_gives_an_organisations_avatar(net: FakeNet) -> None:
    api(
        net,
        {
            "/users/acme": {"type": "Organization", "login": "acme", "avatar_url": AVATAR},
            "/users/someone": {"type": "User", "login": "someone", "avatar_url": AVATAR},
        },
    )
    assert logo_from("https://github.com/acme") == f"{AVATAR}&s=256"
    net.requests.clear()
    assert logos.tool_logo("https://github.com/someone") is None
    assert asked(net) == ["api.github.com/users/someone"]


def test_githubs_own_pages_keep_githubs_icon(net: FakeNet) -> None:
    site(
        net,
        "github.com",
        {
            "/features/actions": ("text/html", '<link rel="manifest" href="/manifest.json">'),
            "/manifest.json": (
                "application/manifest+json",
                json.dumps({"icons": [{"src": "/app-icon-512.png", "sizes": "512x512"}]}),
            ),
            "/app-icon-512.png": ("image/png", icon_bytes((512, 512), "black")),
        },
    )
    assert logo_from("https://github.com/features/actions") == "https://github.com/app-icon-512.png"
    assert "api.github.com" not in [r.headers["host"] for r in net.requests]


def rate_limit(remaining: int, reset: int | None = None) -> tuple[str, str]:
    core: dict[str, Any] = {"limit": 60, "remaining": remaining, "used": 60 - remaining}
    if reset is not None:
        core["reset"] = reset
    return "application/json", json.dumps({"resources": {"core": core}, "rate": core})


def test_github_api_answers(net: FakeNet) -> None:
    site(net, "api.github.com", {"/repos/acme/gone": 404, "/repos/acme/down": 502})
    assert logos.tool_logo("https://github.com/acme/gone") is None  # gone or private: final
    with pytest.raises(safe_fetch.FetchError, match="502"):
        logos.tool_logo("https://github.com/acme/down")
    site(net, "api.github.com", {"/repos/acme/odd": ("application/json", "[1, 2]")})
    assert logos.tool_logo("https://github.com/acme/odd") is None


def test_a_refusal_waits_only_when_the_hourly_limit_is_used_up(net: FakeNet) -> None:
    reset = int(timezone.now().timestamp()) + 40 * 60
    paths: dict[str, tuple[str, bytes | str] | int] = {
        "/repos/acme/a": 403,
        "/repos/acme/b": 429,
        "/rate_limit": rate_limit(0, reset),
    }
    site(net, "api.github.com", paths)
    with pytest.raises(logos.RateLimited, match="answered 403") as raised:
        logos.tool_logo("https://github.com/acme/a")
    # it waits until the limit resets (and a little more), never longer than the hour of the limit
    assert dt.timedelta(minutes=40) < raised.value.wait < dt.timedelta(minutes=41)
    assert asked(net) == ["api.github.com/repos/acme/a", "api.github.com/rate_limit"]
    net.requests.clear()
    with pytest.raises(logos.RateLimited, match="limit used up"):
        logos.tool_logo("https://github.com/acme/b")  # the process remembers it: no request until the reset
    assert net.requests == []


@pytest.mark.parametrize(
    ("answer", "status"),
    [
        (rate_limit(57, 0), 403),  # requests remain: a block, or a short-term limit
        (rate_limit(57, 0), 429),
        (503, 403),  # /rate_limit cannot tell
        (("application/json", "{oops"), 403),
    ],
)
def test_a_refusal_that_is_not_the_hourly_limit_is_an_error_that_ends(
    net: FakeNet, answer: tuple[str, str] | int, status: int
) -> None:
    site(net, "api.github.com", {"/repos/acme/blocked": status, "/rate_limit": answer})
    with pytest.raises(safe_fetch.FetchError) as raised:
        logos.tool_logo("https://github.com/acme/blocked")
    # not RateLimited: the job counts the attempt and gives up after three, instead of waiting for ever
    assert raised.value.status == status and not isinstance(raised.value, safe_fetch.FetchBlocked)
    assert logos._limit_resets_at is None


def test_the_wait_is_kept_within_the_hour_of_the_limit(net: FakeNet, monkeypatch: pytest.MonkeyPatch) -> None:
    now = int(timezone.now().timestamp())
    for reset, low, high in (
        (None, 15, 15),  # no reset given: RATE_LIMIT_WAIT
        (now - 600, 1, 1),  # a reset in the past (a clock behind): MIN_WAIT
        (now + 5 * 3600, 61, 61),  # far ahead: MAX_WAIT
    ):
        monkeypatch.setattr(logos, "_limit_resets_at", None)
        site(net, "api.github.com", {"/repos/acme/a": 403, "/rate_limit": rate_limit(0, reset)})
        with pytest.raises(logos.RateLimited) as raised:
            logos.tool_logo("https://github.com/acme/a")
        minutes = raised.value.wait / dt.timedelta(minutes=1)
        assert low - 0.1 <= minutes <= high + 0.1, reset


def test_a_homepage_that_may_answer_later(net: FakeNet) -> None:
    site(net, "down.test", {"/": 503})
    api(net, {"/repos/down/down": repo("https://down.test/", login="down", name="down")})
    assert logo_from("https://github.com/down/down") == f"{AVATAR}&s=256"  # the organisation's avatar now
    api(net, {"/repos/someone/down": repo("https://down.test/", kind="User", name="down")})
    with pytest.raises(safe_fetch.FetchError, match="503"):
        logos.tool_logo("https://github.com/someone/down")  # nothing else: the job retries


def test_a_homepage_that_leads_back_to_github_asks_the_api_once(net: FakeNet) -> None:
    net.site("tool.test", PUBLIC, redirect("https://github.com/someone/tool"))
    site(net, "github.com", {"/someone/tool": ("text/html", '<link rel="icon" href="/favicon.png">')})
    api(net, {"/repos/someone/tool": repo("https://tool.test/", kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None  # never GitHub's icon
    assert asked(net) == ["api.github.com/repos/someone/tool", "tool.test/", "github.com/someone/tool"]
    # a site that leads to a repository is read as that repository
    net.requests.clear()
    net.site("vanity.test", PUBLIC, redirect("https://github.com/tool/tool"))
    api(net, {"/repos/tool/tool": repo(None, login="tool", name="tool")})
    site(net, "github.com", {"/tool/tool": ("text/html", '<link rel="icon" href="/favicon.png">')})
    assert logo_from("https://vanity.test/") == f"{AVATAR}&s=256"
    assert asked(net)[:3] == ["vanity.test/", "github.com/tool/tool", "api.github.com/repos/tool/tool"]


def test_the_marketplace_gives_the_extensions_icon(net: FakeNet) -> None:
    icon_url = (
        "https://acme.gallerycdn.vsassets.io/extensions/acme/tool/1.2.3/1754545873200/"
        "Microsoft.VisualStudio.Services.Icons.Default"
    )
    site(
        net,
        "marketplace.visualstudio.com",
        {
            "/items": (
                "text/html",
                f'<link rel="icon" href="/favicon.ico"><meta property="og:image" content="{icon_url}">',
            )
        },
    )
    site(
        net,
        "acme.gallerycdn.vsassets.io",
        {
            "/extensions/acme/tool/1.2.3/1754545873200/Microsoft.VisualStudio.Services.Icons.Default": (
                "image/png",
                icon_bytes((128, 128), "blue"),
            )
        },
    )
    assert logo_from("https://marketplace.visualstudio.com/items?itemName=acme.tool") == icon_url
    assert "/favicon.ico" not in [r.url.path for r in net.requests]  # the store's icon is never the tool's
    # a link that lands on the marketplace (aka.ms/tool) is read as the marketplace
    net.site("aka.ms", PUBLIC, redirect("https://marketplace.visualstudio.com/items?itemName=acme.tool"))
    assert logo_from("https://aka.ms/tool") == icon_url
    # an og:image that is not the extension's icon (the store's card) is none
    site(
        net,
        "marketplace.visualstudio.com",
        {"/items": ("text/html", '<meta property="og:image" content="https://cdn.vsassets.io/card.png">')},
    )
    assert logos.tool_logo("https://marketplace.visualstudio.com/items?itemName=acme.tool") is None


def test_other_stores_with_the_items_icon(net: FakeNet) -> None:
    store_icon = "https://lh3.googleusercontent.com/abc=s128-rj-sc0x00ffffff"
    site(
        net,
        "chromewebstore.google.com",
        {"/detail/tool/abc": ("text/html", f'<meta property="og:image" content="{store_icon}">')},
    )
    site(
        net, "lh3.googleusercontent.com", {"/abc=s128-rj-sc0x00ffffff": ("image/png", icon_bytes((128, 128)))}
    )
    assert logo_from("https://chromewebstore.google.com/detail/tool/abc") == store_icon
    avatar = "https://gitlab.com/uploads/-/system/project/avatar/3472737/inkscape.png?v=1"
    face = "https://gitlab.com/uploads/-/system/user/avatar/1/me.png"
    site(
        net,
        "gitlab.com",
        {
            "/acme/tool": ("text/html", f'<meta property="og:image" content="{avatar}">'),
            "/someone/tool": ("text/html", f'<meta property="og:image" content="{face}">'),
            "/uploads/-/system/project/avatar/3472737/inkscape.png": ("image/png", icon_bytes((200, 200))),
        },
    )
    assert logo_from("https://gitlab.com/acme/tool") == avatar
    assert logos.tool_logo("https://gitlab.com/someone/tool") is None  # a user's avatar is a face
    # a store that sends the request elsewhere (a consent page) shows no item: none, not that page's icon
    site(
        net,
        "consent.test",
        {"/": ("text/html", TOUCH_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))},
    )
    net.site("chromewebstore.google.com", PUBLIC, redirect("https://consent.test/"))
    assert logos.tool_logo("https://chromewebstore.google.com/detail/tool/abc") is None


def test_hosts_without_the_items_icon_make_no_request(net: FakeNet) -> None:
    for url in (
        "https://pypi.org/project/tool/",
        "https://www.npmjs.com/package/tool",
        "https://bitbucket.org/a/b",
    ):
        assert logos.tool_logo(url) is None
    assert net.requests == []
    # a homepage on one of them is no logo either
    api(net, {"/repos/someone/tool": repo("https://pypi.org/project/tool/", kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None
    assert asked(net) == ["api.github.com/repos/someone/tool"]


def test_a_tools_own_site(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {"/": ("text/html", TOUCH_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))},
    )
    assert logo_from("https://tool.test/") == "https://tool.test/touch.png"
    net.dns["router.test"] = ["192.168.0.1"]
    with pytest.raises(safe_fetch.FetchBlocked):
        logos.tool_logo("http://router.test/")


def test_no_url_an_api_or_a_store_gives_reaches_a_private_address(net: FakeNet) -> None:
    """The homepage and the avatar the GitHub API names, a store's og:image: each goes through the guard."""
    for address in ("127.0.0.1", "169.254.169.254", "10.0.0.1"):
        net.dns[address] = [address]
    net.dns["intranet.test"] = ["10.0.0.7"]
    for homepage in (
        "http://127.0.0.1:8000/",
        "http://intranet.test/",
        "//127.0.0.1/",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "10.0.0.1",
    ):
        owner = {
            "type": "Organization",
            "login": "tool",
            "avatar_url": "https://169.254.169.254/latest/meta-data",
        }
        api(net, {"/repos/tool/tool": {"name": "tool", "homepage": homepage, "owner": owner}})
        assert logos.tool_logo("https://github.com/tool/tool") is None, homepage
    image = "https://acme.gallerycdn.vsassets.io@127.0.0.1/extensions/a/Microsoft.VisualStudio.Services.Icons.Default"
    site(
        net,
        "marketplace.visualstudio.com",
        {"/items": ("text/html", f'<meta property="og:image" content="{image}">')},
    )
    assert logos.tool_logo("https://marketplace.visualstudio.com/items?itemName=a.b") is None
    assert {request.headers["host"] for request in net.requests} == {
        "api.github.com",
        "marketplace.visualstudio.com",
    }
