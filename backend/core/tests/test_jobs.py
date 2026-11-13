from datetime import timedelta
from typing import Any

import pytest
from django.utils import timezone

from core.models import Job
from core.services import jobs

pytestmark = pytest.mark.django_db


@pytest.fixture
def calls(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    seen: list[str] = []

    def ok(payload: dict[str, Any]) -> None:
        seen.append(payload["n"])

    def limited(payload: dict[str, Any]) -> None:
        seen.append(payload["n"])
        raise jobs.RetryLater("429")

    def broken(payload: dict[str, Any]) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(jobs, "_handlers", {"ok": ok, "limited": limited, "broken": broken})
    return seen


def test_enqueue_is_idempotent(calls: list[str]) -> None:
    first = jobs.enqueue("ok", "ok:1", {"n": "a"})
    assert jobs.enqueue("ok", "ok:1", {"n": "b"}).pk == first.pk
    assert jobs.run_pending() == {"done": 1, "retry": 0, "deferred": 0, "failed": 0}
    assert calls == ["a"]
    assert jobs.run_pending()["done"] == 0  # done jobs never run again


def test_rate_limited_job_stays_pending_and_pauses_its_kind(calls: list[str]) -> None:
    jobs.enqueue("limited", "l:1", {"n": "1"})
    jobs.enqueue("limited", "l:2", {"n": "2"})
    jobs.enqueue("ok", "ok:3", {"n": "3"})
    assert jobs.run_pending() == {"done": 1, "retry": 0, "deferred": 1, "failed": 0}
    assert calls == ["1", "3"]
    job = Job.objects.get(key="l:1")
    assert (job.status, job.attempts, job.last_error) == ("pending", 0, "429")


def test_a_deferral_with_a_delay_waits_alone(monkeypatch: pytest.MonkeyPatch, calls: list[str]) -> None:
    def picky(payload: dict[str, Any]) -> None:
        calls.append(payload["n"])
        if payload["n"].startswith("api"):  # a limit only these jobs meet (one API's)
            raise jobs.RetryLater("403", delay=timedelta(minutes=15))

    monkeypatch.setitem(jobs._handlers, "picky", picky)
    for n, name in enumerate(("api-1", "api-2", "site-1", "api-3", "site-2")):
        jobs.enqueue("picky", f"p:{n}", {"n": name})
    # each waiting job is tried once and waits; the other jobs of its kind still run in the same run
    assert jobs.run_pending() == {"done": 2, "retry": 0, "deferred": 3, "failed": 0}
    assert calls == ["api-1", "api-2", "site-1", "api-3", "site-2"]
    job = Job.objects.get(key="p:0")
    assert (job.status, job.attempts, job.last_error) == ("pending", 0, "403")
    assert job.run_after > timezone.now() + timedelta(minutes=14)
    assert jobs.run_pending() == {"done": 0, "retry": 0, "deferred": 0, "failed": 0}  # they wait their delay
    Job.objects.filter(status="pending").update(run_after=timezone.now())
    assert jobs.run_pending()["deferred"] == 3


def test_failing_job_retries_then_fails(calls: list[str]) -> None:
    jobs.enqueue("broken", "b:1", {})
    for expected in ("pending", "pending", "failed"):
        Job.objects.filter(key="b:1").update(run_after="2000-01-01T00:00Z")
        jobs.run_pending()
        assert Job.objects.get(key="b:1").status == expected
    assert Job.objects.get(key="b:1").last_error == "RuntimeError: boom"
