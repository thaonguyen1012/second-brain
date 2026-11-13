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


def test_a_deferral_with_a_delay_lets_the_other_jobs_of_its_kind_go_first(
    monkeypatch: pytest.MonkeyPatch, calls: list[str]
) -> None:
    def picky(payload: dict[str, Any]) -> None:
        calls.append(payload["n"])
        if payload["n"] == "api":  # a limit only this job hits (one API's)
            raise jobs.RetryLater("403", delay=timedelta(minutes=15))

    monkeypatch.setitem(jobs._handlers, "picky", picky)
    jobs.enqueue("picky", "p:1", {"n": "api"})
    jobs.enqueue("picky", "p:2", {"n": "site"})
    assert jobs.run_pending() == {"done": 0, "retry": 0, "deferred": 1, "failed": 0}  # the kind waits
    job = Job.objects.get(key="p:1")
    assert (job.status, job.attempts, job.last_error) == ("pending", 0, "403")
    assert job.run_after > timezone.now() + timedelta(minutes=14)
    assert jobs.run_pending()["done"] == 1  # the next run: the other job, not the one that waits
    assert calls == ["api", "site"]


def test_failing_job_retries_then_fails(calls: list[str]) -> None:
    jobs.enqueue("broken", "b:1", {})
    for expected in ("pending", "pending", "failed"):
        Job.objects.filter(key="b:1").update(run_after="2000-01-01T00:00Z")
        jobs.run_pending()
        assert Job.objects.get(key="b:1").status == expected
    assert Job.objects.get(key="b:1").last_error == "RuntimeError: boom"
