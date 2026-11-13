"""A tool's logo (library/logos.py, DECISIONS 9.10): which site's icon is the tool's, GitHub repositories and
stores, with fake DNS and HTTP (no test reaches the network)."""

import io
import json
from typing import Any

import pytest
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


def repo(homepage: str | None, kind: str = "Organization") -> dict[str, Any]:
    return {"homepage": homepage, "owner": {"type": kind, "avatar_url": AVATAR}}


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


def test_an_organisation_gives_its_avatar_when_no_homepage_does(net: FakeNet) -> None:
    site(net, "plain.test", {"/": ("text/html", "<title>No icon</title>")})
    for homepage in (
        None,
        "",
        "https://github.com/acme/tool#readme",
        "javascript:alert(1)",
        "https://plain.test/",
    ):
        api(net, {"/repos/acme/tool": repo(homepage)})
        net.requests.clear()
        assert logo_from("https://github.com/acme/tool") == f"{AVATAR}&s=256"
        avatar = net.requests[-1]
        assert (avatar.headers["host"], avatar.url.params["s"], avatar.url.params["v"]) == (
            "avatars.githubusercontent.com",
            "256",
            "4",
        )
        assert "github.com" not in [r.headers["host"] for r in net.requests]  # never the repository page


def test_a_persons_repository_gives_no_logo_but_its_own_site(net: FakeNet) -> None:
    api(net, {"/repos/someone/tool": repo(None, kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None  # a face is not a tool's logo
    assert asked(net) == ["api.github.com/repos/someone/tool"]
    api(net, {"/repos/someone/tool": repo("https://tool.test/", kind="User")})
    site(
        net,
        "tool.test",
        {"/": ("text/html", TOUCH_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))},
    )
    assert logo_from("https://github.com/someone/tool") == "https://tool.test/touch.png"


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
            "/repos/acme/tool": repo("https://tool.test/"),
            "/repos/someone/tool": repo("https://tool.test/", kind="User"),
            "/repos/acme/bare": repo(None),
        },
    )
    assert logo_from("https://github.com/acme/tool") == f"{AVATAR}&s=256"  # sharper than a 32 px favicon
    assert logo_from("https://github.com/someone/tool") == "https://tool.test/fav32.png"  # better than none
    # an avatar that does not answer now: the small icon rather than nothing
    site(net, "avatars.githubusercontent.com", {"/u/9919": 502})
    assert logo_from("https://github.com/acme/tool") == "https://tool.test/fav32.png"
    with pytest.raises(safe_fetch.FetchError, match="502"):
        logos.tool_logo("https://github.com/acme/bare")  # nothing else: the job retries


def test_an_account_page_gives_an_organisations_avatar(net: FakeNet) -> None:
    api(
        net,
        {
            "/users/acme": {"type": "Organization", "avatar_url": AVATAR},
            "/users/someone": {"type": "User", "avatar_url": AVATAR},
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


def test_github_api_answers(net: FakeNet) -> None:
    api(net, {"/repos/acme/gone": 404, "/repos/acme/limited": 403, "/repos/acme/busy": 429})
    assert logos.tool_logo("https://github.com/acme/gone") is None  # gone or private: final
    for name in ("limited", "busy"):  # the hourly limit without a token: later
        with pytest.raises(logos.RateLimited, match="GitHub API"):
            logos.tool_logo(f"https://github.com/acme/{name}")
    api(net, {"/repos/acme/down": 502})
    with pytest.raises(safe_fetch.FetchError, match="502"):
        logos.tool_logo("https://github.com/acme/down")
    site(net, "api.github.com", {"/repos/acme/odd": ("application/json", "[1, 2]")})
    assert logos.tool_logo("https://github.com/acme/odd") is None


def test_a_homepage_that_may_answer_later(net: FakeNet) -> None:
    site(net, "down.test", {"/": 503})
    api(net, {"/repos/acme/tool": repo("https://down.test/")})
    assert logo_from("https://github.com/acme/tool") == f"{AVATAR}&s=256"  # the organisation's avatar now
    api(net, {"/repos/someone/tool": repo("https://down.test/", kind="User")})
    with pytest.raises(safe_fetch.FetchError, match="503"):
        logos.tool_logo("https://github.com/someone/tool")  # nothing else: the job retries


def test_a_homepage_that_leads_back_to_github_asks_the_api_once(net: FakeNet) -> None:
    net.site("vanity.test", PUBLIC, redirect("https://github.com/someone/tool"))
    site(net, "github.com", {"/someone/tool": ("text/html", '<link rel="icon" href="/favicon.png">')})
    api(net, {"/repos/someone/tool": repo("https://vanity.test/", kind="User")})
    assert logos.tool_logo("https://github.com/someone/tool") is None  # never GitHub's icon
    assert asked(net) == ["api.github.com/repos/someone/tool", "vanity.test/", "github.com/someone/tool"]
    # a site that leads to a repository is read as that repository
    net.requests.clear()
    api(net, {"/repos/someone/tool": repo(None, kind="Organization")})
    assert logo_from("https://vanity.test/") == f"{AVATAR}&s=256"
    assert asked(net)[:3] == ["vanity.test/", "github.com/someone/tool", "api.github.com/repos/someone/tool"]


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
