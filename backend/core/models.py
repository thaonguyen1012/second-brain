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


class LlmCall(models.Model):
    """Every LLM request, refused ones included (DECISIONS 10.3, 10.4). cost is USD; 0 on a free tier."""

    provider = models.CharField(max_length=20)
    purpose = models.CharField(max_length=50)
    model = models.CharField(max_length=100)
    prompt_version = models.CharField(max_length=20, blank=True)
    in_tokens = models.PositiveIntegerField(default=0)
    out_tokens = models.PositiveIntegerField(default=0)
    cache_read = models.PositiveIntegerField(default=0)
    cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    latency_ms = models.PositiveIntegerField(default=0)
    ok = models.BooleanField(default=False)
    error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return f"{self.purpose} {self.model} ok={self.ok}"


class LlmCache(models.Model):
    """Validated LLM output by content hash (purpose, prompt version, model, input), so the same input is
    never paid for twice."""

    key = models.CharField(max_length=64, unique=True)
    purpose = models.CharField(max_length=50)
    output = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.purpose} {self.key[:12]}"
