"""Unfurl, feeds and thumbnails against hostile third-party input (security audit S-01, S-06, S-07, S-08,
S-14)."""

import io
import logging
import logging.config
import struct
import time
from typing import Any

import pytest
from django.conf import settings
from PIL import Image, ImageOps

from brief import feeds
from core.services import safe_fetch, thumbnails, unfurl


def page(body: bytes, charset: str | None) -> safe_fetch.Fetched:
    return safe_fetch.Fetched(url="https://site.test/", content_type="text/html", charset=charset, body=body)


@pytest.mark.parametrize("charset", ["punycode", "idna", "undefined", "utf-7", "rot13", "nonsense"])
def test_odd_charsets_read_as_utf8(charset: str) -> None:
    card = unfurl.parse(page(b"<title>Xin ch\xc3\xa0o</title>", charset))
    assert card.title == "Xin chào"


def test_charsets_browsers_use_are_kept() -> None:
    card = unfurl.parse(page("<title>Café</title>".encode("cp1252"), "windows-1252"))
    assert card.title == "Café"


def test_a_huge_character_reference_is_no_exception() -> None:
    body = b'<meta property="og:title" content="&#' + b"9" * 5000 + b';"><title>x</title>'
    unfurl.parse(page(body, "utf-8"))  # does not raise


def test_deep_nesting_is_cut_before_nh3() -> None:
    value = "<div>" * 200_000 + "x"
    started = time.monotonic()
    unfurl.plain_text(value, unfurl.MAX_TITLE)
    assert time.monotonic() - started < 2


@pytest.mark.parametrize("encoding", ["shift_jis", "nonsense-9"])
def test_feed_encodings_end_as_feed_error(encoding: str) -> None:
    body = f'<?xml version="1.0" encoding="{encoding}"?><rss><channel></channel></rss>'.encode()
    with pytest.raises(feeds.FeedError):
        feeds.parse(body, "https://feed.test/")


def test_malformed_exif_is_a_thumbnail_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def broken(*args: object, **kwargs: object) -> None:
        raise struct.error("unpack requires a buffer of 4 bytes")

    monkeypatch.setattr(ImageOps, "exif_transpose", broken)

    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "PNG")
    with pytest.raises(thumbnails.ThumbnailError):
        thumbnails.to_webp(buf.getvalue())


def test_httpx_does_not_log_urls_at_info() -> None:
    config: dict[str, Any] = settings.LOGGING
    assert config["loggers"]["httpx"]["level"] == "WARNING"
    logging.config.dictConfig(config)
    assert not logging.getLogger("httpx").isEnabledFor(logging.INFO)
