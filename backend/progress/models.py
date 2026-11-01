from django.conf import settings
from django.db import models


class PageProgress(models.Model):
    """One row per page the owner ever marked; done=False keeps the history of un-marking."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="page_progress")
    book = models.SlugField(max_length=100)
    page = models.CharField(max_length=500, blank=True)  # "" is the book's index page
    done = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "book", "page"], name="uniq_page_progress")]
        indexes = [models.Index(fields=["user", "done"])]

    def __str__(self) -> str:
        return f"{self.book}/{self.page} done={self.done}"


class LastVisited(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="last_visited"
    )
    book = models.SlugField(max_length=100)
    page = models.CharField(max_length=500, blank=True)
    title = models.CharField(max_length=300, blank=True)
    at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.book}/{self.page}"
