"""Fetch and job-queue hardening of the security audit: S-03 (the deadline covers the response head and
1xx heads; a job has a wall-clock limit; an interrupted job counts an attempt), S-04 and S-05 (malformed
host names and redirect locations end as FetchError). Local servers on 127.0.0.1 stand in for remote hosts:
the address check is patched for them, nothing leaves the machine."""

import socket
import threading
import time
from datetime import timedelta
from typing import Any

import httpx
import pytest
from django.utils import timezone

from core.models import Job
from core.services import jobs, safe_fetch
from core.tests.fakenet import FakeNet, redirect


def serve_once(chunks: list[bytes], delay: float) -> tuple[int, threading.Event]:
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    stop = threading.Event()

    def run() -> None:
        conn, _ = srv.accept()
        conn.recv(4096)
        try:
            for chunk in chunks:
                if stop.is_set():
                    break
                conn.sendall(chunk)
                time.sleep(delay)
        except OSError:
            pass
        finally:
            conn.close()
            srv.close()

    threading.Thread(target=run, daemon=True).start()
    return srv.getsockname()[1], stop


def fetch_local(monkeypatch: pytest.MonkeyPatch, port: int) -> tuple[float, str]:
    monkeypatch.setattr(safe_fetch, "TIMEOUT", 1.0)
    monkeypatch.setattr(safe_fetch, "checked_ip", lambda url: "127.0.0.1")
    started = time.monotonic()
    try:
        safe_fetch.fetch(f"http://slow.test:{port}/", safe_fetch.HTML_TYPES)
        outcome = "fetched"
    except safe_fetch.FetchError as exc:
        outcome = str(exc)
    return time.monotonic() - started, outcome


def test_a_head_that_trickles_in_ends_at_the_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    head = (
        b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nX-Pad: "
        + b"a" * 20
        + b"\r\nContent-Length: 2\r\n\r\nok"
    )
    port, stop = serve_once([bytes([b]) for b in head], 0.05)  # about 4.7 s, each read well under 1 s
    elapsed, outcome = fetch_local(monkeypatch, port)
    stop.set()
    assert outcome == "timeout"
    assert elapsed < 2.0


def test_endless_1xx_heads_end_at_the_deadline(monkeypatch: pytest.MonkeyPatch) -> None:
    heads = [b"HTTP/1.1 100 Continue\r\n\r\n"] * 200  # one every 50 ms: 10 s
    port, stop = serve_once(heads, 0.05)
    elapsed, outcome = fetch_local(monkeypatch, port)
    stop.set()
    assert outcome == "timeout"
    assert elapsed < 2.0


def test_a_normal_local_answer_is_still_fetched(monkeypatch: pytest.MonkeyPatch) -> None:
    port, _ = serve_once([b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 2\r\n\r\nok"], 0)
    _, outcome = fetch_local(monkeypatch, port)
    assert outcome == "fetched"


@pytest.mark.parametrize("host", ["a" * 64 + ".test", "a..b.test"])
def test_an_unencodable_host_name_is_a_fetch_error(host: str, monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(safe_fetch.FetchError):
        safe_fetch.resolve(host, 443)
    sent: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200)

    monkeypatch.setattr(safe_fetch, "TRANSPORT", httpx.MockTransport(handler))
    with pytest.raises(safe_fetch.FetchError):
        safe_fetch.fetch(f"https://{host}/", safe_fetch.HTML_TYPES)
    assert sent == []


@pytest.mark.parametrize(
    "location", ["http://[::1", "//[", "http://xn--a/", "http://a..b/", "http://" + "a" * 64 + ".test/"]
)
def test_a_malformed_redirect_location_is_a_fetch_error(
    monkeypatch: pytest.MonkeyPatch, location: str
) -> None:
    net = FakeNet(monkeypatch)
    net.site("public.test", "93.184.215.14", redirect(location))
    with pytest.raises(safe_fetch.FetchError):
        safe_fetch.fetch("https://public.test/", safe_fetch.HTML_TYPES)
    assert len(net.requests) == 1


@pytest.mark.django_db
def test_a_job_past_its_time_limit_fails_an_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(jobs, "JOB_TIME_LIMIT", 1)

    @jobs.handler("test_hang")
    def hang(payload: dict[str, Any]) -> None:
        time.sleep(5)

    jobs.enqueue("test_hang", "hang:1", {})
    started = time.monotonic()
    counts = jobs.run_pending(kinds={"test_hang"})
    assert time.monotonic() - started < 3
    assert counts["retry"] == 1
    job = Job.objects.get(key="hang:1")
    assert (job.status, job.attempts) == (Job.Status.PENDING, 1)
    assert "JobTimeout" in job.last_error


@pytest.mark.django_db
def test_an_interrupted_job_counts_an_attempt_and_ends_failed() -> None:
    old = timezone.now() - jobs.STALE_AFTER - timedelta(minutes=1)
    once = Job.objects.create(kind="nothing", key="stale:1", payload={}, status=Job.Status.RUNNING)
    last = Job.objects.create(
        kind="nothing", key="stale:2", payload={}, status=Job.Status.RUNNING, attempts=jobs.MAX_ATTEMPTS - 1
    )
    Job.objects.filter(pk__in=[once.pk, last.pk]).update(updated_at=old)
    jobs.run_pending(kinds={"none-of-these"})
    once.refresh_from_db()
    last.refresh_from_db()
    assert (once.status, once.attempts) == (Job.Status.PENDING, 1)
    assert (last.status, last.attempts) == (Job.Status.FAILED, jobs.MAX_ATTEMPTS)
