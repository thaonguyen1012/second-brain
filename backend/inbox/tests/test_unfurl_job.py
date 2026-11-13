"""Ingest returns without touching the network; run_jobs unfurls with the SSRF guard."""

import io
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import Client
from PIL import Image

from core.models import Job
from core.services import safe_fetch
from core.testing import csrf, send
from core.tests.fakenet import FakeNet, html
from inbox.models import InboxEntry
from library.models import Item

pytestmark = pytest.mark.django_db

PUBLIC = "93.184.215.14"
PAGE = """<title>t</title><meta property="og:title" content="A post">
<meta property="og:site_name" content="Blog"><meta property="og:image" content="https://cdn.test/cover.png">"""


def png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (64, 32), "red").save(out, "PNG")
    return out.getvalue()


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch, settings: Any, tmp_path: Path) -> FakeNet:
    settings.THUMBS_DIR = tmp_path
    fake = FakeNet(monkeypatch)
    fake.site("blog.test", PUBLIC, html(PAGE))
    fake.site(
        "cdn.test",
        PUBLIC,
        lambda r: httpx.Response(200, headers={"content-type": "image/png"}, content=png()),
    )
    return fake


def test_ingest_makes_no_outbound_request(client: Client, net: FakeNet) -> None:
    response = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, csrf(client))
    assert response.status_code == 201 and response.json()["processed"] is False
    assert net.requests == []
    assert Job.objects.get().key == f"unfurl:{response.json()['id']}"
    text_id = send(client, "post", "/api/inbox", {"text": "only text"}, csrf(client)).json()["id"]
    assert Job.objects.filter(kind="unfurl").count() == 1  # nothing to unfurl, tagging only
    assert Job.objects.filter(kind="tag").get().key == f"tag:{text_id}"


def test_run_jobs_unfurls_and_stores_a_thumbnail(client: Client, net: FakeNet, tmp_path: Path) -> None:
    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, csrf(client)).json()["id"]
    call_command("run_jobs", stdout=io.StringIO())
    entry = InboxEntry.objects.get(pk=entry_id)
    assert (entry.og_title, entry.og_site_name, entry.error) == ("A post", "Blog", "")
    assert entry.unfurled_at is not None
    thumb = tmp_path / entry.og_image_path
    assert thumb.stat().st_size <= 200 * 1024 and Image.open(thumb).format == "WEBP"
    assert client.get("/api/inbox").json()["results"][0]["thumbnailUrl"] == f"/api/inbox/{entry_id}/thumbnail"

    response = client.get(f"/api/inbox/{entry_id}/thumbnail")
    assert response.status_code == 200
    assert response["X-Accel-Redirect"] == f"/internal/thumbs/{entry.og_image_path}"
    assert response["Content-Type"] == "image/webp"


def test_refused_url_is_recorded_not_retried(client: Client, net: FakeNet) -> None:
    net.dns["router.test"] = ["192.168.0.1"]
    entry_id = send(client, "post", "/api/inbox", {"url": "http://router.test/"}, csrf(client)).json()["id"]
    call_command("run_jobs", stdout=io.StringIO())
    entry = InboxEntry.objects.get(pk=entry_id)
    assert entry.error.startswith("unfurl refused") and entry.og_title == ""
    assert Job.objects.get(kind="unfurl").status == "done"
    assert Job.objects.filter(kind="tag").exists()  # still tagged from the URL
    assert net.requests == []


def test_network_error_is_retried(client: Client, net: FakeNet, monkeypatch: pytest.MonkeyPatch) -> None:
    net.site("down.test", PUBLIC, lambda r: httpx.Response(503))
    send(client, "post", "/api/inbox", {"url": "http://down.test/"}, csrf(client))
    call_command("run_jobs", stdout=io.StringIO())
    job = Job.objects.get()
    assert (job.status, job.attempts) == ("pending", 1)
    assert InboxEntry.objects.get().error == "unfurl failed: HTTP 503"


def test_thumbnail_needs_owner_and_file(client: Client) -> None:
    client.get("/api/me")
    entry = InboxEntry.objects.create(user_id=client.session["_auth_user_id"], text="x")
    assert client.get(f"/api/inbox/{entry.pk}/thumbnail").status_code == 404
    assert client.get("/api/inbox/999999/thumbnail").status_code == 404


def test_thumbnail_requires_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/inbox/1/thumbnail").status_code == 401


def test_fetch_guard_is_used_for_images(net: FakeNet) -> None:
    net.dns["cdn.test"] = ["127.0.0.1"]
    with pytest.raises(safe_fetch.FetchBlocked):
        safe_fetch.fetch("https://cdn.test/cover.png", safe_fetch.IMAGE_TYPES)


