"""Library: Items and Notes (DECISIONS 4.1). Note bodies are private: they are never sent to an LLM."""

import re
from collections.abc import Iterable
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, ProtectedError, Q, QuerySet

from core.services.search import normalize_query
from library.models import Item, Note

MAX_TAGS = 30
NOTE_FIELDS = ("title", "markdown")
EXCERPT_CHARS = 120
EXCERPT_BEFORE = 40
_MARKS = re.compile(r"[#>*_`~\[\]]+")
_LINE_PREFIX = re.compile(r"^\s*(#{1,6}\s+|>\s*|[-*+]\s+)")


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


def note_label(note: Note) -> str:
    """The title, else the first non-empty markdown line without its heading/quote/list mark (as the web's
    noteTitle), else ""."""
    if title := note.title.strip():
        return title
    for line in note.markdown.split("\n"):
        if clean := _LINE_PREFIX.sub("", line).strip():
            return clean[:EXCERPT_CHARS]
    return ""


def note_excerpt(markdown: str, query: str) -> str:
    """About EXCERPT_CHARS characters around the first match of `query` (markdown marks dropped), else the
    start of the note."""
    flat = " ".join(_MARKS.sub(" ", markdown).split())
    at = flat.lower().find(query.lower()) if query else -1
    if at < 0:
        return flat[:EXCERPT_CHARS]
    start = max(0, at - EXCERPT_BEFORE)
    return ("…" if start > 0 else "") + flat[start : start + EXCERPT_CHARS]


def search_notes(user: User, query: str, limit: int) -> list[dict[str, Any]]:
    """Cmd+K hits: newest matching notes as label + excerpt, so the browser never downloads whole bodies.
    Note bodies stay on the server (and are never sent to an LLM)."""
    if not (query := normalize_query(query)):
        return []
    rows = notes(user, query).only("id", "title", "markdown", "updated_at").order_by("-created_at", "-id")
    return [
        {
            "id": n.pk,
            "title": note_label(n),
            "excerpt": note_excerpt(n.markdown, query),
            "updatedAt": n.updated_at,
        }
        for n in rows[:limit]
    ]


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
