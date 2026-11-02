from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Area(models.TextChoices):
    """The areas of DECISIONS 6.2 a feed belongs to."""

    AI = "ai"  # 1. applied AI
    BUSINESS = "business"  # 2. business and practical economics
    PSYCHOLOGY = "psychology"  # 3. behaviour, communication, negotiation, writing
    GEOPOLITICS = "geopolitics"  # 4. history, geography, geopolitics
    SCIENCE = "science"  # 5. science and data about the world
    HEALTH = "health"  # 6. health, sleep, exercise


class Source(models.Model):
    """A curated RSS or Atom feed (DECISIONS 5, 6.2). Added in the admin or with `manage.py brief_sources`."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="news_sources")
    name = models.CharField(max_length=100)
    feed_url = models.URLField(max_length=2000)
    area = models.CharField(max_length=20, choices=Area.choices)
    active = models.BooleanField(default=True)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]
        constraints = [models.UniqueConstraint(fields=["user", "feed_url"], name="uniq_source_feed_url")]

    def __str__(self) -> str:
        return self.name


class NewsItem(models.Model):
    """One feed entry. `dedupe_key` = sha256 of the normalised title and URL, checked before any LLM call
    (DECISIONS 10.4). `excerpt` is plain text (nh3), at most 500 characters: exactly what the LLM sees.

    The LLM fields come from the `news_tag` job (tagging.py); `tag_status` says whether it ran: `skipped`
    when the daily cap (BRIEF_TAG_DAILY_CAP) was reached, `failed` when the reply was invalid (`error`).
    """

    class TagStatus(models.TextChoices):
        QUEUED = "queued"
        TAGGED = "tagged"
        FAILED = "failed"
        SKIPPED = "skipped"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="news_items")
    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=500)
    url = models.URLField(max_length=2000)
    published = models.DateTimeField(null=True, blank=True)
    excerpt = models.CharField(max_length=500, blank=True)
    dedupe_key = models.CharField(max_length=64)
    tags = ArrayField(models.CharField(max_length=40), default=list, blank=True)
    summary = models.CharField(max_length=160, blank=True)
    new_tool = models.BooleanField(default=False)  # "new tool/skill": feeds the market mirror (9.2)
    relevance = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-5
    tag_status = models.CharField(max_length=10, choices=TagStatus.choices, default=TagStatus.QUEUED)
    tagged_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)  # when it was fetched
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "tag_status"]),
            models.Index(fields=["created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["user", "dedupe_key"], name="uniq_news_dedupe_key"),
            models.CheckConstraint(
                condition=models.Q(relevance__isnull=True) | models.Q(relevance__gte=1, relevance__lte=5),
                name="news_relevance_1_5",
            ),
        ]

    def __str__(self) -> str:
        return self.title


class DailyBrief(models.Model):
    """The morning brief of one day (Europe/Prague), built by the `brief` job at BRIEF_BUILD_TIME from the
    most relevant tagged items not shown in an earlier brief. `intro` is written by one LLM call per day;
    empty (with `error`) when that call failed."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="briefs")
    date = models.DateField()
    intro = models.CharField(max_length=600, blank=True)
    error = models.CharField(max_length=500, blank=True)
    items = models.ManyToManyField(NewsItem, through="BriefEntry", related_name="briefs")
    generated_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]
        constraints = [models.UniqueConstraint(fields=["user", "date"], name="uniq_brief_date")]

    def __str__(self) -> str:
        return f"brief {self.date}"


class BriefEntry(models.Model):
    brief = models.ForeignKey(DailyBrief, on_delete=models.CASCADE, related_name="entries")
    news_item = models.ForeignKey(NewsItem, on_delete=models.CASCADE, related_name="brief_entries")
    position = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["position"]
        verbose_name_plural = "brief entries"
        constraints = [
            models.UniqueConstraint(fields=["brief", "news_item"], name="uniq_brief_entry"),
        ]

    def __str__(self) -> str:
        return f"{self.brief.date} #{self.position}"
