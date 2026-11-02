from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.utils import timezone

from library.models import Item, Note


class Freshness(models.TextChoices):
    """Computed from the newest evidence date (services.py), never typed (DECISIONS 9.1, 9.2)."""

    FRESH = "fresh"  # evidence in the last 3 months
    AGING = "aging"  # newest evidence 3-6 months old
    FADED = "faded"  # no evidence in 6 months, or none at all


class Skill(models.Model):
    """One row of the portable skills matrix (DECISIONS 6.5). No self-rating: only dated evidence.

    `key` is the normalised name (services.normalize_skill); `aliases` are normalised too and let market skill
    names match without a fuzzy-matching framework (DECISIONS 4.5).
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="skills")
    name = models.CharField(max_length=60)
    key = models.CharField(max_length=60)
    aliases = ArrayField(models.CharField(max_length=60), default=list, blank=True)
    note = models.TextField(blank=True)  # what the skill covers, why it matters
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]
        constraints = [models.UniqueConstraint(fields=["user", "key"], name="uniq_skill_key")]

    def __str__(self) -> str:
        return self.name


class SkillEvidence(models.Model):
    """Something anyone can check (DECISIONS 6.5): a library Item (a shipped work project is an Item of type
    project), a Note (an article, a case study draft) or an external link. `date` is when it happened; the
    freshness of the skill follows it. `title` is a snapshot so the evidence stays readable."""

    class Kind(models.TextChoices):
        ITEM = "item"
        NOTE = "note"
        LINK = "link"

    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="evidence")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    item = models.ForeignKey(
        Item, on_delete=models.SET_NULL, null=True, blank=True, related_name="skill_evidence"
    )
    library_note = models.ForeignKey(
        Note, on_delete=models.SET_NULL, null=True, blank=True, related_name="skill_evidence"
    )
    title = models.CharField(max_length=300)
    url = models.URLField(max_length=2000, blank=True)
    note = models.TextField(blank=True)
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "skill evidence"
        indexes = [models.Index(fields=["skill", "date"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(item__isnull=True) | models.Q(kind="item"), name="skill_evidence_item_kind"
            ),
            models.CheckConstraint(
                condition=models.Q(library_note__isnull=True) | models.Q(kind="note"),
                name="skill_evidence_note_kind",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.date}: {self.title}"


class JobAd(models.Model):
    """A job description pasted for the monthly market mirror (DECISIONS 9.2, 9.5).

    `skills` and `seniority` come from the `jd_skills` background job (extraction.py); `processed` is False
    until it succeeds, `error` keeps the reason of a fallback. Alex may correct `skills` by hand.
    """

    class Seniority(models.TextChoices):
        JUNIOR = "junior"
        MID = "mid"
        SENIOR = "senior"
        LEAD = "lead"
        UNKNOWN = "unknown"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_ads")
    title = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True)
    url = models.URLField(max_length=2000, blank=True)
    text = models.TextField()
    month = models.DateField()  # first day of the month the ad was collected for
    skills = ArrayField(models.CharField(max_length=60), default=list, blank=True)
    seniority = models.CharField(max_length=10, choices=Seniority.choices, blank=True)
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["user", "month"]), models.Index(fields=["created_at"])]
        constraints = [
            models.CheckConstraint(condition=models.Q(month__day=1), name="job_ad_month_first_day")
        ]

    def __str__(self) -> str:
        return f"{self.title} @ {self.company} ({self.month:%Y-%m})"


class Achievement(models.Model):
    """One line of the brag document (DECISIONS 4.8, 6.5), written every week: what was done and its impact
    in numbers, linked to the project Item and the skills it proves. The week review shows the week's rows."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="achievements")
    date = models.DateField(default=timezone.localdate)  # when it happened (Europe/Prague)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    impact = models.TextField(blank=True)  # the result with numbers: "checkout time 40 s -> 12 s"
    project = models.ForeignKey(
        Item,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="achievements",
        limit_choices_to={"type": Item.Type.PROJECT},
    )
    skills = models.ManyToManyField(Skill, related_name="achievements", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["user", "date"]), models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return f"{self.date}: {self.title}"


class Prediction(models.Model):
    """A dated prediction to re-score later (DECISIONS 4.8, 6.2): "write predictions, score them again after
    6 months". `check_on` defaults to `made_on` + 6 months (services.py); `scored_at` is set when the outcome
    leaves `open` and cleared when it goes back."""

    class Outcome(models.TextChoices):
        OPEN = "open"  # not scored yet
        RIGHT = "right"
        WRONG = "wrong"
        PARTIAL = "partial"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="predictions")
    statement = models.TextField()
    made_on = models.DateField(default=timezone.localdate)
    check_on = models.DateField()
    confidence = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-10, how sure when made
    outcome = models.CharField(max_length=10, choices=Outcome.choices, default=Outcome.OPEN)
    note = models.TextField(blank=True)  # why it went right or wrong
    scored_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["user", "outcome", "check_on"]), models.Index(fields=["created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(confidence__isnull=True) | models.Q(confidence__gte=1, confidence__lte=10),
                name="prediction_confidence_1_10",
            ),
            models.CheckConstraint(
                condition=models.Q(check_on__gte=models.F("made_on")), name="prediction_check_after_made"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.made_on}: {self.statement[:60]} ({self.outcome})"
