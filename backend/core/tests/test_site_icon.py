"""A site's icon as a logo (core/services/site_icon.py, thumbnails.logo_to_webp; DECISIONS 9.10) with fake
DNS and HTTP: no test reaches the network. Icons are drawn with Pillow."""

import base64
import hashlib
import io
import json
import random
import struct

import pytest
from PIL import Image, ImageDraw

from core.services import safe_fetch, site_icon, thumbnails
from core.services.site_icon import Candidate
from core.testing import icon_bytes as icon
from core.tests.fakenet import FakeNet, Files, files

PUBLIC = "93.184.215.14"


def ico(*sizes: int, color: str = "red") -> bytes:
    """An ICO with a frame per size, drawn by Pillow."""
    image = Image.new("RGBA", (max(sizes), max(sizes)), (0, 0, 0, 0))
    ImageDraw.Draw(image).ellipse((0, 0, max(sizes) - 1, max(sizes) - 1), fill=color)
    out = io.BytesIO()
    image.save(out, "ICO", sizes=[(s, s) for s in sizes])
    return out.getvalue()


def ico_of_pngs(*frames: tuple[int, int, bytes]) -> bytes:
    """An ICO whose frames are PNGs, each (side, bits per pixel, png): the header says the depth."""
    header = struct.pack("<HHH", 0, 1, len(frames))
    offset = 6 + 16 * len(frames)
    entries, data = b"", b""
    for side, bpp, png in frames:
        entries += struct.pack(
            "<BBBBHHII", side % 256, side % 256, 0, 0, 1, bpp, len(png), offset + len(data)
        )
        data += png
    return header + entries + data


