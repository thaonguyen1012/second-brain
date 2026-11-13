import datetime as dt
import json
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from django.apps import apps
from django.contrib.auth.models import User
from django.core import serializers
from django.core.management import call_command
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from brief.models import DailyBrief
from core.models import Job, LlmCache, LlmCall
from core.services import export, thumbnails
from core.testing import image_bytes
from inbox.models import InboxEntry
from library.models import Item, Note, NoteLink
from weeks.models import Objective, Week

pytestmark = pytest.mark.django_db
PROJECT_APPS = {"core", "progress", "library", "inbox", "weeks", "work", "opportunities", "growth", "brief"}


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


# --- GET /api/status --------------------------------------------------------------------------------


def test_status_reports_cost_calls_brief_and_jobs(client: Client, settings: Any) -> None:
    settings.LLM_MODEL = "gemini-3.1-flash-lite"
    settings.LLM_MONTHLY_BUDGET_USD = 5.0
    settings.GEMINI_API_KEY = "test-secret-key-123"
    user = owner(client)
    call = {"provider": "gemini", "purpose": "tag", "model": settings.LLM_MODEL}
    LlmCall.objects.create(**call, in_tokens=1_000_000, ok=True)
    LlmCall.objects.create(**call, error="RateLimited: 429")
    old = LlmCall.objects.create(**call, in_tokens=10**7)
    LlmCall.objects.filter(pk=old.pk).update(created_at=timezone.now() - dt.timedelta(days=40))
    Job.objects.create(kind="tag", key="tag:1")
    Job.objects.create(kind="tag", key="tag:2")
    Job.objects.create(kind="unfurl", key="unfurl:1", status="failed", last_error="secret detail")
    Job.objects.create(kind="brief", key="brief:1", status="done")
    today = timezone.localdate()
    DailyBrief.objects.create(user=user, date=today - dt.timedelta(days=1), generated_at=timezone.now())
    DailyBrief.objects.create(user=stranger(), date=today, generated_at=timezone.now())
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/status")
    assert response.status_code == 200
    assert len(queries) <= 6
    data = response.json()
    assert data["llm"] == {
        "provider": "gemini",
        "model": "gemini-3.1-flash-lite",
        "freeTier": settings.LLM_FREE_TIER,
        "monthStart": data["llm"]["monthStart"],
        "monthCostUsd": 0.25,
        "budgetUsd": 5.0,
        "calls": 2,
        "failedCalls": 1,
    }
    assert data["lastBriefDate"] == str(today - dt.timedelta(days=1))  # never another owner's brief
    assert data["jobs"] == {
        "pending": [{"kind": "tag", "count": 2}],
        "failed": [{"kind": "unfurl", "count": 1}],
    }
    body = response.content.decode()
    for secret in ("test-secret-key-123", settings.SECRET_KEY, "secret detail"):
        assert secret not in body


def test_status_without_any_activity(client: Client) -> None:
    data = client.get("/api/status").json()
    assert data["lastBriefDate"] is None and data["jobs"] == {"pending": [], "failed": []}
    assert data["llm"]["calls"] == 0 and data["llm"]["monthCostUsd"] == 0


def test_status_requires_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/status").status_code == 401


# --- manage.py export -------------------------------------------------------------------------------


def test_every_model_with_owner_data_is_exported() -> None:
    models = {m for m in apps.get_models() if m._meta.app_label in PROJECT_APPS}
    # NoteLink rows are read out of the notes' markdown on every save (library.links): the markdown is
    # exported
    assert models - export.EXPORTED_MODELS == {Job, LlmCall, LlmCache, NoteLink}


