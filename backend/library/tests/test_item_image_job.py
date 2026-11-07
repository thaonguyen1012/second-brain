"""The image of an Item's link: POST /api/items/{id}/image/fetch and the automatic fetch only queue the
`item_image` job; run_jobs makes the requests through the SSRF guard (FakeNet: no test reaches the
network)."""

import io
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client
from PIL import Image

from core.models import Job
from core.services import thumbnails
from core.testing import csrf, image_bytes, send
from core.tests.fakenet import FakeNet, Route, html
from library.models import Item

pytestmark = pytest.mark.django_db

PUBLIC = "93.184.215.14"
PAGE = '<title>Dune</title><meta property="og:image" content="https://cdn.test/cover.png">'


def png_route(color: str = "red", size: tuple[int, int] = (1600, 900)) -> Route:
    return lambda request: httpx.Response(
        200, headers={"content-type": "image/png"}, content=image_bytes(size, color)
    )


@pytest.fixture
def net(monkeypatch: pytest.MonkeyPatch, settings: Any, tmp_path: Path) -> FakeNet:
    settings.THUMBS_DIR = tmp_path
    fake = FakeNet(monkeypatch)
    fake.site("blog.test", PUBLIC, html(PAGE))
    fake.site("cdn.test", PUBLIC, png_route())
    return fake


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def book(client: Client, source: str = "https://blog.test/dune", **fields: Any) -> Item:
    """Made in the ORM: no automatic fetch."""
    return Item.objects.create(user=owner(client), type="book", title="Dune", source=source, **fields)


def fetch(client: Client, item: Item, **body: Any) -> Any:
    return send(client, "post", f"/api/items/{item.pk}/image/fetch", body, csrf(client))


def run_jobs() -> None:
    call_command("run_jobs", "--no-schedule", stdout=io.StringIO())


def hosts(net: FakeNet) -> list[str]:
    return [r.headers["host"] for r in net.requests]


def test_fetch_answers_at_once_and_queues_one_job(client: Client, net: FakeNet) -> None:
    item = book(client)
    response = fetch(client, item)
    assert response.status_code == 202
    assert (response.json()["id"], response.json()["imagePending"]) == (item.pk, True)
    assert net.requests == []  # the request happens in run_jobs, never in the API request
    job = Job.objects.get()
    assert (job.kind, job.key, job.status) == ("item_image", f"item_image:{item.pk}", "pending")
    assert job.payload == {"item_id": item.pk, "url": "https://blog.test/dune", "expect": ""}
    # A second click keeps one job and takes the newer link.
    assert fetch(client, item, url="https://cdn.test/cover.png").status_code == 202
    assert Job.objects.get().payload["url"] == "https://cdn.test/cover.png"


def test_fetch_needs_an_http_link(client: Client, net: FakeNet) -> None:
    item = book(client, source="Frank Herbert")
    response = fetch(client, item)
    assert response.status_code == 400 and response.json() == {"url": ["Item chưa có link http(s)."]}
    for url in ("ftp://a.test/x.png", "javascript:alert(1)", "/docs/it/handbook-08/"):
        assert fetch(client, item, url=url).status_code == 400
    course = book(client, source="/docs/it/handbook-08/")
    assert fetch(client, course).status_code == 400
    assert not Job.objects.exists()


def test_run_jobs_stores_the_og_image_of_a_page(client: Client, net: FakeNet, tmp_path: Path) -> None:
    item = book(client)
    fetch(client, item)
    run_jobs()
    item.refresh_from_db()
    assert hosts(net) == ["blog.test", "cdn.test"]
    with Image.open(tmp_path / item.image_path) as image:
        assert image.format == "WEBP" and max(image.size) <= thumbnails.ITEM_SIZES[0]
    assert Job.objects.get().status == "done"
    data = client.get(f"/api/items/{item.pk}").json()
    assert (data["imagePending"], data["imageUrl"]) == (
        False,
        f"/api/items/{item.pk}/image?v={item.image_path[:8]}",
    )


