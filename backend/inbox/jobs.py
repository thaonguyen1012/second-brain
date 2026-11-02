"""Background jobs for inbox entries (run by `manage.py run_jobs`, never inside a request)."""

import logging
from typing import Any

from django.utils import timezone

from core.services import jobs, safe_fetch, thumbnails, unfurl
from inbox import tagging
from inbox.models import InboxEntry

logger = logging.getLogger(__name__)


@jobs.handler("unfurl")
def unfurl_entry(payload: dict[str, Any]) -> None:
    entry = InboxEntry.objects.filter(pk=payload["entry_id"]).first()
    if entry is None or not entry.url:
        return
    try:
        card = unfurl.unfurl(entry.url)
    except safe_fetch.FetchBlocked as exc:
        logger.warning("unfurl refused", extra={"entry": entry.pk, "reason": str(exc)})
        entry.error = f"unfurl refused: {exc}"[:500]
        entry.unfurled_at = timezone.now()  # final: the entry is tagged from its URL and text only
        entry.save(update_fields=["error", "unfurled_at", "updated_at"])
        tagging.enqueue(entry)
        return
    except safe_fetch.FetchError as exc:
        entry.error = f"unfurl failed: {exc}"[:500]
        entry.save(update_fields=["error", "updated_at"])
        raise  # transient: the job runner retries
    entry.og_title, entry.og_description, entry.og_site_name = card.title, card.description, card.site_name
    entry.og_image_path = _thumbnail(entry, card.image_url)
    entry.unfurled_at, entry.error = timezone.now(), ""
    entry.save(
        update_fields=[
            "og_title",
            "og_description",
            "og_site_name",
            "og_image_path",
            "unfurled_at",
            "error",
            "updated_at",
        ]
    )
    tagging.enqueue(entry)


def _thumbnail(entry: InboxEntry, image_url: str) -> str:
    """A missing or broken image never fails the unfurl."""
    if not image_url:
        return ""
    try:
        image = safe_fetch.fetch(image_url, safe_fetch.IMAGE_TYPES)
        return thumbnails.store(thumbnails.to_webp(image.body))
    except (safe_fetch.FetchError, thumbnails.ThumbnailError) as exc:
        logger.info("no thumbnail", extra={"entry": entry.pk, "reason": str(exc)})
        return ""
