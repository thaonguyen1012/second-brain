"""Job queue on the Job table: enqueue (idempotent), handlers by kind, periodic schedulers, and the loop
used by run_jobs."""

import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

from core.models import Job

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
RETRY_DELAY = timedelta(minutes=10)
STALE_AFTER = timedelta(minutes=30)  # a RUNNING job this old was interrupted (crash, kill)

Handler = Callable[[dict[str, Any]], None]
Scheduler = Callable[[datetime], None]
_handlers: dict[str, Handler] = {}
_schedulers: list[Scheduler] = []


class RetryLater(Exception):
    """Not a failure (rate limit, quota): the job stays pending, attempts are not counted, and the rest of
    this run skips jobs of the same kind."""


def handler(kind: str) -> Callable[[Handler], Handler]:
    def register(fn: Handler) -> Handler:
        _handlers[kind] = fn
        return fn

    return register


def periodic(fn: Scheduler) -> Scheduler:
    """Register a function that run_jobs calls (with the current time) before running jobs; it enqueues the
    jobs that are due, with idempotency keys per slot (e.g. `brief:2026-11-02`), so cron needs one line."""
    _schedulers.append(fn)
    return fn


def schedule(now: datetime | None = None) -> None:
    moment = now or timezone.now()
    for fn in _schedulers:
        fn(moment)


def enqueue(kind: str, key: str, payload: dict[str, Any]) -> Job:
    job, _ = Job.objects.get_or_create(key=key, defaults={"kind": kind, "payload": payload})
    return job


def _claim(skip_kinds: set[str], kinds: set[str] | None) -> Job | None:
    with transaction.atomic():
        jobs = Job.objects.select_for_update(skip_locked=True).filter(
            status=Job.Status.PENDING, run_after__lte=timezone.now()
        )
        if kinds:
            jobs = jobs.filter(kind__in=kinds)
        job = jobs.exclude(kind__in=skip_kinds).order_by("id").first()
        if job is not None:
            job.status = Job.Status.RUNNING
            job.save(update_fields=["status", "updated_at"])
        return job


def run_pending(limit: int = 100, kinds: set[str] | None = None) -> dict[str, int]:
    """Run due jobs one by one; returns counts by outcome."""
    Job.objects.filter(status=Job.Status.RUNNING, updated_at__lt=timezone.now() - STALE_AFTER).update(
        status=Job.Status.PENDING
    )
    counts = {"done": 0, "retry": 0, "deferred": 0, "failed": 0}
    deferred: set[str] = set()
    for _ in range(limit):
        job = _claim(deferred, kinds)
        if job is None:
            break
        outcome = _run(job)
        counts[outcome] += 1
        if outcome == "deferred":
            deferred.add(job.kind)
    return counts


def _run(job: Job) -> str:
    fn = _handlers.get(job.kind)
    try:
        if fn is None:
            raise LookupError(f"no handler for job kind {job.kind!r}")
        logger.info("job start", extra={"job": job.key})
        fn(job.payload)
    except RetryLater as exc:
        logger.warning("job deferred", extra={"job": job.key, "reason": str(exc)})
        job.status, job.last_error = Job.Status.PENDING, str(exc)[:500]
        job.save(update_fields=["status", "last_error", "updated_at"])
        return "deferred"
    except Exception as exc:
        logger.exception("job error", extra={"job": job.key})
        job.attempts += 1
        job.last_error = f"{type(exc).__name__}: {exc}"[:500]
        if job.attempts >= MAX_ATTEMPTS:
            job.status = Job.Status.FAILED
        else:
            job.status, job.run_after = Job.Status.PENDING, timezone.now() + RETRY_DELAY
        job.save(update_fields=["status", "attempts", "last_error", "run_after", "updated_at"])
        return "failed" if job.status == Job.Status.FAILED else "retry"
    job.status, job.last_error = Job.Status.DONE, ""
    job.save(update_fields=["status", "last_error", "updated_at"])
    logger.info("job done", extra={"job": job.key})
    return "done"