def test_run_jobs_takes_an_image_url_as_it_is(client: Client, net: FakeNet) -> None:
    item = book(client)
    fetch(client, item, url="https://cdn.test/cover.png")
    run_jobs()
    assert hosts(net) == ["cdn.test"]
    assert Item.objects.get(pk=item.pk).image_path


def test_a_refused_url_is_final(client: Client, net: FakeNet) -> None:
    net.dns["router.test"] = ["192.168.0.1"]
    item = book(client, source="http://router.test/admin")
    fetch(client, item)
    run_jobs()
    job = Job.objects.get()
    assert (job.status, job.attempts) == ("done", 0)
    assert net.requests == [] and Item.objects.get(pk=item.pk).image_path == ""


def test_an_unreadable_image_is_final(client: Client, net: FakeNet, tmp_path: Path) -> None:
    net.site(
        "cdn.test",
        PUBLIC,
        lambda r: httpx.Response(200, headers={"content-type": "image/png"}, content=b"no"),
    )
    item = book(client)
    fetch(client, item)
    run_jobs()
    assert Job.objects.get().status == "done"
    assert Item.objects.get(pk=item.pk).image_path == "" and list(tmp_path.iterdir()) == []


def test_a_network_error_is_retried(client: Client, net: FakeNet) -> None:
    net.site("down.test", PUBLIC, lambda r: httpx.Response(503))
    item = book(client, source="https://down.test/post")
    fetch(client, item)
    run_jobs()
    job = Job.objects.get()
    assert (job.status, job.attempts) == ("pending", 1)
    assert job.last_error.startswith("FetchError")
    assert client.get(f"/api/items/{item.pk}").json()["imagePending"] is True


def test_a_page_without_an_image_ends_without_one(client: Client, net: FakeNet) -> None:
    net.site("plain.test", PUBLIC, html("<title>No picture</title>"))
    item = book(client, source="https://plain.test/")
    fetch(client, item)
    run_jobs()
    assert Job.objects.get().status == "done" and hosts(net) == ["plain.test"]
    assert Item.objects.get(pk=item.pk).image_path == ""


def upload(client: Client, item: Item, color: str) -> None:
    file = SimpleUploadedFile("cover.png", image_bytes(color=color), content_type="image/png")
    response = client.post(f"/api/items/{item.pk}/image", {"file": file}, headers=csrf(client))
    assert response.status_code == 200, response.json()


def test_an_upload_made_while_the_job_waits_wins(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)
    upload(client, item, "blue")
    uploaded = Item.objects.get(pk=item.pk).image_path
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert Item.objects.get(pk=item.pk).image_path == uploaded
    assert net.requests == []  # the image changed since the request: nothing to fetch
    assert Job.objects.get().status == "done" and {p.name for p in tmp_path.iterdir()} == {uploaded}


def test_an_upload_made_during_the_fetch_wins(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)

    def upload_then_answer(request: httpx.Request) -> httpx.Response:
        upload(client, item, "blue")
        return png_route("red")(request)

    net.site("cdn.test", PUBLIC, upload_then_answer)
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    uploaded = Item.objects.get(pk=item.pk).image_path
    assert hosts(net) == ["blog.test", "cdn.test"] and Job.objects.get().status == "done"
    assert {p.name for p in tmp_path.iterdir()} == {uploaded}  # the fetched file was discarded


def test_an_item_deleted_during_the_fetch_leaves_no_file(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)

    def delete_then_answer(request: httpx.Request) -> httpx.Response:
        assert client.delete(f"/api/items/{item.pk}", headers=csrf(client)).status_code == 204
        return png_route()(request)

    net.site("cdn.test", PUBLIC, delete_then_answer)
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert not Item.objects.filter(pk=item.pk).exists()
    assert Job.objects.get().status == "done" and list(tmp_path.iterdir()) == []


