from django.conf import settings
from django.db import models

from library.models import Item, tag_field


class InboxEntry(models.Model):
    """One captured link or text (DECISIONS 4.3, 9.2). The only place that may be messy.

    processed=False until the background jobs have unfurled the link and the LLM has tagged it;
    `error` says why an entry is still unprocessed.
    """

    class Status(models.TextChoices):  # weekly triage: Inbox -> Later -> Archive
        INBOX = "inbox"
        LATER = "later"
        ARCHIVED = "archived"

    class Destination(models.TextChoices):  # DECISIONS 9.2
        READ_LATER = "read_later"
        BOOK = "book"
        OPPORTUNITY = "opportunity"  # evidence for an opportunity
        NOTE = "note"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="inbox")
    url = models.URLField(max_length=2000, blank=True)
    text = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.INBOX)
    item = models.ForeignKey(
        Item, on_delete=models.SET_NULL, null=True, blank=True, related_name="inbox_entries"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    archived_at = models.DateTimeField(null=True, blank=True)  # set on triage to archived (services.py)
    processed = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=500, blank=True)

    # OpenGraph unfurl (DECISIONS 10.7); og_image_path is a file name under THUMBS_DIR.
    og_title = models.CharField(max_length=500, blank=True)
    og_description = models.TextField(blank=True)
    og_site_name = models.CharField(max_length=200, blank=True)
    og_image_path = models.CharField(max_length=100, blank=True)
    unfurled_at = models.DateTimeField(null=True, blank=True)

    # LLM suggestions (DECISIONS 9.2); Alex decides.
    suggested_tags = tag_field()
    summary = models.CharField(max_length=160, blank=True)
    suggested_destination = models.CharField(max_length=20, choices=Destination.choices, blank=True)

    class Meta:
        verbose_name_plural = "inbox entries"
        indexes = [models.Index(fields=["created_at"]), models.Index(fields=["status", "created_at"])]
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(url="") | ~models.Q(text=""), name="inbox_entry_url_or_text"
            )
        ]

    def __str__(self) -> str:
        return self.og_title or self.url or self.text[:60]
