from django.contrib.auth.models import User
from django.db import transaction

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


def triage_entry(entry: InboxEntry, changes: dict[str, object]) -> InboxEntry:
    """Apply the weekly-review decision (status, linked Item); only TRIAGE_FIELDS can change."""
    fields = [f for f in TRIAGE_FIELDS if f in changes]
    for field in fields:
        setattr(entry, field, changes[field])
    entry.save(update_fields=[*fields, "updated_at"])
    return entry
