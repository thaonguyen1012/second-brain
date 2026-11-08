"""Library: Items and Notes (DECISIONS 4.1). Note bodies are private: they are never sent to an LLM.

Item images (DECISIONS 9.6): one webp per Item in THUMBS_DIR (core/services/thumbnails.py), from an upload,
from the link (the `item_image` job in library/jobs.py, run by run_jobs) or copied from a linked inbox
entry's thumbnail. Every change goes through set_image; any change but the job's own ends the Item's fetch.
"""

import datetime as dt
import re
from collections.abc import Container, Iterable
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import URLValidator
from django.db import transaction
from django.db.models import CharField, Count, Exists, OuterRef, ProtectedError, Q, QuerySet, Value
from django.db.models.functions import Concat
from django.utils import timezone

from core.models import Job
from core.services import jobs, thumbnails
from core.services.search import normalize_query
from library.links import sync_links
from library.models import Item, Note

MAX_TAGS = 30
IMAGE_JOB = "item_image"  # one job per Item, key item_image:<pk>
# The `expect` of a running fetch that a later image change ended (_end_fetch): no stored image has this
# name, so neither the job nor a retry of it can set its image.
ENDED_FETCH = "ended"
_HTTP_URL = URLValidator(schemes=["http", "https"])
# Item fields an API write may set (POST/PATCH /api/items; /api/projects sends a subset).
ITEM_FIELDS = ("type", "status", "title", "tags", "source", "rating", "started_at", "finished_at")
NOTE_FIELDS = ("title", "markdown")
EXCERPT_CHARS = 120
EXCERPT_BEFORE = 40
# A line's heading, quote, list and task marks (`## `, `> `, `- `, `1. `, `- [ ] `), nested ones too
_LINE_PREFIX = re.compile(
    r"^[ \t]*(?:(?:>|(?:[-*+]|\d{1,9}[.)]|#{1,6})(?=[ \t]))[ \t]*)*(?:\[[ xX]\][ \t]+)?", re.MULTILINE
)
# A link or image shows its text (the editor's `[[ ]]` links): `[Atomic Habits](/thu-vien/item/?id=12)` ->
# `Atomic Habits`. The text may hold escaped brackets (`[\[RC\] Book](...)`, as the editor writes them); no
# bracket, parenthesis or line break otherwise, so every match attempt stops at the next one (linear).
_LINK = re.compile(r"!?\[((?:\\.|[^\\\[\]\n])*)\]\([^()\n]*\)")
# A backslash escape shows its character (CommonMark escapes ASCII punctuation: `\[`, `\*`, `\_`)
_ESCAPE = re.compile(r"\\([!-/:-@\[-`{-~])")
# Inline marks an excerpt leaves out, escapes shown by their character; `_` inside a word (file_name) is
# no mark
_MARKS = re.compile(r"\\([!-/:-@\[-`{-~])|[*`~]+|(?<!_)(?<![^\W_])_+|(?<=[^\W_])_+(?!_)(?![^\W_])")
# The editor's (Milkdown's) placeholder for an empty paragraph or list item: no text
_EMPTY_LINE = re.compile(r"<br\s*/?>", re.IGNORECASE)


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


class ImageTooLarge(ValueError):
    """An upload over settings.ITEM_IMAGE_MAX_BYTES (refused before its bytes are read)."""


def items(user: User, query: str = "") -> QuerySet[Item]:
    """The owner's Items with `note_count` and `image_pending` (an image job waits or runs for the Item),
    both in the list's one query; `query` matches title or source (case-insensitive substring) or is exactly
    one of the tags."""
    image_job = Job.objects.filter(
        key=Concat(Value(f"{IMAGE_JOB}:"), OuterRef("pk"), output_field=CharField()),
        status__in=(Job.Status.PENDING, Job.Status.RUNNING),
    )
    rows = Item.objects.filter(user=user).annotate(
        note_count=Count("notes", distinct=True), image_pending=Exists(image_job)
    )
    if query := normalize_query(query):
        rows = rows.filter(
            Q(title__icontains=query) | Q(source__icontains=query) | Q(tags__contains=[query.lower()])
        )
    return rows


