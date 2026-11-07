from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from core.services import jobs, thumbnails
from core.services.search import normalize_query
from inbox import tagging
from inbox.models import InboxEntry
from library import services as library
from library.models import Item

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


def entries(user: User, status: str | None = None, query: str = "") -> QuerySet[InboxEntry]:
    """The owner's entries with their linked Item; `query` matches the OG title, the text or the URL
    (case-insensitive substring)."""
    rows = InboxEntry.objects.filter(user=user).select_related("item")
    if status:
        rows = rows.filter(status=status)
    if query := normalize_query(query):
        rows = rows.filter(Q(og_title__icontains=query) | Q(text__icontains=query) | Q(url__icontains=query))
    return rows


def delete_entry(entry: InboxEntry) -> None:
    """Evidence made from the entry keeps its title snapshot (link set to null); pending unfurl and tag jobs
    find nothing and stop. The thumbnail file goes too, after the commit, unless another entry or an Item
    still uses the same file."""
    image = entry.og_image_path
    with transaction.atomic():
        entry.delete()
        transaction.on_commit(lambda: thumbnails.discard_if_unused(image))


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
    """Apply the weekly-review decision (status, linked Item); only TRIAGE_FIELDS can change. Linking an Item
    that has no image gives it a copy of the entry's thumbnail (no network; an image is never replaced),
    except a project: a page's OG image is a banner, not a logo (the rule of library.fetch_automatically)."""
    fields = [f for f in TRIAGE_FIELDS if f in changes]
    if "item" in changes:
        entry.item = changes["item"]  # type: ignore[assignment]  # an owned Item or None (serializer)
    if "status" in changes:
        set_status(entry, str(changes["status"]))
        fields.append("archived_at")
    entry.save(update_fields=[*fields, "updated_at"])
    item = entry.item if "item" in changes else None
    if item is not None and not item.image_path and item.type != Item.Type.PROJECT:
        library.image_from_thumbnail(item.pk, entry.og_image_path)
    return entry
