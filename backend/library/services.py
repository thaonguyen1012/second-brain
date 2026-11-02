"""Library: Items and Notes (DECISIONS 4.1). Note bodies are private: they are never sent to an LLM."""

from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, ProtectedError, Q, QuerySet

from core.services.search import normalize_query
from library.models import Item, Note

MAX_TAGS = 30
NOTE_FIELDS = ("title", "markdown")


def normalize_tags(tags: Iterable[str]) -> list[str]:
    """Lowercase, single spaces, no duplicates, order kept."""
    result: list[str] = []
    for tag in tags:
        clean = " ".join(tag.lower().split())[:50]
        if clean and clean not in result:
            result.append(clean)
    return result[:MAX_TAGS]


class ItemInUse(Exception):
    """The Item is a project with recorded time; its time entries must go first (no silent loss of hours)."""


def items(user: User, query: str = "") -> QuerySet[Item]:
    """The owner's Items with `note_count`; `query` matches title or source (case-insensitive substring) or
    is exactly one of the tags."""
    rows = Item.objects.filter(user=user).annotate(note_count=Count("notes", distinct=True))
    if query := normalize_query(query):
        rows = rows.filter(
            Q(title__icontains=query) | Q(source__icontains=query) | Q(tags__contains=[query.lower()])
        )
    return rows


def delete_item(item: Item) -> None:
    """Links to the Item go with it: inbox entries, evidence and achievements keep their row (link set to
    null, evidence keeps its title snapshot), notes lose the link, project details go too. A project with time
    entries is refused (TimeEntry.project is PROTECT)."""
    try:
        with transaction.atomic():
            item.delete()
    except ProtectedError as error:
        raise ItemInUse from error


def notes(user: User, query: str = "", item: int | None = None) -> QuerySet[Note]:
    """The owner's notes; `query` matches title or markdown (case-insensitive), `item` a linked Item id."""
    rows = Note.objects.filter(user=user)
    if query := query.strip():
        rows = rows.filter(Q(title__icontains=query) | Q(markdown__icontains=query))
    if item is not None:
        rows = rows.filter(items__id=item)
    return rows


def save_note(note: Note, data: dict[str, Any]) -> Note:
    """Create (unsaved `note`) or update; `items` (owner checked by the serializer) replaces the links."""
    for field in NOTE_FIELDS:
        if field in data:
            setattr(note, field, data[field])
    with transaction.atomic():
        note.save()
        if "items" in data:
            note.items.set(data["items"])
    return note