def colour_of(webp: bytes) -> tuple[int, ...]:
    with Image.open(io.BytesIO(webp)) as image:
        pixel = image.convert("RGBA").getpixel((image.width // 2, image.height // 2))
    assert isinstance(pixel, tuple)
    return pixel


def size_of(webp: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(webp)) as image:
        assert image.format == "WEBP"
        return image.size


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch) -> FakeNet:
    return FakeNet(monkeypatch)


def site(net: FakeNet, host: str, paths: Files) -> None:
    net.site(host, PUBLIC, files(paths))


def asked(net: FakeNet) -> list[str]:
    return [f"{r.headers['host']}{r.url.path}" for r in net.requests]


def page(body: str, url: str = "https://tool.test/docs/start") -> safe_fetch.Fetched:
    return safe_fetch.Fetched(url=url, content_type="text/html", charset="utf-8", body=body.encode())


# --- candidates and ranking ---------------------------------------------------------------------------------


def test_the_page_declares_its_icons_read_against_its_base() -> None:
    declared, manifest = site_icon.page_candidates(
        page(
            """<html><head><base href="/docs/v2/"><base href="/ignored/">
            <link rel="icon" href="favicon.ico">
            <link rel="shortcut icon" type="image/png" href="/img/favicon-32x32.png">
            <LINK REL="Apple-Touch-Icon" HREF="https://cdn.test/touch.png">
            <link rel="apple-touch-icon-precomposed" sizes="152x152" href="touch-152.png">
            <link rel="alternate icon" sizes="16x16 192x192" href="//cdn.test/android.png">
            <link rel="icon" type="image/svg+xml" href="/icon">
            <link rel="icon" type="image/svg" href="/semgrep-style.svg">
            <link rel="icon" href="/logo.SVG?v=2">
            <link rel="mask-icon" href="/pinned.png" color="#000">
            <link rel="fluid-icon" href="/fluidicon.png">
            <link rel="icon" sizes="16x16" href="data:image/png;base64,iVBORw0KGgo=">
            <link rel="icon" href="data:image/svg+xml;base64,PHN2Zy8+">
            <link rel="icon" href="data:,">
            <link rel="icon" href="javascript:alert(1)">
            <link rel="icon" href="">
            <link rel="stylesheet" href="/site.css">
            <link rel="manifest" href="site.webmanifest"><link rel="manifest" href="/second.json">
            </head><body><link rel="icon" sizes="48x48" href="/late.png"></body></html>"""
        )
    )
    assert declared == [
        Candidate("https://tool.test/docs/v2/favicon.ico", None),
        Candidate("https://tool.test/img/favicon-32x32.png", 32),  # the size in the file's name
        Candidate("https://cdn.test/touch.png", None, touch=True),
        Candidate("https://tool.test/docs/v2/touch-152.png", 152, touch=True),
        Candidate("https://cdn.test/android.png", 192),  # the largest declared size
        Candidate("data:image/png;base64,iVBORw0KGgo=", 16),  # inline in the page: a raster type only
        Candidate("https://tool.test/late.png", 48),
    ]
    assert manifest == "https://tool.test/docs/v2/site.webmanifest"


def test_a_page_without_icons_or_with_broken_markup() -> None:
    assert site_icon.page_candidates(page("<title>Plain</title>")) == ([], "")
    # a character reference too long to convert ends the parse; what was read before it stays
    reference = "&#" + "9" * 5000 + ";"
    broken = f'<link rel="icon" href="/a.png"><a title="{reference}">x</a><link rel="icon" href="/b.png">'
    assert site_icon.page_candidates(page(broken)) == ([Candidate("https://tool.test/a.png", None)], "")


def test_rank_puts_the_most_useful_first_and_each_url_once() -> None:
    def c(name: str, size: int | None, **flags: bool) -> Candidate:
        return Candidate(f"https://t.test/{name}", size, **flags)

    ranked = site_icon.rank(
        [
            c("16.png", 16),
            c("unknown.png", None),
            c("32.png", 32),
            c("1024.png", 1024),
            c("touch.png", None, touch=True),  # an apple-touch-icon without sizes: 180 px
            c("mask-512.png", 512, maskable=True),
            c("192.png", 192),
            c("512.png", 512),
            c("4096.png", 4096),
            c("96.png", 96),
            c("apple-touch-icon.png", None, touch=True, guessed=True),
            c("favicon.ico", None, guessed=True),
            c("unknown-2.png", None),
            c("192.png", 192),  # named twice: tried once
        ]
    )
    assert [candidate.url.rpartition("/")[2] for candidate in ranked] == [
        "512.png",
        "192.png",
        "touch.png",
        "apple-touch-icon.png",  # a guess comes after the icons a page named
        "mask-512.png",  # made for masks: a padded square, after every icon of its group for any use
        "1024.png",
        "4096.png",
        "96.png",
        "32.png",
        "unknown.png",
        "unknown-2.png",
        "favicon.ico",
        "16.png",
    ]


def test_the_manifest_gives_its_raster_icons() -> None:
    body = {
        "icons": [
            {"src": "android-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/maskable-512.png", "sizes": "512x512", "purpose": "maskable"},
            {"src": "both.png", "sizes": "384x384", "purpose": "any maskable"},
            {"src": "mono.png", "sizes": "512x512", "purpose": "monochrome"},
            {"src": "icon.svg", "sizes": "any", "type": "image/svg+xml"},
            {"src": "https://cdn.test/a.png"},
            {"src": 42},
            {"sizes": "64x64"},
            "not an icon",
        ]
    }
    doc = safe_fetch.Fetched(
        url="https://tool.test/static/site.webmanifest",
        content_type="application/manifest+json",
        charset=None,
        body=json.dumps(body).encode(),
    )
    assert site_icon.manifest_candidates(doc) == [
        Candidate("https://tool.test/static/android-192.png", 192),
        Candidate("https://tool.test/maskable-512.png", 512, maskable=True),
        Candidate("https://tool.test/static/both.png", 384),
        Candidate("https://cdn.test/a.png", None),
    ]
    for broken in (b"{not json", b"[]", b'{"icons": "x"}', b"[" * 100_000):
        assert site_icon.manifest_candidates(doc.__class__(doc.url, doc.content_type, None, broken)) == []


def test_root_candidates() -> None:
    assert site_icon.root_candidates("https://user:pw@tool.test:8443/docs/?q=1#top") == [
        Candidate("https://tool.test:8443/apple-touch-icon.png", None, touch=True, guessed=True),
        Candidate("https://tool.test:8443/favicon.ico", None, guessed=True),
    ]
    # Read the Docs answers /favicon.ico with its own icon for every project on it
    assert site_icon.root_candidates("https://django-debug-toolbar.readthedocs.io/en/latest/") == []
    assert site_icon.root_candidates("https://docs.readthedocs-hosted.com/") == []
    assert site_icon.root_candidates("ftp://tool.test/") == []
    assert site_icon.root_candidates("http://[::1") == []


# --- finding the logo ---------------------------------------------------------------------------------------


def test_the_best_declared_icon_is_the_logo(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": (
                "text/html",
                """<link rel="icon" href="/favicon-32x32.png">
                <link rel="apple-touch-icon" href="/touch.png">
                <link rel="manifest" href="/site.webmanifest">""",
            ),
            "/site.webmanifest": (
                "application/manifest+json",
                json.dumps({"icons": [{"src": "/android-512.png", "sizes": "512x512"}]}),
            ),
            "/android-512.png": ("image/png", icon((512, 512), "blue")),
            "/touch.png": ("image/png", icon((180, 180), "green")),
        },
    )
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/android-512.png"
    assert size_of(logo.webp) == (thumbnails.LOGO_SIZE, thumbnails.LOGO_SIZE)  # 512 shrunk to 256
    assert colour_of(logo.webp)[2] > 200  # the blue one
    assert asked(net) == ["tool.test/", "tool.test/site.webmanifest", "tool.test/android-512.png"]


