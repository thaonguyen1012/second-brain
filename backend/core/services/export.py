"""`manage.py export` and GET /api/export (DECISIONS 4.7: the data is Alex's): notes as markdown files with
front matter, every other model of the owner as JSON (Django's serializer: pk, model, fields; links are ids),
and the owner's Item images as images/<image_path> (the file name is exactly the Item's image_path in
data/items.json, which already ends in .webp). The command writes a folder, the endpoint streams the same
files as a zip. Both read every table in batches (TABLE_BATCH rows) and every image in FILE_CHUNK pieces,
never a whole table or file at once.

Never exported: the User row (password hash), sessions, Job and LlmCache rows, LlmCall (not owned data), and
nothing from settings or the environment. A test checks that every model with owner data is listed here.
Inbox thumbnails stay out too: they come from the link and can be fetched again.
"""

import json
import re
import zipfile
from collections.abc import Iterator
from itertools import batched
from pathlib import Path
from typing import BinaryIO

from django.contrib.auth.models import User
from django.core import serializers
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Model
from django.utils import timezone
from django.utils.text import slugify

from brief.models import BriefEntry, DailyBrief, NewsItem, Source
from core.services import thumbnails
from growth.models import Achievement, JobAd, Prediction, Skill, SkillEvidence
from inbox.models import InboxEntry
from library.models import Item, Note
from opportunities.models import Evidence, Opportunity, ScoreSnapshot
from progress.models import LastVisited, PageProgress
from weeks.models import Objective, Week
from work.models import ProjectDetails, TimeEntry

# data/<name>.json -> (model, lookup to the owner): every query is filtered by the owner, directly or through
# its parent row.
TABLES: dict[str, tuple[type[Model], str]] = {
    "items": (Item, "user"),
    "inbox_entries": (InboxEntry, "user"),
    "weeks": (Week, "user"),
    "objectives": (Objective, "week__user"),
    "project_details": (ProjectDetails, "item__user"),
    "time_entries": (TimeEntry, "user"),
    "opportunities": (Opportunity, "user"),
    "opportunity_evidence": (Evidence, "opportunity__user"),
    "opportunity_scores": (ScoreSnapshot, "opportunity__user"),
    "skills": (Skill, "user"),
    "skill_evidence": (SkillEvidence, "skill__user"),
    "job_ads": (JobAd, "user"),
    "achievements": (Achievement, "user"),
    "predictions": (Prediction, "user"),
    "news_sources": (Source, "user"),
    "news_items": (NewsItem, "user"),
    "daily_briefs": (DailyBrief, "user"),
    "brief_entries": (BriefEntry, "brief__user"),
    "page_progress": (PageProgress, "user"),
    "last_visited": (LastVisited, "user"),
}
EXPORTED_MODELS: frozenset[type[Model]] = frozenset({Note, *(model for model, _ in TABLES.values())})
NOTE_FILE = re.compile(r"^\d+(-[a-z0-9-]+)?\.md$")
IMAGE_FILE = re.compile(r"^[0-9A-Za-z]{32}\.webp$")  # a stored image's name (thumbnails.store)
FILE_CHUNK = 64 * 1024


def note_file_name(note: Note) -> str:
    slug = slugify(note.title)[:60].strip("-")
    return f"{note.pk}-{slug}.md" if slug else f"{note.pk}.md"


def note_markdown(note: Note) -> str:
    """Front matter (YAML; strings JSON-quoted, which YAML reads as-is) and the body unchanged."""
    lines = ["---", f"id: {note.pk}", f"title: {json.dumps(note.title, ensure_ascii=False)}"]
    items = sorted(note.items.all(), key=lambda item: item.pk)
    lines.append("items:" if items else "items: []")
    for item in items:
        lines.append(f"  - id: {item.pk}")
        lines.append(f"    title: {json.dumps(item.title, ensure_ascii=False)}")
        lines.append(f"    type: {item.type}")
    lines += [f"created: {note.created_at.isoformat()}", f"updated: {note.updated_at.isoformat()}", "---", ""]
    return "\n".join(lines) + note.markdown + ("" if note.markdown.endswith("\n") else "\n")


# Rows per query batch: a table is read, serialized and written (or zipped) batch by batch, so memory stays at
# one batch however large a table grows (news_items has no retention).
TABLE_BATCH = 500
NOTE_BATCH = 200


def _table_json(rows: Iterator[Model], counts: dict[str, int], name: str) -> Iterator[bytes]:
    """The same JSON as `serializers.serialize("json", rows, indent=2)`, one batch of rows at a time."""
    n = 0
    yield b"["
    for batch in batched(rows, TABLE_BATCH, strict=False):
        parts: list[str] = []
        for obj in serializers.serialize("python", batch):
            parts.append(("," if n else "") + "\n")
            parts.append(
                json.dumps(obj, indent=2, separators=(",", ": "), cls=DjangoJSONEncoder, ensure_ascii=False)
            )
            n += 1
        yield "".join(parts).encode()
    yield b"\n]\n"
    counts[name] = n