def apply_status_dates(item: Item, previous: str | None, explicit: Container[str] = ()) -> list[str]:
    """Move the start and finish dates with a status change, so Items finished anywhere (Thư viện, the Dự án
    board) reach the week review, which reads finished_at. `previous` is the status before the write (None for
    a new Item); `item.status` is the new one.

    * active: started_at = now when it is empty; finished_at cleared;
    * done: finished_at = now when it is empty (started_at unchanged, it may stay empty);
    * planned: both cleared;
    * dropped: finished_at cleared (started_at unchanged).

    No status change leaves both dates alone, and a date named in `explicit` (sent by the client in the same
    request) wins over the rule. Sets the fields on `item` without saving; returns the names it changed. Every
    API write of an Item's status goes through here (create_item and update_item below).
    """
    if item.status == previous:
        return []
    now = timezone.now()
    rule: dict[str, dt.datetime | None] = {}
    if item.status == Item.Status.ACTIVE:
        rule = {"started_at": item.started_at or now, "finished_at": None}
    elif item.status == Item.Status.DONE:
        rule = {"finished_at": item.finished_at or now}
    elif item.status == Item.Status.PLANNED:
        rule = {"started_at": None, "finished_at": None}
    elif item.status == Item.Status.DROPPED:
        rule = {"finished_at": None}
    changed = []
    for field, value in rule.items():
        if field not in explicit and getattr(item, field) != value:
            setattr(item, field, value)
            changed.append(field)
    return changed


def create_item(user: User, data: dict[str, Any]) -> Item:
    """A new Item from validated ITEM_FIELDS; its status sets the dates (apply_status_dates) and an http(s)
    source queues its image (fetch_automatically)."""
    item = Item(user=user, **{f: data[f] for f in ITEM_FIELDS if f in data})
    apply_status_dates(item, None, data)
    with transaction.atomic():
        item.save()
        fetch_automatically(item)
    return item


def update_item(item: Item, data: dict[str, Any]) -> Item:
    """Write the ITEM_FIELDS present in `data` (a partial update); a status change moves the dates and a new
    source queues an image for an Item that has none (fetch_automatically)."""
    previous_status, previous_source = item.status, item.source
    fields = [f for f in ITEM_FIELDS if f in data]
    for field in fields:
        setattr(item, field, data[field])
    fields += apply_status_dates(item, previous_status, data)
    if fields:
        with transaction.atomic():
            item.save(update_fields=[*fields, "updated_at"])
            if item.source != previous_source:
                fetch_automatically(item)
    return item


def delete_item(item: Item) -> None:
    """Links to the Item go with it: inbox entries, evidence and achievements keep their row (link set to
    null, evidence keeps its title snapshot), notes lose the link, project details go too. A project with time
    entries is refused (TimeEntry.project is PROTECT). Its image file goes after the commit unless another row
    uses the same file."""
    try:
        with transaction.atomic():
            # locked like set_image does, so an image set at the same moment is the one discarded
            locked = Item.objects.select_for_update().filter(pk=item.pk)
            image = locked.values_list("image_path", flat=True).first() or ""
            item.delete()
            transaction.on_commit(lambda: thumbnails.discard_if_unused(image))
    except ProtectedError as error:
        raise ItemInUse from error


# --- Item images (DECISIONS 9.6) ----------------------------------------------------------------------------


def image_url(item: Item) -> str | None:
    """Where the browser loads the image. `v` (the start of the file name) changes with the image, so a
    replaced image is never taken from the browser's cache; it is not used to find the file."""
    return f"/api/items/{item.pk}/image?v={item.image_path[:8]}" if item.image_path else None