def test_svg_icons_are_never_fetched(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": (
                "text/html",
                """<link rel="icon" type="image/svg+xml" href="/icon">
                <link rel="icon" href="/logo.svg"><link rel="mask-icon" href="/pinned.svg">""",
            ),
            "/icon": ("image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'/>"),
            "/favicon.ico": ("image/x-icon", ico(16, 32, 48)),
        },
    )
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/favicon.ico"
    assert size_of(logo.webp) == (48, 48)  # the ICO's largest frame, never enlarged
    assert asked(net) == ["tool.test/", "tool.test/apple-touch-icon.png", "tool.test/favicon.ico"]
    # an answer that turns out to be SVG is refused by the guard, never decoded
    site(
        net,
        "svg.test",
        {"/": ("text/html", '<link rel="icon" href="/icon">'), "/icon": ("image/svg+xml", "<svg/>")},
    )
    assert site_icon.find("https://svg.test/") is None


def test_the_root_files_when_the_page_names_no_icon(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": ("text/html", "<title>No icons</title>"),
            "/apple-touch-icon.png": ("image/png", icon((180, 180))),
        },
    )
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/apple-touch-icon.png"
    assert size_of(logo.webp) == (180, 180)
    assert asked(net) == ["tool.test/", "tool.test/apple-touch-icon.png"]


def test_icons_too_small_or_not_images_are_skipped(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": (
                "text/html",
                """<link rel="icon" sizes="16x16" href="/16.png"><link rel="icon" href="/24.png">
                <link rel="icon" href="/broken.png">""",
            ),
            "/16.png": ("image/png", icon((16, 16))),
            "/24.png": ("image/png", icon((24, 24))),
            "/broken.png": ("image/png", b"not a png"),
            # a single-page app answers every path with its page
            "/apple-touch-icon.png": ("text/html", "<!doctype html><title>App</title>"),
            "/favicon.ico": ("image/x-icon", ico(16)),
        },
    )
    assert site_icon.find("https://tool.test/") is None
    # 31 px is too small, 32 px is enough
    site(net, "edge.test", {"/": ("text/html", ""), "/favicon.ico": ("image/x-icon", ico(16, 31))})
    assert site_icon.find("https://edge.test/") is None
    site(net, "edge.test", {"/": ("text/html", ""), "/favicon.ico": ("image/x-icon", ico(16, 32))})
    logo = site_icon.find("https://edge.test/")
    assert logo is not None and size_of(logo.webp) == (32, 32)


