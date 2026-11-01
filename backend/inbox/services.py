from django.contrib.auth.models import User

from inbox.models import InboxEntry

TRIAGE_FIELDS = ("status", "item")


def add_entry(user: User, url: str, text: str) -> InboxEntry:
    """Store the capture and return at once; unfurl and tagging run later in `run_jobs`."""
    return InboxEntry.objects.create(user=user, url=url, text=text)


def triage_entry(entry: InboxEntry, changes: dict[str, object]) -> InboxEntry:
    """Apply the weekly-review decision (status, linked Item); only TRIAGE_FIELDS can change."""
    fields = [f for f in TRIAGE_FIELDS if f in changes]
    for field in fields:
        setattr(entry, field, changes[field])
    entry.save(update_fields=[*fields, "updated_at"])
    return entry