def set_image(item_id: int, name: str, expect: str | None = None, *, fetched: bool = False) -> bool:
    """Point the Item at the stored file `name` ("" removes the image); the file it replaces is discarded
    after the commit unless another row uses it. Callers: upload, remove (name ""), inbox links (expect ""),
    and the item_image job run by run_jobs (fetched=True).

    With `expect`, the change happens only while the Item's image is still `expect`: an inbox link passes "",
    so only an Item without an image takes the thumbnail. Returns False when the Item is gone or its image is
    not `expect`; `name` is then discarded unless another row uses it.

    A fetch is a request made earlier, so every other change (upload, removal, inbox link) ends the Item's
    fetch in the same transaction (_end_fetch): the newer change always wins, also when the image is back to
    what the fetch expects (an inbox copy removed again is "" once more, which comparing names alone would
    miss). The job's own call applies only while its fetch has not been ended since the job started.
    """
    with transaction.atomic():
        locked = Item.objects.select_for_update().filter(pk=item_id)
        current = locked.values_list("image_path", flat=True).first()
        moved = expect is not None and current != expect
        if current is None or moved or (fetched and _fetch_ended(item_id, expect)):
            transaction.on_commit(lambda: thumbnails.discard_if_unused(name))
            return False
        if not fetched:
            _end_fetch(item_id)
        if current != name:
            replaced: str = current
            locked.update(image_path=name, updated_at=timezone.now())
            transaction.on_commit(lambda: thumbnails.discard_if_unused(replaced))
    return True


def _image_job(item_id: int) -> QuerySet[Job]:
    return Job.objects.filter(key=f"{IMAGE_JOB}:{item_id}")


def _end_fetch(item_id: int) -> None:
    """End the Item's fetch (inside set_image, under the Item's row lock): a waiting job is marked done, so
    imagePending turns false at once and it never runs; a running one cannot be stopped, so its expect becomes
    ENDED_FETCH, which no image has: neither it nor a retry after a network error sets an image. A later fetch
    request arms the job again with a fresh expect (request_fetch). The job row is locked too, so run_jobs
    cannot claim it halfway."""
    live = (Job.Status.PENDING, Job.Status.RUNNING)
    job = _image_job(item_id).select_for_update().filter(status__in=live).first()
    if job is None:
        return
    rows, now = Job.objects.filter(pk=job.pk), timezone.now()
    if job.status == Job.Status.PENDING:
        rows.update(status=Job.Status.DONE, last_error="", updated_at=now)
    elif job.payload.get("expect") != ENDED_FETCH:
        rows.update(payload={**job.payload, "expect": ENDED_FETCH}, updated_at=now)


def _fetch_ended(item_id: int, expect: str | None) -> bool:
    """Whether the running fetch that expects `expect` was ended since it started (its job no longer runs
    with that expect)."""
    running = _image_job(item_id).filter(status=Job.Status.RUNNING, payload__expect=expect)
    return not running.exists()


def upload_image(item: Item, upload: UploadedFile[bytes]) -> None:
    """The uploaded file as the Item's image, re-encoded (thumbnails.to_webp at ITEM_SIZES): Pillow reads the
    bytes, the content type the browser claims is ignored, EXIF (GPS) is dropped. Raises ImageTooLarge over
    ITEM_IMAGE_MAX_BYTES (checked before reading) and ThumbnailError for anything but a readable JPEG, PNG,
    GIF or WebP (SVG, HEIC, PDF, a decompression bomb)."""
    limit: int = settings.ITEM_IMAGE_MAX_BYTES
    if (upload.size or 0) > limit:
        raise ImageTooLarge
    data = upload.read(limit + 1)
    if len(data) > limit:
        raise ImageTooLarge
    set_image(item.pk, thumbnails.store(thumbnails.to_webp(data, thumbnails.ITEM_SIZES)))


def image_from_thumbnail(item_id: int, thumbnail: str) -> bool:
    """Give an Item without an image a copy of an inbox entry's thumbnail, re-encoded at ITEM_SIZES so the
    Item has its own, lighter file. No network. A missing or unreadable file leaves the Item without an
    image, and an image set meanwhile is never replaced (expect="")."""
    path = thumbnails.path_of(thumbnail)
    if path is None:
        return False
    try:
        name = thumbnails.store(thumbnails.to_webp(path.read_bytes(), thumbnails.ITEM_SIZES))
    except (OSError, thumbnails.ThumbnailError):
        return False
    return set_image(item_id, name, expect="")


def is_http_url(value: str) -> bool:
    try:
        _HTTP_URL(value)
    except ValidationError:
        return False
    return True