def test_at_most_max_fetches_icons_are_tried(net: FakeNet) -> None:
    links = "".join(f'<link rel="icon" sizes="{64 + n}x{64 + n}" href="/{n}.png">' for n in range(10))
    site(net, "tool.test", {"/": ("text/html", links)})
    assert site_icon.find("https://tool.test/") is None
    assert len(net.requests) == 1 + site_icon.MAX_FETCHES


def test_an_error_that_may_go_away_is_raised_only_when_nothing_works(net: FakeNet) -> None:
    paths: dict[str, tuple[str, bytes | str] | int] = {
        "/": ("text/html", '<link rel="apple-touch-icon" href="/touch.png">'),
        "/touch.png": 503,
        "/favicon.ico": ("image/x-icon", ico(48)),
    }
    site(net, "tool.test", paths)
    logo = site_icon.find("https://tool.test/")  # the 503 is passed over: the favicon works
    assert logo is not None and logo.url == "https://tool.test/favicon.ico"
    del paths["/favicon.ico"]
    with pytest.raises(safe_fetch.FetchError) as raised:
        site_icon.find("https://tool.test/")  # nothing worked and one may work later: the job retries
    assert raised.value.status == 503 and not isinstance(raised.value, safe_fetch.FetchBlocked)
    paths["/touch.png"] = 404
    assert site_icon.find("https://tool.test/") is None  # every icon is missing: final


def test_a_page_answering_4xx_still_gives_its_root_files(net: FakeNet) -> None:
    site(net, "walled.test", {"/": 403, "/favicon.ico": ("image/vnd.microsoft.icon", ico(16, 32, 64))})
    logo = site_icon.find("https://walled.test/")
    assert logo is not None and size_of(logo.webp) == (64, 64)
    site(net, "down.test", {"/": 503})
    with pytest.raises(safe_fetch.FetchError, match="503"):
        site_icon.find("https://down.test/")
    assert asked(net)[-1] == "down.test/"  # a server error: try again later, nothing else asked
    with pytest.raises(safe_fetch.FetchError, match="DNS"):
        site_icon.find("https://unknown.test/")
    net.dns["router.test"] = ["192.168.0.1"]
    with pytest.raises(safe_fetch.FetchBlocked):
        site_icon.find("http://router.test/")


def test_a_manifest_that_fails_leaves_the_other_icons(net: FakeNet) -> None:
    site(
        net,
        "tool.test",
        {
            "/": ("text/html", '<link rel="manifest" href="/m.json"><link rel="icon" href="/i.png">'),
            "/m.json": ("application/json", "{broken"),
            "/i.png": ("image/png", icon((96, 96))),
        },
    )
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/i.png"
    site(net, "tool.test", {"/": ("text/html", '<link rel="manifest" href="/m.json">'), "/m.json": 503})
    with pytest.raises(safe_fetch.FetchError, match="503"):
        site_icon.find("https://tool.test/")  # the manifest may answer next time


def test_a_platform_host_gives_only_the_icons_its_pages_declare(net: FakeNet) -> None:
    site(
        net,
        "tool.readthedocs.io",
        {"/": ("text/html", "<title>Docs</title>"), "/favicon.ico": ("image/x-icon", ico(32, 48))},
    )
    assert site_icon.find("https://tool.readthedocs.io/") is None
    assert asked(net) == ["tool.readthedocs.io/"]


def test_a_link_to_an_image_is_the_logo_itself(net: FakeNet) -> None:
    site(
        net,
        "cdn.test",
        {"/logo.png": ("image/png", icon((300, 200))), "/tiny.png": ("image/png", icon((20, 20)))},
    )
    logo = site_icon.find("https://cdn.test/logo.png")
    assert logo is not None and size_of(logo.webp) == (256, 171)
    with pytest.raises(thumbnails.NotALogo):
        site_icon.find("https://cdn.test/tiny.png")


def test_fetch_logo_takes_one_image(net: FakeNet) -> None:
    site(net, "cdn.test", {"/a.png": ("image/png", icon((460, 460))), "/down.png": 502})
    logo = site_icon.fetch_logo("https://cdn.test/a.png")
    assert logo is not None and size_of(logo.webp) == (256, 256)
    assert site_icon.fetch_logo("https://cdn.test/gone.png") is None
    with pytest.raises(safe_fetch.FetchError):
        site_icon.fetch_logo("https://cdn.test/down.png")


