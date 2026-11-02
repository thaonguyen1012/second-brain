from django.conf import settings
from django.db import models

from library.models import Item


class ProjectDetails(models.Model):
    """Freelance data of an Item with type=project (DECISIONS 9.2); the Item stays the shared model (4.1).

    No rate tiers (Kimai style) until real data asks for them (DECISIONS 4.5).
    """

    class Billing(models.TextChoices):
        FIXED = "fixed"
        HOURLY = "hourly"

    item = models.OneToOneField(
        Item,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="project",
        limit_choices_to={"type": Item.Type.PROJECT},
    )
    client = models.CharField(max_length=200, blank=True)  # free text, no CRM
    billing = models.CharField(max_length=10, choices=Billing.choices, default=Billing.FIXED)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)  # agreed, fixed
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="CZK")  # ISO 4217
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "project details"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(billing="hourly") | models.Q(hourly_rate__isnull=False),
                name="project_hourly_has_rate",
            ),
            models.CheckConstraint(
                condition=(models.Q(price__isnull=True) | models.Q(price__gte=0))
                & (models.Q(hourly_rate__isnull=True) | models.Q(hourly_rate__gte=0)),
                name="project_money_not_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item.title} ({self.billing})"


class TimeEntry(models.Model):
    """Time spent on a project, typed in by hand or measured by the timer.

    A running timer has `started_at` set and `minutes` null; at most one runs per user.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="time_entries")
    project = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name="time_entries",
        limit_choices_to={"type": Item.Type.PROJECT},
    )
    # Links the hours to a weekly priority: the Week review splits "for objectives" vs "other" time.
    objective = models.ForeignKey(
        "weeks.Objective", on_delete=models.SET_NULL, null=True, blank=True, related_name="time_entries"
    )
    date = models.DateField()  # Europe/Prague day the work counts for
    minutes = models.PositiveIntegerField(null=True, blank=True)  # null while the timer runs
    started_at = models.DateTimeField(null=True, blank=True)  # set when measured by the timer
    note = models.TextField(blank=True)
    billable = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "time entries"
        indexes = [models.Index(fields=["user", "date"]), models.Index(fields=["created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["user"], condition=models.Q(minutes__isnull=True), name="one_running_timer"
            ),
            models.CheckConstraint(
                condition=models.Q(minutes__isnull=False) | models.Q(started_at__isnull=False),
                name="time_entry_minutes_or_running",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date.isoformat()} {self.minutes if self.minutes is not None else 'running'} min"

    @property
    def running(self) -> bool:
        return self.minutes is None