def request_fetch(item: Item, url: str) -> None:
    """Queue the `item_image` job for `url`; run_jobs makes the request (never the API request itself).

    One job per Item (key item_image:<pk>), so a double click (the same payload) keeps one job as it is. Job
    keys are unique forever: a done or failed job is armed again, and a waiting one asked with another link or
    expect starts over like a new request (attempts, retry delay and error reset, so a new link never inherits
    the failures of the old one); a running one is left alone. `expect` is the image at request time; the job
    only replaces that one.
    """
    payload = {"item_id": item.pk, "url": url, "expect": item.image_path}
    job = jobs.enqueue(IMAGE_JOB, f"{IMAGE_JOB}:{item.pk}", payload)
    if job.status == Job.Status.RUNNING or (job.status == Job.Status.PENDING and job.payload == payload):
        return
    now = timezone.now()
    Job.objects.filter(pk=job.pk, status=job.status).update(
        status=Job.Status.PENDING, attempts=0, run_after=now, last_error="", payload=payload, updated_at=now
    )


def fetch_automatically(item: Item) -> None:
    """A new link brings its image (DECISIONS 9.6), for an Item without one whose source is an http(s) URL
    (handbook courses point at /docs/... and are skipped). Never for a project: a page's OG banner makes a
    poor logo, so its logo is uploaded or fetched on request."""
    if item.type != Item.Type.PROJECT and not item.image_path and is_http_url(item.source):
        request_fetch(item, item.source)


def notes(user: User, query: str = "", item: int | None = None) -> QuerySet[Note]:
    """The owner's notes; `query` matches title or markdown (case-insensitive), `item` a linked Item id."""
    rows = Note.objects.filter(user=user)
    if query := query.strip():
        rows = rows.filter(Q(title__icontains=query) | Q(markdown__icontains=query))
    if item is not None:
        rows = rows.filter(items__id=item)
    return rows


def note_label(note: Note) -> str:
    """The title, else the first non-empty markdown line without its heading/quote/list mark, links shown by
    their text and escapes by their character (as the web's noteTitle), else ""."""
    if title := note.title.strip():
        return title
    for line in note.markdown.split("\n"):
        text = _LINK.sub(r"\1", _LINE_PREFIX.sub("", _EMPTY_LINE.sub(" ", line)))
        if clean := " ".join(_ESCAPE.sub(r"\1", text).split()):
            return clean[:EXCERPT_CHARS]
    return ""


def note_excerpt(markdown: str, query: str) -> str:
    """About EXCERPT_CHARS characters around the first match of `query` (markdown marks dropped), else the
    start of the note."""
    text = _LINK.sub(r"\1", _LINE_PREFIX.sub("", _EMPTY_LINE.sub(" ", markdown)))
    flat = " ".join(_MARKS.sub(lambda mark: mark.group(1) or " ", text).split())
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


class NoteConflict(Exception):
    """The note was saved again since the version an edit started from (another tab or device)."""

    def __init__(self, note: Note) -> None:
        super().__init__(note.pk)
        self.note = note


def save_note(note: Note, data: dict[str, Any], base_updated_at: dt.datetime | None = None) -> Note:
    """Create (unsaved `note`) or update. An update writes only the fields in `data`, on the row read again
    under a lock, so two saves that cross (the text and the Items of one note) never put back each other's
    older fields; with `base_updated_at` (the version the edit started from) a note saved since then raises
    NoteConflict and nothing is written. `items` (owner checked by the serializer) replaces the links to
    Items. The links written in the markdown are read again (library.links): its NoteLink rows, and the Items
    it links join `items`, also after `items` replaced them (the text still links them)."""
    fields = [field for field in NOTE_FIELDS if field in data]
    with transaction.atomic():
        if note.pk is not None:
            note = Note.objects.select_for_update().get(pk=note.pk)
            if base_updated_at is not None and note.updated_at != base_updated_at:
                raise NoteConflict(note)
        for field in fields:
            setattr(note, field, data[field])
        if note.pk is None:
            note.save()
        else:
            note.save(update_fields=[*fields, "updated_at"])
        if "items" in data:
            note.items.set(data["items"])
        if "markdown" in data or "items" in data:
            sync_links(note)
    return note