def _manifest(user: User, counts: dict[str, int]) -> Iterator[bytes]:
    manifest = {"exportedAt": timezone.now().isoformat(), "owner": user.email, "counts": counts}
    yield (json.dumps(manifest, indent=2) + "\n").encode()


def _open_image(name: str) -> BinaryIO | None:
    """The stored file, opened before its entry is written (a file discarded meanwhile is simply left out)."""
    path = thumbnails.path_of(name)
    if path is None:
        return None
    try:
        return path.open("rb")
    except OSError:
        return None


def _file_chunks(handle: BinaryIO) -> Iterator[bytes]:
    with handle:
        while chunk := handle.read(FILE_CHUNK):
            yield chunk


def export_files(user: User) -> Iterator[tuple[str, Iterator[bytes]]]:
    """Every file of an export as (relative path, chunks): notes/*.md, data/*.json (UTF-8), images/*.webp,
    then manifest.json.

    Each file's chunks must be consumed before the next file is taken (both writers below do): the queries run
    in batches while the chunks are read, and the manifest (last) holds the counts gathered on the way.
    Images: each file the owner's Items name, once (Items may share a file), sorted; one whose file is missing
    is left out of the export and of counts["images"].
    """
    counts: dict[str, int] = {}
    notes = Note.objects.filter(user=user).prefetch_related("items").order_by("pk")
    n = 0
    for note in notes.iterator(chunk_size=NOTE_BATCH):
        yield f"notes/{note_file_name(note)}", iter((note_markdown(note).encode(),))
        n += 1
    counts["notes"] = n

    for name, (model, owner) in TABLES.items():
        rows = model._default_manager.filter(**{owner: user}).order_by("pk").iterator(chunk_size=TABLE_BATCH)
        yield f"data/{name}.json", _table_json(rows, counts, name)

    images = Item.objects.filter(user=user).exclude(image_path="").order_by("image_path")
    n = 0
    for image in images.values_list("image_path", flat=True).distinct():
        if (handle := _open_image(image)) is not None:
            yield f"images/{image}", _file_chunks(handle)
            n += 1
    counts["images"] = n

    yield "manifest.json", _manifest(user, counts)


def export(user: User, out: Path) -> dict[str, int]:
    """Write <out>/notes/*.md, <out>/data/*.json and <out>/images/*.webp (+ manifest.json); returns the
    counts by file (rows, and images under "images").

    The export mirrors the database: note files from an earlier export (`<id>-<slug>.md`) and images
    (`<name>.webp`) are replaced, so a renamed or deleted note or a removed image leaves no stale file.
    Nothing else in `out` is touched.
    """
    notes_dir, data_dir, images_dir = out / "notes", out / "data", out / "images"
    for folder in (out, notes_dir, data_dir, images_dir):
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    for folder, exported in ((notes_dir, NOTE_FILE), (images_dir, IMAGE_FILE)):
        for old in folder.iterdir():
            if old.is_file() and exported.match(old.name):
                old.unlink()

    for name, chunks in export_files(user):
        with (out / name).open("wb") as f:
            for chunk in chunks:
                f.write(chunk)
    counts: dict[str, int] = json.loads((out / "manifest.json").read_bytes())["counts"]
    return counts


class _Chunks:
    """Write-only, unseekable target for ZipFile: collects what it writes until `take()`. Having no `tell`,
    it makes ZipFile write data descriptors instead of seeking back, so the zip can be streamed."""

    def __init__(self) -> None:
        self._parts: list[bytes] = []

    def write(self, data: bytes) -> int:
        self._parts.append(bytes(data))
        return len(data)

    def flush(self) -> None:
        pass

    def close(self) -> None:
        pass

    def take(self) -> bytes:
        data = b"".join(self._parts)
        self._parts.clear()
        return data


def stream_zip(user: User, folder: str) -> Iterator[bytes]:
    """The export as a zip, yielded file by file; every path sits under `folder/`. Text is deflated; the webp
    images are stored as they are (already compressed)."""
    sink = _Chunks()
    with zipfile.ZipFile(sink, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, chunks in export_files(user):
            info = zipfile.ZipInfo(f"{folder}/{name}")
            info.compress_type = zipfile.ZIP_STORED if name.endswith(".webp") else zipfile.ZIP_DEFLATED
            # The size is unknown up front (written batch by batch), so allow a zip64 entry
            with archive.open(info, "w", force_zip64=True) as entry:
                for chunk in chunks:
                    entry.write(chunk)
                    yield sink.take()
            yield sink.take()
    yield sink.take()  # central directory
