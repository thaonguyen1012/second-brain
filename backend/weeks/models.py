from django.conf import settings
from django.db import models


class Week(models.Model):
    """One week, Monday to Sunday in Europe/Prague (DECISIONS 9.1, 9.2): planning and review rituals.

    No tasks here: daily tasks live in Todoist / Google Calendar.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="weeks")
    start_date = models.DateField()  # always a Monday
    planning_journal = models.TextField(blank=True)  # expectations for the week
    planned_at = models.DateTimeField(null=True, blank=True)
    # Review journal: the fixed questions, then Alex's own two (DECISIONS 9.2).
    review_win = models.TextField(blank=True)  # biggest win
    review_distraction = models.TextField(blank=True)  # what pulled time away from priorities
    review_learned = models.TextField(blank=True)  # what did I learn
    review_satisfied = models.TextField(blank=True)  # am I satisfied
    review_changed_mind = models.TextField(blank=True)  # what changed my mind (6.2)
    review_opportunity_evidence = models.TextField(blank=True)  # which opportunity got new evidence
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "start_date"], name="uniq_week_start"),
            models.CheckConstraint(condition=models.Q(start_date__iso_week_day=1), name="week_starts_monday"),
        ]

    def __str__(self) -> str:
        return f"Week of {self.start_date.isoformat()}"

    @property
    def objective_list(self) -> "list[Objective] | models.QuerySet[Objective]":
        """The objectives; none for an unsaved week (weeks.services.find_week answers one to a GET)."""
        return self.objectives.all() if self.pk else []


class Objective(models.Model):
    """A weekly priority; 3-5 per week is a UI guideline, not a constraint."""

    class Status(models.TextChoices):
        OPEN = "open"
        DONE = "done"
        DROPPED = "dropped"

    week = models.ForeignKey(Week, on_delete=models.CASCADE, related_name="objectives")
    title = models.CharField(max_length=300)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    carried_from = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="carried_to"
    )
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            # Carrying the same objective into a week twice is a no-op (planning is idempotent).
            models.UniqueConstraint(fields=["week", "carried_from"], name="uniq_objective_carry"),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"
