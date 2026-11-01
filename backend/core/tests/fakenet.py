"""Fake DNS and HTTP for tests: no test may reach the network."""

from collections.abc import Callable
from typing import Any

import httpx
import pytest

from core.services import safe_fetch

Route = Callable[[httpx.Request], httpx.Response]


class FakeNet:
    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.dns: dict[str, list[str]] = {}
        self.routes: dict[str, Route] = {}  # by Host header
        self.requests: list[httpx.Request] = []
        monkeypatch.setattr(safe_fetch, "resolve", self._resolve)
        monkeypatch.setattr(safe_fetch, "TRANSPORT", httpx.MockTransport(self._handle))

    def site(self, host: str, ip: str, route: Route) -> None:
        self.dns[host] = [ip]
        self.routes[host] = route

    def _resolve(self, host: str, port: int) -> list[str]:
        if host not in self.dns:
            raise safe_fetch.FetchError(f"DNS lookup failed for {host}")
        return self.dns[host]

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        response = self.routes[request.headers["host"].split(":")[0]](request)
        if isinstance(
            response.stream, httpx.ByteStream
        ):  # content= / text= responses: stream them like the network
            response = httpx.Response(response.status_code, headers=response.headers, stream=response.stream)
        return response


def html(body: str, **headers: Any) -> Route:
    return lambda request: httpx.Response(
        200, headers={"content-type": "text/html; charset=utf-8", **headers}, text=body
    )


def redirect(location: str) -> Route:
    return lambda request: httpx.Response(302, headers={"location": location})
