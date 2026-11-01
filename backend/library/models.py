from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def tag_field() -> ArrayField[list[str], list[str]]:
    """Tags are plain lowercase strings on the row (DECISIONS 4.5: no tag framework)."""
    return ArrayField(models.CharField(max_length=50), default=list, blank=True)


class Item(models.Model):
    """Anything Alex learns from or works on (DECISIONS 4.1); status replaces folders."""

    class Type(models.TextChoices):
        COURSE = "course"
        BOOK = "book"
        FILM = "film"
        ARTICLE = "article"
        PROJECT = "project"

    class Status(models.TextChoices):
        PLANNED = "planned"  # want to read / watch / take
        ACTIVE = "active"
        DONE = "done"
        DROPPED = "dropped"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="items")
    type = models.CharField(max_length=20, choices=Type.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    title = models.CharField(max_length=300)
    tags = tag_field()
    source = models.CharField(max_length=2000, blank=True)  # URL or free text (author, platform...)
    rating = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["type", "status"]), models.Index(fields=["created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=10),
                name="item_rating_1_10",
            )
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.type}, {self.status})"


class Note(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
    title = models.CharField(max_length=300, blank=True)
    markdown = models.TextField()
    items = models.ManyToManyField(Item, related_name="notes", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["created_at"])]

    def __str__(self) -> str:
        return self.title or self.markdown[:60]
