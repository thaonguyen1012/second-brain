import datetime as dt

import httpx
import pytest

from brief import feeds
from brief.tests.feeds_data import atom, rss
from core.services import safe_fetch
from core.tests.fakenet import FakeNet

NOW = dt.datetime(2026, 11, 2, 5, 0, tzinfo=dt.UTC)


def test_rss_items_become_plain_text_entries() -> None:
    body = rss(
        (
            "Claude &amp; friends",
            "https://a.test/1?utm_source=x",
            NOW,
            "&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;",
        ),
        ("No link", "", NOW, "x"),
        ("", "https://a.test/empty-title", NOW, "x"),
        ("Script link", "javascript:alert(1)", NOW, "x"),
        ("Relative", "/2", None, "y" * 900),
    )
    entries = feeds.parse(body.encode(), "https://a.test/feed")
    assert [e.title for e in entries] == ["Claude & friends", "Relative"]
    first, second = entries
    assert (first.url, first.published, first.excerpt) == (
        "https://a.test/1?utm_source=x",
        NOW,
        "Hello world",
    )
    assert second.url == "https://a.test/2" and second.published is None
    assert len(second.excerpt) == feeds.EXCERPT_CHARS


def test_atom_entries_use_the_alternate_link() -> None:
    body = atom(("A &lt;i&gt;new&lt;/i&gt; model", "https://b.test/post", NOW, "Short &amp; sweet"))
    [entry] = feeds.parse(body.encode(), "https://b.test/atom.xml")
    assert (entry.title, entry.url, entry.published, entry.excerpt) == (
        "A new model",
        "https://b.test/post",
        NOW,
        "Short & sweet",
    )


def test_rss_1_0_and_guid_permalink() -> None:
    body = (
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>c</title></channel>'
        "<item><title>One</title><link>https://c.test/1</link><dc:date>2026-11-02T05:00:00Z</dc:date></item>"
        "</rdf:RDF>"
    )
    [entry] = feeds.parse(body.encode(), "https://c.test/")
    assert entry.published == NOW
    guid = "<rss><channel><item><title>G</title><guid>https://d.test/g</guid></item></channel></rss>"
    assert feeds.parse(guid.encode(), "https://d.test/")[0].url == "https://d.test/g"


@pytest.mark.parametrize(
    "body",
    [
        b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><rss><channel/></rss>',
        b'<?xml version="1.0"?><!doctype rss SYSTEM "file:///etc/passwd"><rss/>',
        b"<rss><channel><item><title>x",
        b"<html><body>not a feed</body></html>",
    ],
)
def test_refused_documents(body: bytes) -> None:
    with pytest.raises(feeds.FeedError):
        feeds.parse(body, "https://e.test/")


def test_entries_are_capped() -> None:
    body = rss(*((f"T{i}", f"https://f.test/{i}", NOW, "") for i in range(80)))
    assert len(feeds.parse(body.encode(), "https://f.test/")) == feeds.MAX_ENTRIES


def test_dedupe_key_normalises_title_and_url() -> None:
    key = feeds.dedupe_key("Big  News", "https://News.test/a?utm_source=rss&id=1#top")
    assert key == feeds.dedupe_key("big news", "https://news.test/a?id=1")
    assert key != feeds.dedupe_key("big news", "https://news.test/a?id=2")


def test_feed_types_pass_the_guard_and_oversize_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    net = FakeNet(monkeypatch)
    net.site(
        "ok.test",
        "93.184.216.34",
        lambda r: httpx.Response(200, headers={"content-type": "text/xml"}, text="<rss/>"),
    )
    assert safe_fetch.fetch("https://ok.test/feed", safe_fetch.FEED_TYPES).body == b"<rss/>"
    big = b"<rss>" + b"a" * safe_fetch.MAX_BYTES
    net.site(
        "big.test",
        "93.184.216.35",
        lambda r: httpx.Response(200, headers={"content-type": "application/rss+xml"}, content=big),
    )
    with pytest.raises(safe_fetch.FetchBlocked, match="larger"):
        safe_fetch.fetch("https://big.test/feed", safe_fetch.FEED_TYPES)
    net.site(
        "html.test",
        "93.184.216.36",
        lambda r: httpx.Response(200, headers={"content-type": "text/html"}, text="<rss/>"),
    )
    with pytest.raises(safe_fetch.FetchBlocked, match="content type"):
        safe_fetch.fetch("https://html.test/feed", safe_fetch.FEED_TYPES)