def test_an_icon_inline_in_the_page_needs_no_request(net: FakeNet) -> None:
    inline = base64.b64encode(icon((128, 128), "green")).decode()
    wrapped = "\n".join(inline[i : i + 76] for i in range(0, len(inline), 76))  # line breaks are allowed
    site(net, "tool.test", {"/": ("text/html", f'<link rel="icon" href="data:image/png;base64,{wrapped}">')})
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "data:image/png" and size_of(logo.webp) == (128, 128)
    assert asked(net) == ["tool.test/", "tool.test/apple-touch-icon.png"]  # the guessed file came first
    broken = '<link rel="icon" href="data:image/png;base64,***">'
    broken += '<link rel="icon" href="data:image/gif;base64,AAAA">'  # base64, but no image
    site(net, "broken.test", {"/": ("text/html", broken)})
    assert site_icon.find("https://broken.test/") is None


def test_a_page_that_only_redirects_with_a_meta_refresh_is_followed_once(net: FakeNet) -> None:
    site(
        net,
        "docs.test",
        {
            "/cli/audit/": (
                "text/html",
                """<meta http-equiv="refresh" content="0; URL='/cli/v12/audit/'" />""",
            ),
            "/cli/v12/audit/": (
                "text/html",
                '<link rel="apple-touch-icon" sizes="192x192" href="/i-192.png">',
            ),
            "/i-192.png": ("image/png", icon((192, 192))),
        },
    )
    logo = site_icon.find("https://docs.test/cli/audit/")
    assert logo is not None and logo.url == "https://docs.test/i-192.png"
    assert asked(net) == ["docs.test/cli/audit/", "docs.test/cli/v12/audit/", "docs.test/i-192.png"]


def test_what_is_no_redirect() -> None:
    def target(body: str, url: str = "https://docs.test/a/") -> str | None:
        return site_icon.refresh_target(page(body, url))

    assert (
        target('<meta http-equiv="Refresh" content="2;url=https://other.test/b">') == "https://other.test/b"
    )
    assert target('<meta http-equiv="refresh" content="300; url=/b">') is None  # a page that reloads later
    assert target('<meta http-equiv="refresh" content="0">') is None  # reloads itself
    assert target('<meta http-equiv="refresh" content="0; url=/a/">') is None  # the same page
    assert target('<meta http-equiv="refresh" content="0; url=javascript:alert(1)">') is None
    assert target('<meta http-equiv="refresh" content="' + "9" * 5000 + '; url=/b">') is None
    big = '<meta http-equiv="refresh" content="0; url=/b">' + " " * site_icon.REFRESH_PAGE_MAX
    assert target(big) is None  # a page that big is a page


def test_a_hosts_or_themes_default_icon_is_never_a_logo(
    net: FakeNet, monkeypatch: pytest.MonkeyPatch
) -> None:
    theme_default = icon((196, 196), "black")
    monkeypatch.setattr(
        site_icon, "DEFAULT_ICONS", site_icon.DEFAULT_ICONS | {hashlib.sha256(theme_default).hexdigest()}
    )
    site(
        net,
        "book.test",
        {
            "/": ("text/html", '<link rel="shortcut icon" href="favicon.png">'),
            "/favicon.png": ("image/png", theme_default),
        },
    )
    assert site_icon.find("https://book.test/") is None
    assert len(site_icon.DEFAULT_ICONS) == 3  # Read the Docs' favicon and mdBook's, checked on real sites


