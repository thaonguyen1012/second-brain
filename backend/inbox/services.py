from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from core.services import jobs
from inbox import tagging
from inbox.models import InboxEntry

TRIAGE_FIELDS = ("status", "item")


def add_entry(user: User, url: str, text: str) -> InboxEntry:
    """Store the capture and return at once; unfurl and tagging run later in `run_jobs`."""
    with transaction.atomic():
        entry = InboxEntry.objects.create(user=user, url=url, text=text)
        if url:
            jobs.enqueue("unfurl", f"unfurl:{entry.pk}", {"entry_id": entry.pk})  # then tags
        else:
            tagging.enqueue(entry)
    return entry


def set_status(entry: InboxEntry, status: str) -> None:
    """`archived_at` marks when the entry became archived (the week review's body of work); it stays while the
    entry remains archived and is cleared when it leaves the archive. Does not save."""
    if status == InboxEntry.Status.ARCHIVED:
        if entry.status != InboxEntry.Status.ARCHIVED or entry.archived_at is None:
            entry.archived_at = timezone.now()
    else:
        entry.archived_at = None
    entry.status = status


def triage_entry(entry: InboxEntry, changes: dict[str, object]) -> InboxEntry:
    """Apply the weekly-review decision (status, linked Item); only TRIAGE_FIELDS can change."""
    fields = [f for f in TRIAGE_FIELDS if f in changes]
    if "item" in changes:
        entry.item = changes["item"]  # type: ignore[assignment]  # an owned Item or None (serializer)
    if "status" in changes:
        set_status(entry, str(changes["status"]))
        fields.append("archived_at")
    entry.save(update_fields=[*fields, "updated_at"])
    return entry
