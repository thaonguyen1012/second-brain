import io
import random
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from PIL import Image

from core.services import safe_fetch, thumbnails, unfurl
from core.testing import image_bytes
from inbox.models import InboxEntry
from library.models import Item


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


def test_stored_files_are_readable_by_the_web_server(settings: Any, tmp_path: Path) -> None:
    # nginx runs as another user than Django and run_jobs and sends the file itself (X-Accel-Redirect).
    settings.THUMBS_DIR = tmp_path
    name = thumbnails.store(thumbnails.to_webp(image_bytes(), thumbnails.ITEM_SIZES))
    assert (tmp_path / name).stat().st_mode & 0o777 == 0o644
    assert thumbnails.store(thumbnails.to_webp(image_bytes(), thumbnails.ITEM_SIZES)) == name  # same bytes
    assert [p.name for p in tmp_path.iterdir()] == [name]  # no temporary file left


def test_item_sizes_bound_the_longer_side() -> None:
    webp = thumbnails.to_webp(image_bytes((900, 1800)), thumbnails.ITEM_SIZES)
    with Image.open(io.BytesIO(webp)) as image:
        assert image.size == (300, 600)


@pytest.mark.django_db
def test_a_file_goes_only_when_no_row_of_any_owner_names_it(settings: Any, tmp_path: Path) -> None:
    settings.THUMBS_DIR = tmp_path
    name = thumbnails.store(thumbnails.to_webp(image_bytes()))
    alex = User.objects.create(username="alex@x", email="alex@x")
    other = User.objects.create(username="other@x", email="other@x")
    assert not thumbnails.in_use(name)
    entry = InboxEntry.objects.create(user=other, url="https://a.test/", og_image_path=name)
    item = Item.objects.create(user=alex, type="book", title="Dune", image_path=name)
    assert thumbnails.in_use(name)
    thumbnails.discard_if_unused(name)
    assert (tmp_path / name).is_file()
    entry.delete()
    assert thumbnails.in_use(name)  # the Item still names it
    thumbnails.discard_if_unused(name)
    assert (tmp_path / name).is_file()
    item.delete()
    assert not thumbnails.in_use(name)
    thumbnails.discard_if_unused(name)
    assert not (tmp_path / name).exists()
    thumbnails.discard_if_unused("")  # nothing to do
    thumbnails.discard_if_unused("../outside.webp")  # not a stored name: never touched


def test_malformed_og_image_is_ignored() -> None:
    card = unfurl.parse(
        page('<meta property="og:title" content="T"><meta property="og:image" content="http://[">')
    )
    assert (card.title, card.image_url) == ("T", "")
