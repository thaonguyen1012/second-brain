"""`manage.py export` (DECISIONS 4.7: the data is Alex's): notes as markdown files with front matter, every
other model of the owner as JSON (Django's serializer: pk, model, fields; links are ids).

Never exported: the User row (password hash), sessions, Job and LlmCache rows, LlmCall (not owned data), and
nothing from settings or the environment. A test checks that every model with owner data is listed here.
"""

import json
import re
from pathlib import Path

from django.contrib.auth.models import User
from django.core import serializers
from django.db.models import Model
from django.utils import timezone
from django.utils.text import slugify

from brief.models import BriefEntry, DailyBrief, NewsItem, Source
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


def export(user: User, out: Path) -> dict[str, int]:
    """Write <out>/notes/*.md and <out>/data/*.json (+ manifest.json); returns row counts by file.

    The export mirrors the database: note files from an earlier export (`<id>-<slug>.md`) are replaced, so a
    renamed or deleted note leaves no stale file. Nothing else in `out` is touched.
    """
    notes_dir, data_dir = out / "notes", out / "data"
    for folder in (out, notes_dir, data_dir):
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    for old in notes_dir.iterdir():
        if old.is_file() and NOTE_FILE.match(old.name):
            old.unlink()

    counts: dict[str, int] = {}
    notes = Note.objects.filter(user=user).prefetch_related("items").order_by("pk")
    for note in notes:
        (notes_dir / note_file_name(note)).write_text(note_markdown(note), encoding="utf-8")
    counts["notes"] = len(notes)

    for name, (model, owner) in TABLES.items():
        rows = list(model._default_manager.filter(**{owner: user}).order_by("pk"))
        (data_dir / f"{name}.json").write_text(
            serializers.serialize("json", rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        counts[name] = len(rows)

    manifest = {"exportedAt": timezone.now().isoformat(), "owner": user.email, "counts": counts}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return counts
