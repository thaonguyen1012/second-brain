"""Ingest returns without touching the network; run_jobs unfurls with the SSRF guard."""

import io
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.core.management import call_command
from django.test import Client
from PIL import Image

from core.models import Job
from core.services import safe_fetch
from core.testing import csrf, send
from core.tests.fakenet import FakeNet, html
from inbox.models import InboxEntry

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
    send(client, "post", "/api/inbox", {"text": "only text"}, csrf(client))
    assert Job.objects.count() == 1  # nothing to unfurl


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
    assert Job.objects.get().status == "done"
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