def test_a_job_for_a_deleted_item_makes_no_request(client: Client, net: FakeNet) -> None:
    item = book(client)
    fetch(client, item)
    Item.objects.filter(pk=item.pk).delete()
    run_jobs()
    assert net.requests == [] and Job.objects.get().status == "done"


def test_a_fetch_after_the_job_ended_runs_again(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)
    run_jobs()
    first = Item.objects.get(pk=item.pk).image_path
    net.site("cdn.test", PUBLIC, png_route("blue"))
    assert fetch(client, item).json()["imagePending"] is True
    job = Job.objects.get()
    assert (job.status, job.attempts, job.payload["expect"]) == ("pending", 0, first)  # a fresh expect
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    second = Item.objects.get(pk=item.pk).image_path
    assert second and second != first and {p.name for p in tmp_path.iterdir()} == {second}
    # A job given up after its attempts is armed again too.
    Job.objects.update(status="failed", attempts=3)
    fetch(client, item)
    assert Job.objects.filter(status="pending", attempts=0).count() == 1


def test_a_running_job_is_left_alone(client: Client, net: FakeNet) -> None:
    item = book(client)
    fetch(client, item)
    Job.objects.update(status="running")
    fetch(client, item, url="https://cdn.test/cover.png")
    job = Job.objects.get()
    assert (job.status, job.payload["url"]) == ("running", "https://blog.test/dune")


# --- automatic fetch ----------------------------------------------------------------------------------------


def test_creating_an_item_with_a_link_queues_its_image(client: Client, net: FakeNet) -> None:
    body = {"type": "book", "title": "Dune", "source": "https://blog.test/dune"}
    data = send(client, "post", "/api/items", body, csrf(client)).json()
    assert data["imagePending"] is True and net.requests == []
    assert Job.objects.get().payload == {"item_id": data["id"], "url": "https://blog.test/dune", "expect": ""}
    run_jobs()
    assert Item.objects.get(pk=data["id"]).image_path


def test_no_automatic_fetch_for_projects_or_sources_without_a_link(client: Client, net: FakeNet) -> None:
    headers = csrf(client)
    for body in (
        {"type": "project", "title": "Repo", "source": "https://github.test/alex/shop"},
        {"type": "course", "title": "An ninh mạng", "source": "/docs/it/handbook-08/"},
        {"type": "book", "title": "Dune", "source": "Frank Herbert"},
        {"type": "film", "title": "No source"},
    ):
        assert send(client, "post", "/api/items", body, headers).json()["imagePending"] is False
    project = send(
        client, "post", "/api/projects", {"title": "Shop", "source": "https://shop.test/"}, headers
    )
    assert project.status_code == 201
    send(
        client, "patch", f"/api/projects/{project.json()['id']}", {"source": "https://shop.test/new"}, headers
    )
    assert not Job.objects.exists()


def test_a_new_link_queues_the_image_of_an_item_without_one(client: Client, net: FakeNet) -> None:
    headers = csrf(client)
    item = book(client, source="Frank Herbert")
    url = f"/api/items/{item.pk}"
    assert send(client, "patch", url, {"title": "Dune (1965)"}, headers).json()["imagePending"] is False
    data = send(client, "patch", url, {"source": "https://blog.test/dune"}, headers).json()
    assert data["imagePending"] is True and Job.objects.get().payload["url"] == "https://blog.test/dune"
    # The same source again changes nothing.
    send(client, "patch", url, {"source": "https://blog.test/dune", "status": "active"}, headers)
    assert Job.objects.count() == 1 and Job.objects.get().payload["url"] == "https://blog.test/dune"


def test_a_new_link_keeps_an_existing_image(client: Client, net: FakeNet) -> None:
    item = book(client, source="Frank Herbert", image_path="c" * 32 + ".webp")
    url = f"/api/items/{item.pk}"
    data = send(client, "patch", url, {"source": "https://blog.test/dune"}, csrf(client)).json()
    assert data["imagePending"] is False and not Job.objects.exists()
