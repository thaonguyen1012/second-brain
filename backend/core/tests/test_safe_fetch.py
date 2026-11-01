"""SSRF guard (DECISIONS 10.5) with fake DNS and HTTP."""

import httpx
import pytest

from core.services import safe_fetch
from core.services.safe_fetch import FetchBlocked, FetchError, fetch
from core.tests.fakenet import FakeNet, html, redirect

PUBLIC = "93.184.215.14"


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch) -> FakeNet:
    return FakeNet(monkeypatch)


@pytest.mark.parametrize(
    "address",
    [
        "10.0.0.5",
        "172.16.0.1",
        "192.168.1.1",
        "127.0.0.1",
        "169.254.169.254",  # cloud metadata
        "100.64.0.1",  # carrier-grade NAT
        "0.0.0.0",  # noqa: S104
        "224.0.0.1",
        "240.0.0.1",
        "::1",
        "fe80::1",
        "fc00::1",
        "fd12:3456::1",
        "ff02::1",
        "::ffff:10.0.0.1",
        "2002:0a00:0001::1",  # 6to4 wrapping 10.0.0.1
        "64:ff9b::7f00:1",  # NAT64 wrapping 127.0.0.1
    ],
)
def test_non_public_addresses(address: str) -> None:
    assert not safe_fetch.is_public(address)


def test_public_addresses() -> None:
    assert safe_fetch.is_public(PUBLIC)
    assert safe_fetch.is_public("2606:4700::6810:84e5")


def test_private_ip_is_refused_before_any_request(net: FakeNet) -> None:
    net.site("intranet.test", "10.0.0.5", html("secret"))
    with pytest.raises(FetchBlocked, match="non-public"):
        fetch("http://intranet.test/", safe_fetch.HTML_TYPES)
    assert net.requests == []


def test_one_private_address_among_many_is_refused(net: FakeNet) -> None:
    net.site("mixed.test", PUBLIC, html("x"))
    net.dns["mixed.test"] = [PUBLIC, "127.0.0.1"]
    with pytest.raises(FetchBlocked):
        fetch("http://mixed.test/", safe_fetch.HTML_TYPES)


def test_redirect_to_private_ip_is_refused(net: FakeNet) -> None:
    net.site("public.test", PUBLIC, redirect("http://metadata.test/latest/"))
    net.site("metadata.test", "169.254.169.254", html("creds"))
    with pytest.raises(FetchBlocked, match="non-public"):
        fetch("https://public.test/", safe_fetch.HTML_TYPES)
    assert [r.headers["host"] for r in net.requests] == ["public.test"]


def test_redirect_to_other_scheme_is_refused(net: FakeNet) -> None:
    net.site("public.test", PUBLIC, redirect("file:///etc/passwd"))
    with pytest.raises(FetchBlocked, match="scheme"):
        fetch("https://public.test/", safe_fetch.HTML_TYPES)


def test_too_many_redirects(net: FakeNet) -> None:
    for i in range(5):
        net.site(f"hop{i}.test", PUBLIC, redirect(f"http://hop{i + 1}.test/"))
    with pytest.raises(FetchBlocked, match="redirects"):
        fetch("http://hop0.test/", safe_fetch.HTML_TYPES)
    assert len(net.requests) == safe_fetch.MAX_REDIRECTS + 1


def test_three_redirects_are_followed(net: FakeNet) -> None:
    for i in range(3):
        net.site(f"hop{i}.test", PUBLIC, redirect(f"http://hop{i + 1}.test/"))
    net.site("hop3.test", PUBLIC, html("<title>end</title>"))
    page = fetch("http://hop0.test/", safe_fetch.HTML_TYPES)
    assert page.url == "http://hop3.test/" and b"end" in page.body


def test_oversize_body_is_refused(net: FakeNet) -> None:
    big = b"a" * (safe_fetch.MAX_BYTES + 1)

    def stream(request: httpx.Request) -> httpx.Response:  # no Content-Length: the cap applies while reading
        return httpx.Response(200, headers={"content-type": "text/html"}, stream=httpx.ByteStream(big))

    net.site("big.test", PUBLIC, stream)
    with pytest.raises(FetchBlocked, match="larger"):
        fetch("http://big.test/", safe_fetch.HTML_TYPES)
    net.site("declared.test", PUBLIC, html("x", **{"content-length": str(10**9)}))
    with pytest.raises(FetchBlocked, match="larger"):
        fetch("http://declared.test/", safe_fetch.HTML_TYPES)


def test_non_html_content_type_is_refused(net: FakeNet) -> None:
    net.site("pdf.test", PUBLIC, lambda r: httpx.Response(200, headers={"content-type": "application/pdf"}))
    with pytest.raises(FetchBlocked, match="content type"):
        fetch("http://pdf.test/", safe_fetch.HTML_TYPES)


def test_connection_is_pinned_to_the_checked_ip(net: FakeNet) -> None:
    net.site("site.test", PUBLIC, html("ok"))
    fetch("https://site.test:8443/a?b=1", safe_fetch.HTML_TYPES)
    sent = net.requests[0]
    assert sent.url.host == PUBLIC and sent.url.port == 8443
    assert sent.headers["host"] == "site.test:8443"
    assert sent.extensions["sni_hostname"] == "site.test"


def test_other_schemes_and_errors(net: FakeNet) -> None:
    with pytest.raises(FetchBlocked):
        fetch("ftp://site.test/x", safe_fetch.HTML_TYPES)
    with pytest.raises(FetchError, match="DNS"):
        fetch("http://unknown.test/", safe_fetch.HTML_TYPES)
    net.site("down.test", PUBLIC, lambda r: httpx.Response(503))
    with pytest.raises(FetchError, match="503"):
        fetch("http://down.test/", safe_fetch.HTML_TYPES)


def test_compressed_body_is_refused(net: FakeNet) -> None:
    gz = lambda r: httpx.Response(  # noqa: E731
        200, headers={"content-type": "text/html", "content-encoding": "gzip, gzip"}, content=b"\x1f\x8b"
    )
    net.site("bomb.test", PUBLIC, gz)
    with pytest.raises(FetchBlocked, match="compressed"):
        fetch("http://bomb.test/", safe_fetch.HTML_TYPES)


def test_site_local_ipv6_is_not_public() -> None:
    assert not safe_fetch.is_public("fec0::1")
