"""GET /api/export: the `manage.py export` files as a streamed zip (DECISIONS 4.7)."""

import io
import json
import zipfile
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.http import StreamingHttpResponse
from django.test import Client
from django.utils import timezone

from core.models import Job, LlmCache, LlmCall
from core.services import export
from inbox.models import InboxEntry
from library.models import Item, Note

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def download(client: Client) -> tuple[Any, zipfile.ZipFile]:
    response = client.get("/api/export")
    assert response.status_code == 200
    assert isinstance(response, StreamingHttpResponse)  # never built in memory on the server
    return response, zipfile.ZipFile(io.BytesIO(response.getvalue()))


def test_export_streams_a_zip_of_the_owners_data(client: Client, settings: Any) -> None:
    settings.GEMINI_API_KEY = "test-secret-key-123"
    user = owner(client)
    user.set_password("hunter2-password")
    user.save()
    book = Item.objects.create(user=user, type="book", title="Deep Work")
    note = Note.objects.create(user=user, title="Ý chính", markdown="# Ba ý\n\n- một")
    note.items.add(book)
    InboxEntry.objects.create(user=user, text="idea")
    other = User.objects.create(username="other@x", email="other@x")
    Item.objects.create(user=other, type="book", title="THEIR ITEM")
    Note.objects.create(user=other, markdown="THEIR NOTE")
    Job.objects.create(kind="tag", key="tag:1", payload={"entry_id": 1})
    LlmCache.objects.create(key="k" * 64, purpose="tag", output={"cached": "CACHED OUTPUT"})
    LlmCall.objects.create(provider="gemini", purpose="tag", model="m", error="CALL ERROR")

    response, archive = download(client)
    folder = f"alex-brain-{timezone.localdate().isoformat()}"
    assert response["Content-Type"] == "application/zip"
    assert response["Content-Disposition"] == f'attachment; filename="{folder}.zip"'
    assert response["Cache-Control"] == "no-store"
    assert archive.testzip() is None

    names = set(archive.namelist())
    assert names == {
        f"{folder}/notes/{export.note_file_name(note)}",
        *(f"{folder}/data/{name}.json" for name in export.TABLES),
        f"{folder}/manifest.json",
    }
    text = archive.read(f"{folder}/notes/{export.note_file_name(note)}").decode()
    assert text == export.note_markdown(note)
    items = json.loads(archive.read(f"{folder}/data/items.json"))
    assert [row["fields"]["title"] for row in items] == ["Deep Work"]
    manifest = json.loads(archive.read(f"{folder}/manifest.json"))
    assert manifest["owner"] == "dev@localhost"
    assert manifest["counts"]["notes"] == 1 and manifest["counts"]["inbox_entries"] == 1

    dump = "\n".join(archive.read(name).decode() for name in names)
    for leaked in (
        "THEIR",
        "pbkdf2",
        "hunter2",
        "CACHED OUTPUT",
        "CALL ERROR",
        "entry_id",
        "test-secret-key-123",
        settings.SECRET_KEY,
    ):
        assert leaked not in dump


def test_export_zip_matches_the_command(client: Client, tmp_path: Any) -> None:
    user = owner(client)
    Note.objects.create(user=user, title="One", markdown="body")
    Item.objects.create(user=user, type="film", title="Film")
    call_command("export", "--owner", "dev@localhost", "--out", str(tmp_path), stdout=io.StringIO())
    _, archive = download(client)
    for name in archive.namelist():
        relative = name.split("/", 1)[1]
        if relative == "manifest.json":
            continue  # exportedAt differs
        assert archive.read(name) == (tmp_path / relative).read_bytes()


def test_export_of_an_empty_account(client: Client) -> None:
    _, archive = download(client)
    manifest = next(n for n in archive.namelist() if n.endswith("manifest.json"))
    counts = json.loads(archive.read(manifest))["counts"]
    assert set(counts.values()) == {0}


def test_export_requires_auth(anon_client: Client) -> None:
    response = anon_client.get("/api/export")
    assert response.status_code == 401
    assert response["Content-Type"] == "application/json"


def test_export_is_read_only(client: Client) -> None:
    client.get("/api/me")
    headers = {"X-CSRFToken": client.cookies["csrftoken"].value}
    assert client.post("/api/export", {}, content_type="application/json", headers=headers).status_code == 405