def test_export_writes_notes_and_json_without_secrets(client: Client, tmp_path: Path) -> None:
    user = owner(client)
    user.set_password("hunter2-password")
    user.save()
    book = Item.objects.create(user=user, type="book", title='Deep "Work"', tags=["focus"], summary="Làm sâu")
    note = Note.objects.create(user=user, title="Ý chính: Deep Work", markdown="# Ba ý\n\n- một")
    note.items.add(book)
    Note.objects.create(user=user, markdown="no title")
    week = Week.objects.create(user=user, start_date=dt.date(2026, 10, 26))
    Objective.objects.create(week=week, title="ship")
    InboxEntry.objects.create(user=user, text="idea")
    other = stranger()
    Item.objects.create(user=other, type="book", title="THEIR ITEM")
    Note.objects.create(user=other, markdown="THEIR NOTE")
    their_week = Week.objects.create(user=other, start_date=dt.date(2026, 10, 26))
    Objective.objects.create(week=their_week, title="THEIRS")
    Job.objects.create(kind="tag", key="tag:1", payload={"entry_id": 1})
    LlmCache.objects.create(key="k" * 64, purpose="tag", output={"cached": "CACHED OUTPUT"})
    (tmp_path / "notes").mkdir()
    (tmp_path / "notes" / "999-renamed.md").write_text("stale")  # from an earlier export
    (tmp_path / "notes" / "README.md").write_text("mine")  # not an exported note: kept

    out = StringIO()
    call_command("export", "--owner", "dev@localhost", "--out", str(tmp_path), stdout=out)
    assert "2 notes" in out.getvalue()

    notes = sorted(p.name for p in (tmp_path / "notes").iterdir())
    assert notes == sorted([f"{note.pk}-y-chinh-deep-work.md", f"{note.pk + 1}.md", "README.md"])
    text = (tmp_path / "notes" / f"{note.pk}-y-chinh-deep-work.md").read_text()
    assert text == (
        f'---\nid: {note.pk}\ntitle: "Ý chính: Deep Work"\nitems:\n  - id: {book.pk}\n'
        f'    title: "Deep \\"Work\\""\n    type: book\n'
        f"created: {note.created_at.isoformat()}\nupdated: {note.updated_at.isoformat()}\n---\n"
        "# Ba ý\n\n- một\n"
    )

    data = {p.stem: json.loads(p.read_text()) for p in (tmp_path / "data").iterdir()}
    assert set(data) == set(export.TABLES)
    assert [row["fields"]["title"] for row in data["items"]] == ['Deep "Work"']
    assert [row["fields"]["summary"] for row in data["items"]] == ["Làm sâu"]  # every Item field goes out
    assert [row["fields"]["title"] for row in data["objectives"]] == ["ship"]
    assert len(data["inbox_entries"]) == 1
    manifest = json.loads((tmp_path / "manifest.json").read_text())
    assert manifest["owner"] == "dev@localhost" and manifest["counts"]["notes"] == 2

    dump = b"\n".join(p.read_bytes() for p in tmp_path.rglob("*") if p.is_file())  # images are binary
    for leaked in ("THEIR", "pbkdf2", "hunter2", "CACHED OUTPUT", "entry_id", "SECRET"):
        assert leaked.encode() not in dump


def test_export_copies_the_owners_item_images(client: Client, settings: Any, tmp_path: Path) -> None:
    thumbs, out = tmp_path / "thumbs", tmp_path / "out"
    settings.THUMBS_DIR = thumbs
    user, other = owner(client), stranger()
    cover = thumbnails.store(thumbnails.to_webp(image_bytes(color="red"), thumbnails.ITEM_SIZES))
    logo = thumbnails.store(thumbnails.to_webp(image_bytes(color="blue"), thumbnails.ITEM_SIZES))
    theirs = thumbnails.store(thumbnails.to_webp(image_bytes(color="green"), thumbnails.ITEM_SIZES))
    card = thumbnails.store(thumbnails.to_webp(image_bytes(color="white")))
    lost = "f" * 32 + ".webp"
    Item.objects.create(user=user, type="book", title="Dune", image_path=cover)
    Item.objects.create(user=user, type="film", title="Dune (2021)", image_path=cover)  # one file, twice
    Item.objects.create(user=user, type="project", title="Shop", image_path=logo)
    Item.objects.create(user=user, type="book", title="Lost", image_path=lost)  # its file is gone
    Item.objects.create(user=other, type="book", title="theirs", image_path=theirs)
    InboxEntry.objects.create(user=user, url="https://a.test/", og_image_path=card)  # can be fetched again
    (out / "images").mkdir(parents=True)
    (out / "images" / ("0" * 32 + ".webp")).write_bytes(b"removed since the last export")
    (out / "images" / "README.txt").write_text("mine")

    stdout = StringIO()
    call_command("export", "--owner", "dev@localhost", "--out", str(out), stdout=stdout)
    assert "and 2 images exported" in stdout.getvalue()
    assert sorted(p.name for p in (out / "images").iterdir()) == sorted([cover, logo, "README.txt"])
    for name in (cover, logo):
        assert (out / "images" / name).read_bytes() == (thumbs / name).read_bytes()
    assert json.loads((out / "manifest.json").read_text())["counts"]["images"] == 2
    items = json.loads((out / "data" / "items.json").read_text())
    assert {row["fields"]["image_path"] for row in items} == {cover, logo, lost}


def test_tables_are_written_in_batches_with_djangos_json(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = owner(client)
    monkeypatch.setattr(export, "TABLE_BATCH", 2)
    InboxEntry.objects.bulk_create([InboxEntry(user=user, text=f"idea {i} ý") for i in range(5)])
    files = {name: list(chunks) for name, chunks in export.export_files(user)}

    chunks = files["data/inbox_entries.json"]
    assert len(chunks) == 2 + 3  # "[", three batches of at most 2 rows, the closing bracket
    rows = InboxEntry.objects.filter(user=user).order_by("pk")
    expected = serializers.serialize("json", rows, indent=2, ensure_ascii=False)
    assert b"".join(chunks).decode() == expected
    assert b"".join(files["data/items.json"]).decode() == serializers.serialize("json", [], indent=2)
    assert json.loads(b"".join(files["manifest.json"]))["counts"]["inbox_entries"] == 5
