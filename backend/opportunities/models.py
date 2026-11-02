from django.conf import settings
from django.db import models
from django.utils import timezone

from inbox.models import InboxEntry
from library.models import Item, Note


class Opportunity(models.Model):
    """A niche hypothesis of Alex's own, IdeaBrowser style (DECISIONS 9.2).

    Scores live in ScoreSnapshot (append-only history); "stale" is computed from Evidence (services.py).
    TODO(step 5, DECISIONS 9.4): "fit" links to the Skill model of the development app; not built yet.
    """

    class Decision(models.TextChoices):  # the keep / drop / build call, due by `decide_by`
        OPEN = "open"  # undecided
        KEEP = "keep"  # keep researching
        DROP = "drop"
        BUILD = "build"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="opportunities")
    title = models.CharField(max_length=200)  # short name for lists and pickers
    hypothesis = models.TextField()  # one sentence: who, what pain, what they pay for
    why_now = models.TextField(blank=True)
    next_action = models.CharField(max_length=500, blank=True)
    decide_by = models.DateField(null=True, blank=True)
    decision = models.CharField(max_length=10, choices=Decision.choices, default=Decision.OPEN)
    decided_at = models.DateTimeField(null=True, blank=True)  # last change to keep/drop/build
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "opportunities"
        indexes = [models.Index(fields=["user", "decision"]), models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return f"{self.title} ({self.decision})"


class Evidence(models.Model):
    """One piece of evidence for or against an opportunity.

    It points at an inbox entry, an Item or a Note, or it is a free record: a real conversation
    (The Mom Test) or an external link (later: a morning-brief story, step 6). `title` is a snapshot so the
    evidence stays readable when the linked row goes away.
    """

    class Kind(models.TextChoices):
        INBOX = "inbox"
        ITEM = "item"
        NOTE = "note"
        CONVERSATION = "conversation"
        LINK = "link"

    class Stance(models.TextChoices):
        SUPPORTS = "supports"
        CONTRADICTS = "contradicts"

    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="evidence")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    stance = models.CharField(max_length=20, choices=Stance.choices)
    inbox_entry = models.ForeignKey(
        InboxEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence"
    )
    item = models.ForeignKey(Item, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence")
    library_note = models.ForeignKey(
        Note, on_delete=models.SET_NULL, null=True, blank=True, related_name="evidence"
    )
    title = models.CharField(max_length=300)
    url = models.URLField(max_length=2000, blank=True)
    note = models.TextField(blank=True)  # what it shows; for a conversation, what was said
    date = models.DateField(default=timezone.localdate)  # when it happened (Europe/Prague)
    created_at = models.DateTimeField(auto_now_add=True)  # when it was recorded: drives "stale"
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "evidence"
        indexes = [models.Index(fields=["created_at"])]
        constraints = [
            # A link only goes with its own kind (a link may become null when its row is deleted).
            models.CheckConstraint(
                condition=models.Q(inbox_entry__isnull=True) | models.Q(kind="inbox"),
                name="evidence_inbox_kind",
            ),
            models.CheckConstraint(
                condition=models.Q(item__isnull=True) | models.Q(kind="item"), name="evidence_item_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(library_note__isnull=True) | models.Q(kind="note"),
                name="evidence_note_kind",
            ),
            models.UniqueConstraint(
                fields=["opportunity", "inbox_entry"],
                condition=models.Q(inbox_entry__isnull=False),
                name="uniq_evidence_inbox_entry",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.stance}: {self.title}"


class ScoreSnapshot(models.Model):
    """The four self-scores (1-10) at one moment; append-only, the newest row is the current score."""

    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="scores")
    opportunity_score = models.PositiveSmallIntegerField()
    pain = models.PositiveSmallIntegerField()
    feasibility = models.PositiveSmallIntegerField()
    timing = models.PositiveSmallIntegerField()
    note = models.TextField(blank=True)  # why the scores changed
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(opportunity_score__gte=1, opportunity_score__lte=10)
                & models.Q(pain__gte=1, pain__lte=10)
                & models.Q(feasibility__gte=1, feasibility__lte=10)
                & models.Q(timing__gte=1, timing__lte=10),
                name="opportunity_scores_1_10",
            )
        ]

    def __str__(self) -> str:
        return f"{self.opportunity_score}/{self.pain}/{self.feasibility}/{self.timing}"
