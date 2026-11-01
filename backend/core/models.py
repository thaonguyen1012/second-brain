from django.db import models
from django.utils import timezone


class Job(models.Model):
    """A unit of background work (DECISIONS 10.2): network and LLM calls never run inside a request.

    `key` is the idempotency key: enqueueing the same key twice keeps one job. `manage.py run_jobs` (cron)
    claims pending jobs whose run_after has passed.
    """

    class Status(models.TextChoices):
        PENDING = "pending"
        RUNNING = "running"
        DONE = "done"
        FAILED = "failed"

    kind = models.CharField(max_length=50)
    key = models.CharField(max_length=200, unique=True)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    run_after = models.DateTimeField(default=timezone.now)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "run_after"])]

    def __str__(self) -> str:
        return f"{self.key} ({self.status})"