def test_a_small_icon_is_kept_only_when_no_other_is_bigger(net: FakeNet) -> None:
    paths: dict[str, tuple[str, bytes | str] | int] = {
        "/": ("text/html", '<link rel="icon" type="image/png" href="/favicon-32x32.png">'),
        "/favicon-32x32.png": ("image/png", icon((32, 32))),
        "/favicon.ico": ("image/x-icon", ico(16, 32, 48)),
    }
    site(net, "tool.test", paths)
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/favicon.ico" and size_of(logo.webp) == (48, 48)
    paths["/favicon.ico"] = ("image/x-icon", ico(16))
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and logo.url == "https://tool.test/favicon-32x32.png"  # the only one big enough
    # an icon of GOOD_SIDE px or more is taken at once
    paths["/favicon-32x32.png"] = ("image/png", icon((64, 64)))
    net.requests.clear()
    logo = site_icon.find("https://tool.test/")
    assert logo is not None and asked(net) == [
        "tool.test/",
        "tool.test/apple-touch-icon.png",
        "tool.test/favicon-32x32.png",
    ]


# --- the logo file ------------------------------------------------------------------------------------------


def test_a_logo_is_a_small_webp_with_its_transparency() -> None:
    webp = thumbnails.logo_to_webp(icon((1024, 1024)))
    with Image.open(io.BytesIO(webp)) as image:
        assert (image.format, image.size) == ("WEBP", (256, 256))
        corner = image.convert("RGBA").getpixel((0, 0))
        assert isinstance(corner, tuple) and corner[3] == 0  # the ground stays transparent
    assert b"VP8L" in webp[:40]  # a flat logo is lossless
    assert size_of(thumbnails.logo_to_webp(icon((40, 40)))) == (40, 40)  # never enlarged
    assert size_of(thumbnails.logo_to_webp(icon((180, 90), fmt="GIF"))) == (180, 90)
    assert size_of(thumbnails.logo_to_webp(icon((64, 64), fmt="WEBP"))) == (64, 64)
    jpeg = Image.new("RGB", (400, 400), "white")
    ImageDraw.Draw(jpeg).ellipse((50, 50, 350, 350), fill="navy")
    out = io.BytesIO()
    jpeg.save(out, "JPEG")
    assert size_of(thumbnails.logo_to_webp(out.getvalue())) == (256, 256)


def test_a_photo_like_logo_goes_lossy_under_the_size_limit() -> None:
    rng = random.Random(7)  # noqa: S311  test noise, not crypto
    noise = Image.frombytes("RGB", (256, 256), rng.randbytes(256 * 256 * 3))
    out = io.BytesIO()
    noise.save(out, "PNG")
    webp = thumbnails.logo_to_webp(out.getvalue())
    assert b"VP8 " in webp and len(webp) <= thumbnails.MAX_BYTES


def test_an_ico_gives_its_largest_frame_in_its_most_colours() -> None:
    assert size_of(thumbnails.logo_to_webp(ico(16, 32, 48, 256))) == (256, 256)
    # two 48 px frames: Pillow alone opens the one of fewer colours (here red), the logo takes the deeper one
    red, blue = icon((48, 48), "red"), icon((48, 48), "blue")
    webp = thumbnails.logo_to_webp(ico_of_pngs((48, 4, red), (48, 32, blue), (16, 32, icon((16, 16)))))
    assert size_of(webp) == (48, 48) and colour_of(webp)[2] > 200


def test_what_makes_no_logo() -> None:
    with pytest.raises(thumbnails.NotALogo, match="too small"):
        thumbnails.logo_to_webp(icon((31, 31)))
    with pytest.raises(thumbnails.NotALogo, match="too small"):
        thumbnails.logo_to_webp(icon((64, 16)))
    for blank in (Image.new("RGBA", (64, 64), "white"), Image.new("RGBA", (64, 64), (0, 0, 0, 0))):
        out = io.BytesIO()
        blank.save(out, "PNG")
        with pytest.raises(thumbnails.NotALogo, match="one colour"):
            thumbnails.logo_to_webp(out.getvalue())
    for not_raster in (b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"<!doctype html>", b""):
        with pytest.raises(thumbnails.ThumbnailError) as raised:
            thumbnails.logo_to_webp(not_raster)
        assert not isinstance(raised.value, thumbnails.NotALogo)


def test_a_bomb_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(thumbnails.ThumbnailError, match="cannot decode"):
        thumbnails.logo_to_webp(icon((64, 64)))
    with pytest.raises(thumbnails.ThumbnailError, match="cannot decode"):
        thumbnails.logo_to_webp(ico(16, 64))