def test_entry_deleted_during_unfurl_leaves_no_thumbnail(
    client: Client, net: FakeNet, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from inbox import jobs as inbox_jobs

    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, csrf(client)).json()["id"]
    real = inbox_jobs._thumbnail

    def thumbnail_then_delete(entry: InboxEntry, image_url: str) -> tuple[str, bytes]:
        name, webp = real(entry, image_url)
        assert (tmp_path / name).is_file()
        assert send(client, "delete", f"/api/inbox/{entry_id}", None, csrf(client)).status_code == 204
        return name, webp

    monkeypatch.setattr(inbox_jobs, "_thumbnail", thumbnail_then_delete)
    call_command("run_jobs", stdout=io.StringIO())
    job = Job.objects.get(kind="unfurl")
    assert job.status == "done" and job.attempts <= 1
    assert not InboxEntry.objects.filter(pk=entry_id).exists()
    assert list(tmp_path.glob("*.webp")) == []
    assert not Job.objects.filter(kind="tag").exists()


def test_entry_deleted_during_unfurl_keeps_a_thumbnail_an_item_uses(
    client: Client, net: FakeNet, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from inbox import jobs as inbox_jobs

    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, csrf(client)).json()["id"]
    real = inbox_jobs._thumbnail
    other = User.objects.get_or_create(username="other@x", email="other@x")[0]

    def thumbnail_then_delete(entry: InboxEntry, image_url: str) -> tuple[str, bytes]:
        name, webp = real(entry, image_url)
        # Content addressed: a small og:image encodes alike for an Item, so another owner's Item names it.
        Item.objects.create(user=other, type="article", title="theirs", image_path=name)
        assert send(client, "delete", f"/api/inbox/{entry_id}", None, csrf(client)).status_code == 204
        return name, webp

    monkeypatch.setattr(inbox_jobs, "_thumbnail", thumbnail_then_delete)
    call_command("run_jobs", stdout=io.StringIO())
    assert not InboxEntry.objects.filter(pk=entry_id).exists()
    kept = Item.objects.get(user=other).image_path
    assert kept and {p.name for p in tmp_path.glob("*.webp")} == {kept}


def test_unfurl_fills_an_item_linked_before_it_finished(client: Client, net: FakeNet, tmp_path: Path) -> None:
    headers = csrf(client)
    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, headers).json()["id"]
    item_id = send(client, "post", "/api/items", {"type": "article", "title": "A post"}, headers).json()["id"]
    send(client, "patch", f"/api/inbox/{entry_id}", {"item": item_id}, headers)  # "Thành item" at once
    assert Item.objects.get(pk=item_id).image_path == ""  # no thumbnail yet

    call_command("run_jobs", stdout=io.StringIO())
    thumbnail = InboxEntry.objects.get(pk=entry_id).og_image_path
    copy = Item.objects.get(pk=item_id).image_path
    assert thumbnail and copy and copy != thumbnail
    assert {p.name for p in tmp_path.glob("*.webp")} == {thumbnail, copy}


@pytest.mark.parametrize("kind", ["project", "tool"])
def test_unfurl_never_gives_a_linked_project_the_thumbnail(
    client: Client, net: FakeNet, tmp_path: Path, kind: str
) -> None:
    # a page's OG image is a banner, not a logo (a project's or a tool's picture)
    headers = csrf(client)
    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, headers).json()["id"]
    owner = client.session["_auth_user_id"]
    project = Item.objects.create(user_id=owner, type=kind, title="Client site")
    InboxEntry.objects.filter(pk=entry_id).update(item=project)
    call_command("run_jobs", stdout=io.StringIO())
    thumbnail = InboxEntry.objects.get(pk=entry_id).og_image_path
    assert thumbnail and Item.objects.get(pk=project.pk).image_path == ""
    assert {p.name for p in tmp_path.glob("*.webp")} == {thumbnail}


def test_unfurl_keeps_the_image_of_a_linked_item(client: Client, net: FakeNet) -> None:
    headers = csrf(client)
    entry_id = send(client, "post", "/api/inbox", {"url": "https://blog.test/p"}, headers).json()["id"]
    item = Item.objects.create(
        user_id=client.session["_auth_user_id"], type="article", title="A", image_path="e" * 32 + ".webp"
    )
    InboxEntry.objects.filter(pk=entry_id).update(item=item)
    call_command("run_jobs", stdout=io.StringIO())
    assert InboxEntry.objects.get(pk=entry_id).og_image_path
    assert Item.objects.get(pk=item.pk).image_path == "e" * 32 + ".webp"
