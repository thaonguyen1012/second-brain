"""Job queue on the Job table: enqueue (idempotent), handlers by kind, periodic schedulers, and the loop
used by run_jobs."""

import logging
import signal
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from core.models import Job

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
RETRY_DELAY = timedelta(minutes=10)
STALE_AFTER = timedelta(minutes=30)  # a RUNNING job this old was interrupted (crash, kill)
# Wall-clock limit of one job (security audit S-03): a fetch has its own 10 s deadline, a feeds run fetches
# each source in turn; this is the backstop for anything else that hangs, so one job never holds the queue.
JOB_TIME_LIMIT = 600

Handler = Callable[[dict[str, Any]], None]
Scheduler = Callable[[datetime], None]
_handlers: dict[str, Handler] = {}
_schedulers: list[Scheduler] = []


class JobTimeout(Exception):
    """The job ran past JOB_TIME_LIMIT; counted as a failed attempt."""


@contextmanager
def _time_limit(seconds: int) -> Iterator[None]:
    """SIGALRM-based limit, in the main thread of a Unix process only (run_jobs); elsewhere no limit."""
    if not hasattr(signal, "SIGALRM") or threading.current_thread() is not threading.main_thread():
        yield
        return

    def expire(signum: int, frame: object) -> None:
        raise JobTimeout(f"ran longer than {seconds} s")

    previous = signal.signal(signal.SIGALRM, expire)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


class RetryLater(Exception):
    """Not a failure (rate limit, quota): the job stays pending and attempts are not counted. Without `delay`
    (a limit every job of the kind meets, such as the LLM budget) the rest of this run skips jobs of the same
    kind. With `delay` (a limit only some jobs of the kind meet, such as one API's) only this job waits that
    long: the run goes on with the other jobs of its kind, so they never wait behind it."""

    def __init__(self, message: str, delay: timedelta | None = None) -> None:
        super().__init__(message)
        self.delay = delay


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
    """Run due jobs one by one; returns counts by outcome. A job left RUNNING by a killed process counts as a
    failed attempt (S-03), so a job that kills its runner every time ends FAILED instead of looping."""
    stale = Job.objects.filter(status=Job.Status.RUNNING, updated_at__lt=timezone.now() - STALE_AFTER)
    stale.filter(attempts__gte=MAX_ATTEMPTS - 1).update(
        status=Job.Status.FAILED,
        attempts=F("attempts") + 1,
        last_error="interrupted (process killed or hung)",
    )
    stale.update(
        status=Job.Status.PENDING,
        attempts=F("attempts") + 1,
        last_error="interrupted (process killed or hung)",
    )
    counts = {"done": 0, "retry": 0, "deferred": 0, "failed": 0}
    paused: set[str] = set()  # kinds a RetryLater without a delay stopped for the rest of this run
    for _ in range(limit):
        job = _claim(paused, kinds)
        if job is None:
            break
        outcome, pauses_kind = _run(job)
        counts[outcome] += 1
        if pauses_kind:
            paused.add(job.kind)
    return counts


def _run(job: Job) -> tuple[str, bool]:
    """Run one claimed job: its outcome, and whether the rest of the run skips its kind."""
    fn = _handlers.get(job.kind)
    try:
        if fn is None:
            raise LookupError(f"no handler for job kind {job.kind!r}")
        logger.info("job start", extra={"job": job.key})
        with _time_limit(JOB_TIME_LIMIT):
            fn(job.payload)
    except RetryLater as exc:
        logger.warning("job deferred", extra={"job": job.key, "reason": str(exc)})
        job.status, job.last_error = Job.Status.PENDING, str(exc)[:500]
        if exc.delay is not None:
            job.run_after = timezone.now() + exc.delay  # in the future: not claimed again in this run
        job.save(update_fields=["status", "last_error", "run_after", "updated_at"])
        return "deferred", exc.delay is None
    except Exception as exc:
        logger.exception("job error", extra={"job": job.key})
        job.attempts += 1
        job.last_error = f"{type(exc).__name__}: {exc}"[:500]
        if job.attempts >= MAX_ATTEMPTS:
            job.status = Job.Status.FAILED
        else:
            job.status, job.run_after = Job.Status.PENDING, timezone.now() + RETRY_DELAY
        job.save(update_fields=["status", "attempts", "last_error", "run_after", "updated_at"])
        return ("failed" if job.status == Job.Status.FAILED else "retry"), False
    job.status, job.last_error = Job.Status.DONE, ""
    job.save(update_fields=["status", "last_error", "updated_at"])
    logger.info("job done", extra={"job": job.key})
    return "done", False
