"""Outbound HTTP for ingest, guarded against SSRF (DECISIONS 10.5).

Only http/https; every hop's host is resolved and all its addresses must be public; the connection goes to
the checked IP (Host header and TLS SNI keep the name), so DNS rebinding between check and connect cannot
work; at most MAX_REDIRECTS redirects, a total deadline and a byte cap. Only call this from background jobs.
"""

import ipaddress
import logging
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin

import httpx

logger = logging.getLogger(__name__)

MAX_REDIRECTS = 3
TIMEOUT = 10.0  # seconds for the whole fetch, redirects included
MAX_BYTES = 2 * 1024 * 1024
USER_AGENT = "AlexBrain/1.0 (link preview)"
HTML_TYPES = ("text/html", "application/xhtml+xml")
IMAGE_TYPES = ("image/jpeg", "image/png", "image/gif", "image/webp")
FEED_TYPES = ("application/rss+xml", "application/atom+xml", "application/xml", "text/xml")
TRANSPORT: httpx.BaseTransport | None = None  # tests swap in httpx.MockTransport


class FetchError(Exception):
    """The fetch failed for a reason that may go away (network, HTTP status, timeout)."""


class FetchBlocked(FetchError):
    """The guard refused the URL or the response; retrying will not help."""


@dataclass(frozen=True)
class Fetched:
    url: str  # final URL after redirects
    content_type: str  # media type without parameters, lowercase
    charset: str | None
    body: bytes


def resolve(host: str, port: int) -> list[str]:
    """All addresses of host (separate function so tests can replace DNS)."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise FetchError(f"DNS lookup failed for {host}") from exc
    return list(dict.fromkeys(str(info[4][0]) for info in infos))


def is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address):
        # Addresses that embed an IPv4 address are judged by that address.
        embedded = ip.ipv4_mapped or ip.sixtofour or (ip.teredo[1] if ip.teredo else None)
        if embedded is not None:
            return is_public(str(embedded))
        if ip in ipaddress.IPv6Network("64:ff9b::/96"):  # NAT64
            return is_public(str(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)))
        if ip in ipaddress.IPv6Network("fec0::/10"):  # deprecated site-local, not flagged by ipaddress
            return False
    return ip.is_global and not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def checked_ip(url: httpx.URL) -> str:
    if url.scheme not in ("http", "https"):
        raise FetchBlocked(f"scheme {url.scheme!r} is not allowed")
    if not url.host:
        raise FetchBlocked("URL has no host")
    port = url.port or (443 if url.scheme == "https" else 80)
    addresses = resolve(url.host, port)
    if not addresses:
        raise FetchError(f"no address for {url.host}")
    for address in addresses:
        if not is_public(address):
            raise FetchBlocked(f"{url.host} resolves to a non-public address")
    return addresses[0]


def fetch(url: str, accept: tuple[str, ...]) -> Fetched:
    """GET url and return the body if its media type is in `accept`. Raises FetchError / FetchBlocked."""
    deadline = time.monotonic() + TIMEOUT
    # trust_env=False: proxy variables must not route around the IP pinning.
    with httpx.Client(
        transport=TRANSPORT, timeout=TIMEOUT, trust_env=False, follow_redirects=False
    ) as client:
        current = _parse(url)
        for _ in range(MAX_REDIRECTS + 1):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise FetchError("timeout")
            ip = checked_ip(current)
            logger.info("outbound fetch", extra={"host": current.host, "ip": ip})
            request = client.build_request(
                "GET",
                current.copy_with(host=ip),
                headers={
                    "Host": current.netloc.decode("ascii"),
                    "User-Agent": USER_AGENT,
                    "Accept": ", ".join(accept),
                    "Accept-Encoding": "identity",
                },
                extensions={
                    # httpx timeouts are per operation; shrink them so all hops share one deadline.
                    "timeout": httpx.Timeout(remaining).as_dict(),
                    **({"sni_hostname": current.host} if current.scheme == "https" else {}),
                },
            )
            try:
                response = client.send(request, stream=True)
            except httpx.HTTPError as exc:
                raise FetchError(f"{type(exc).__name__} for {current.host}") from exc
            try:
                if response.is_redirect:
                    location = response.headers.get("location", "")
                    current = _parse(urljoin(str(current), location))
                    continue
                return _read(response, str(current), accept, deadline)
            finally:
                response.close()
        raise FetchBlocked(f"more than {MAX_REDIRECTS} redirects")


def _parse(url: str) -> httpx.URL:
    try:
        return httpx.URL(url)
    except httpx.InvalidURL as exc:
        raise FetchBlocked("invalid URL") from exc


def _read(response: httpx.Response, url: str, accept: tuple[str, ...], deadline: float) -> Fetched:
    if response.status_code != 200:
        raise FetchError(f"HTTP {response.status_code}")
    media_type, _, params = response.headers.get("content-type", "").partition(";")
    media_type = media_type.strip().lower()
    if media_type not in accept:
        raise FetchBlocked(f"content type {media_type or 'missing'!r} is not accepted")
    if response.headers.get("content-encoding", "identity").strip().lower() != "identity":
        # httpx would decode it with no output limit (a few hundred bytes can expand to GBs).
        raise FetchBlocked("compressed body refused")
    declared = response.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_BYTES:
        raise FetchBlocked("body larger than the limit")
    body = bytearray()
    try:
        for chunk in response.iter_raw():
            body += chunk
            if len(body) > MAX_BYTES:
                raise FetchBlocked("body larger than the limit")
            if time.monotonic() > deadline:
                raise FetchError("timeout")
    except httpx.HTTPError as exc:
        raise FetchError(f"{type(exc).__name__} while reading") from exc
    charset = None
    for param in params.split(";"):
        name, _, value = param.strip().partition("=")
        if name.lower() == "charset" and value:
            charset = value.strip('"').strip()
    return Fetched(url=url, content_type=media_type, charset=charset, body=bytes(body))
