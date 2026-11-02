"""Library: Items and Notes (DECISIONS 4.1). Note bodies are private: they are never sent to an LLM."""

from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, QuerySet

from library.models import Note

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
