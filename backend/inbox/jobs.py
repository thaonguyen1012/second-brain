"""Background jobs for inbox entries (run by `manage.py run_jobs`, never inside a request)."""

import logging
from typing import Any

from django.db import transaction
from django.utils import timezone

from core.services import jobs, safe_fetch, thumbnails, unfurl
from inbox import tagging
from inbox.models import InboxEntry
from library import services as library
from library.models import Item

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
        if _save(entry, "error", "unfurled_at"):
            tagging.enqueue(entry)
        return
    except safe_fetch.FetchError as exc:
        entry.error = f"unfurl failed: {exc}"[:500]
        if _save(entry, "error"):
            raise  # transient: the job runner retries
        return
    entry.og_title, entry.og_description, entry.og_site_name = card.title, card.description, card.site_name
    entry.og_image_path, webp = _thumbnail(entry, card.image_url)
    entry.unfurled_at, entry.error = timezone.now(), ""
    with transaction.atomic():
        thumbnails.claim(entry.og_image_path, webp)
        saved = _save(
            entry, "og_title", "og_description", "og_site_name", "og_image_path", "unfurled_at", "error"
        )
    if not saved:
        # deleted while the page or image was fetched: the new file may have no row to refer to it
        thumbnails.discard_if_unused(entry.og_image_path)
        return
    tagging.enqueue(entry)
    if entry.og_image_path:
        # linked to an Item before the unfurl finished: that Item gets the thumbnail as a link does (never a
        # project or a tool: a page's OG image is a banner, not a logo)
        linked = (
            Item.objects.filter(inbox_entries=entry.pk, image_path="")
            .exclude(type__in=library.LOGO_TYPES)
            .values_list("pk", flat=True)
        )
        if (item_id := linked.first()) is not None:
            library.image_from_thumbnail(item_id, entry.og_image_path)


def _save(entry: InboxEntry, *fields: str) -> bool:
    """Write the fields if the entry still exists. The fetches can take seconds and the owner may delete the
    entry meanwhile (DELETE /api/inbox/{id}); a plain save(update_fields=...) would then raise and count a
    failed attempt."""
    values = {f: getattr(entry, f) for f in fields}
    return InboxEntry.objects.filter(pk=entry.pk).update(**values, updated_at=timezone.now()) > 0


def _thumbnail(entry: InboxEntry, image_url: str) -> tuple[str, bytes]:
    """The stored file name and its bytes ("" and b"" without one). A missing or broken image never fails
    the unfurl."""
    if not image_url:
        return "", b""
    try:
        image = safe_fetch.fetch(image_url, safe_fetch.IMAGE_TYPES)
        webp = thumbnails.to_webp(image.body)
        return thumbnails.store(webp), webp
    except (safe_fetch.FetchError, thumbnails.ThumbnailError) as exc:
        logger.info("no thumbnail", extra={"entry": entry.pk, "reason": str(exc)})
        return "", b""
