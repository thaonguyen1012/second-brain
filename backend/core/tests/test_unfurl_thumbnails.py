import io
import random
from pathlib import Path
from typing import Any

import pytest
from PIL import Image

from core.services import safe_fetch, thumbnails, unfurl


def page(
    body: str, url: str = "https://blog.test/posts/1", charset: str | None = "utf-8"
) -> safe_fetch.Fetched:
    return safe_fetch.Fetched(url=url, content_type="text/html", charset=charset, body=body.encode())


def test_parse_open_graph() -> None:
    card = unfurl.parse(
        page(
            """<html><head><title>Fallback</title>
            <meta property="og:title" content="Real &amp; <b>bold</b> title">
            <meta property="og:description" content="  Line one
               line two <script>alert(1)</script>">
            <meta property="og:site_name" content="Blog">
            <meta property="og:image" content="/img/cover.png"></head></html>"""
        )
    )
    assert card.title == "Real & bold title"
    assert card.description == "Line one line two"
    assert card.site_name == "Blog"
    assert card.image_url == "https://blog.test/img/cover.png"


def test_parse_falls_back_to_title_and_drops_bad_image() -> None:
    card = unfurl.parse(
        page(
            '<title> Only <i>title</i> </title><meta property="og:image" content="javascript:alert(1)">',
            charset=None,
        )
    )
    assert card.title == "Only title"
    assert (card.description, card.site_name, card.image_url) == ("", "", "")


def _noise_png(size: int) -> bytes:
    rng = random.Random(1)  # noqa: S311  test noise, not crypto
    image = Image.frombytes("RGB", (size, size), bytes(rng.getrandbits(8) for _ in range(size * size * 3)))
    out = io.BytesIO()
    image.save(out, "PNG")
    return out.getvalue()


def test_thumbnail_is_small_webp(settings: Any, tmp_path: Path) -> None:
    source = _noise_png(1000)
    assert len(source) > thumbnails.MAX_BYTES
    webp = thumbnails.to_webp(source)
    assert len(webp) <= thumbnails.MAX_BYTES
    assert Image.open(io.BytesIO(webp)).format == "WEBP"
    settings.THUMBS_DIR = tmp_path
    name = thumbnails.store(webp)
    assert thumbnails.path_of(name) == tmp_path / name
    assert thumbnails.path_of("../etc/passwd") is None


def test_thumbnail_refuses_bombs_and_non_images(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(thumbnails.ThumbnailError):
        thumbnails.to_webp(b"<svg xmlns='http://www.w3.org/2000/svg'/>")
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(thumbnails.ThumbnailError):
        thumbnails.to_webp(_noise_png(20))  # 400 px > limit


def test_malformed_og_image_is_ignored() -> None:
    card = unfurl.parse(
        page('<meta property="og:title" content="T"><meta property="og:image" content="http://[">')
    )
    assert (card.title, card.image_url) == ("T", "")
