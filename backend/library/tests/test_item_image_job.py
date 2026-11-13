"""The image of an Item's link: POST /api/items/{id}/image/fetch and the automatic fetch only queue the
`item_image` job; run_jobs makes the requests through the SSRF guard (FakeNet: no test reaches the
network)."""

import datetime as dt
import io
from pathlib import Path
from typing import Any

import httpx
import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client
from django.utils import timezone
from PIL import Image

from core.models import Job
from core.services import thumbnails
from core.testing import csrf, icon_bytes, image_bytes, send
from core.tests.fakenet import FakeNet, Route, files, html
from inbox.models import InboxEntry
from library import logos
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
    for url in ("ftp://a.test/x.png", "javascript:alert(1)", "/docs/ky-nang/garden-notes/"):
        assert fetch(client, item, url=url).status_code == 400
    course = book(client, source="/docs/ky-nang/garden-notes/")
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


def upload(client: Client, item: Item, color: str) -> Any:
    file = SimpleUploadedFile("cover.png", image_bytes(color=color), content_type="image/png")
    response = client.post(f"/api/items/{item.pk}/image", {"file": file}, headers=csrf(client))
    assert response.status_code == 200, response.json()
    return response.json()


def remove(client: Client, item_id: int) -> None:
    assert client.delete(f"/api/items/{item_id}/image", headers=csrf(client)).status_code == 204


def test_an_upload_made_while_the_job_waits_wins(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)
    assert upload(client, item, "blue")["imagePending"] is False  # the upload ended the waiting fetch
    uploaded = Item.objects.get(pk=item.pk).image_path
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert Item.objects.get(pk=item.pk).image_path == uploaded
    assert net.requests == []  # the fetch was ended: nothing to fetch
    assert Job.objects.get().status == "done" and {p.name for p in tmp_path.iterdir()} == {uploaded}


def test_an_upload_made_during_the_fetch_wins(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = book(client)
    fetch(client, item)
    uploaded: list[str] = []

    def upload_then_answer(request: httpx.Request) -> httpx.Response:
        upload(client, item, "blue")
        uploaded.append(Item.objects.get(pk=item.pk).image_path)  # before the job tries to set its image
        return png_route("red")(request)

    net.site("cdn.test", PUBLIC, upload_then_answer)
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert hosts(net) == ["blog.test", "cdn.test"] and Job.objects.get().status == "done"
    assert len(uploaded) == 1 and Item.objects.get(pk=item.pk).image_path == uploaded[0]
    assert {p.name for p in tmp_path.iterdir()} == {uploaded[0]}  # the fetched file was discarded


def test_a_removal_after_an_inbox_link_ends_the_automatic_fetch(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    """'Thành item': the Item is made with the entry's link (automatic fetch, expect ""), the link copies the
    entry's thumbnail, and the owner removes that image. The Item is "" again, as the fetch expects, but the
    fetch must not put an image back."""
    headers = csrf(client)
    thumbnail = thumbnails.store(thumbnails.to_webp(image_bytes((1600, 900), "green")))
    link = "https://blog.test/dune"
    entry = InboxEntry.objects.create(user=owner(client), url=link, og_image_path=thumbnail)
    body = {"type": "book", "title": "Dune", "source": link}
    item = send(client, "post", "/api/items", body, headers).json()
    assert item["imagePending"] is True
    with django_capture_on_commit_callbacks(execute=True):
        send(client, "patch", f"/api/inbox/{entry.pk}", {"item": item["id"]}, headers)
    data = client.get(f"/api/items/{item['id']}").json()
    assert data["imageUrl"] and data["imagePending"] is False  # the copy ended the fetch
    with django_capture_on_commit_callbacks(execute=True):
        remove(client, item["id"])
    data = client.get(f"/api/items/{item['id']}").json()
    assert (data["imageUrl"], data["imagePending"]) == (None, False)
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert net.requests == [] and Item.objects.get(pk=item["id"]).image_path == ""
    assert Job.objects.get().status == "done"
    assert {p.name for p in tmp_path.iterdir()} == {thumbnail}  # the entry keeps its card; the copy went


def test_an_image_removed_during_the_fetch_stays_removed(
    client: Client, net: FakeNet, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    """The upload and the removal come after the job checked its expect (""): the image it then fetches must
    not undo the removal, although the Item is back to ""."""
    item = book(client)
    fetch(client, item)

    def upload_remove_then_answer(request: httpx.Request) -> httpx.Response:
        upload(client, item, "blue")
        remove(client, item.pk)
        return png_route("red")(request)

    net.site("cdn.test", PUBLIC, upload_remove_then_answer)
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert hosts(net) == ["blog.test", "cdn.test"] and Job.objects.get().status == "done"
    assert Item.objects.get(pk=item.pk).image_path == "" and list(tmp_path.iterdir()) == []


def test_a_fetch_ended_while_it_ran_sets_no_image_on_its_retry(client: Client, net: FakeNet) -> None:
    item = book(client)
    fetch(client, item)

    def remove_then_fail(request: httpx.Request) -> httpx.Response:
        remove(client, item.pk)  # no image yet: the owner wants none
        return httpx.Response(503)

    net.site("blog.test", PUBLIC, remove_then_fail)
    run_jobs()
    job = Job.objects.get()
    assert (job.status, job.attempts) == ("pending", 1)  # the network error is retried as usual...
    net.site("blog.test", PUBLIC, html(PAGE))
    Job.objects.update(run_after=timezone.now())
    run_jobs()
    assert hosts(net) == ["blog.test"]  # ...but the retry makes no request: the fetch was ended
    assert Job.objects.get().status == "done" and Item.objects.get(pk=item.pk).image_path == ""


def test_asking_again_with_another_link_starts_over(client: Client, net: FakeNet) -> None:
    item = book(client, source="https://down.test/post")
    fetch(client, item)
    # The old link failed twice: the job waits 10 minutes for its last attempt.
    later = timezone.now() + dt.timedelta(minutes=10)
    Job.objects.update(attempts=2, run_after=later, last_error="FetchError: HTTP 503")
    fetch(client, item)  # the same request again (a double click) leaves the job as it is
    assert (Job.objects.get().attempts, Job.objects.get().run_after) == (2, later)
    fetch(client, item, url="https://blog.test/dune")
    job = Job.objects.get()
    assert (job.status, job.attempts, job.last_error) == ("pending", 0, "")
    assert job.run_after <= timezone.now() and job.payload["url"] == "https://blog.test/dune"
    run_jobs()  # due at once, with every attempt
    assert hosts(net) == ["blog.test", "cdn.test"] and Item.objects.get(pk=item.pk).image_path


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
    # a project's picture is a logo, which a page's OG banner is not, and a client's site is not the project's
    headers = csrf(client)
    for body in (
        {"type": "project", "title": "Repo", "source": "https://github.test/alex/shop"},
        {"type": "tool", "title": "grep", "source": "man grep"},
        {"type": "course", "title": "Làm vườn", "source": "/docs/ky-nang/garden-notes/"},
        {"type": "book", "title": "Dune", "source": "Frank Herbert"},
        {"type": "film", "title": "No source"},
    ):
        assert send(client, "post", "/api/items", body, headers).json()["imagePending"] is False
    in_library = Item.objects.get(type="project")
    patched = send(client, "patch", f"/api/items/{in_library.pk}", {"source": "https://shop.test/"}, headers)
    assert patched.json()["imagePending"] is False
    project = send(
        client, "post", "/api/projects", {"title": "Shop", "source": "https://shop.test/"}, headers
    )
    assert project.status_code == 201
    send(
        client, "patch", f"/api/projects/{project.json()['id']}", {"source": "https://shop.test/new"}, headers
    )
    assert not Job.objects.exists()


def test_a_new_link_queues_the_image_of_an_item_without_one(client: Client, net: FakeNet) -> None:
    net.site("plain.test", PUBLIC, html("<title>No picture</title>"))
    headers = csrf(client)
    item = book(client, source="Frank Herbert")
    url = f"/api/items/{item.pk}"
    assert send(client, "patch", url, {"title": "Dune (1965)"}, headers).json()["imagePending"] is False
    data = send(client, "patch", url, {"source": "https://plain.test/dune"}, headers).json()
    assert data["imagePending"] is True and Job.objects.get().payload["url"] == "https://plain.test/dune"
    run_jobs()  # a page without an image: the job ends and the Item stays without one
    assert Job.objects.get().status == "done" and Item.objects.get(pk=item.pk).image_path == ""
    # Writes that keep the source (the same source sent again, a board drag, a rating) fetch nothing again.
    same_source = {"source": "https://plain.test/dune", "status": "active"}
    for body in (same_source, {"status": "done"}, {"rating": 8}):
        assert send(client, "patch", url, body, headers).json()["imagePending"] is False
    assert Job.objects.get().status == "done" and hosts(net) == ["plain.test"]


def test_a_project_fetches_its_logo_on_request(client: Client, net: FakeNet) -> None:
    # Never by itself (a page's banner is a poor logo), but the endpoint works for every type.
    headers = csrf(client)
    body = {"title": "Shop", "source": "https://blog.test/dune"}
    project_id = send(client, "post", "/api/projects", body, headers).json()["id"]
    assert not Job.objects.exists()
    response = fetch(client, Item.objects.get(pk=project_id))
    assert response.status_code == 202 and response.json()["imagePending"] is True
    assert Job.objects.get().payload == {"item_id": project_id, "url": "https://blog.test/dune", "expect": ""}
    run_jobs()
    logo = Item.objects.get(pk=project_id).image_path
    assert logo and hosts(net) == ["blog.test", "cdn.test"]
    data = client.get(f"/api/projects/{project_id}").json()
    assert data["imageUrl"] == f"/api/items/{project_id}/image?v={logo[:8]}"


def test_a_new_link_keeps_an_existing_image(client: Client, net: FakeNet) -> None:
    item = book(client, source="Frank Herbert", image_path="c" * 32 + ".webp")
    url = f"/api/items/{item.pk}"
    data = send(client, "patch", url, {"source": "https://blog.test/dune"}, csrf(client)).json()
    assert data["imagePending"] is False and not Job.objects.exists()


# --- a tool's logo: the icon of its site (DECISIONS 9.10) ---------------------------------------------------

TOOL_PAGE = (
    '<meta property="og:image" content="https://cdn.test/cover.png">'  # a 1600 px banner, never a logo
    '<link rel="apple-touch-icon" href="/touch.png">'
)


@pytest.fixture
def tool_site(net: FakeNet) -> FakeNet:
    net.site(
        "tool.test",
        PUBLIC,
        files({"/": ("text/html", TOOL_PAGE), "/touch.png": ("image/png", icon_bytes((180, 180)))}),
    )
    return net


def a_tool(client: Client, source: str = "https://tool.test/", **fields: Any) -> Item:
    """Made in the ORM: no automatic fetch."""
    return Item.objects.create(user=owner(client), type="tool", title="Semgrep", source=source, **fields)


def asked(net: FakeNet) -> list[str]:
    return [f"{r.headers['host']}{r.url.path}" for r in net.requests]


def test_a_tool_with_a_link_queues_the_logo_of_its_site(
    client: Client, tool_site: FakeNet, tmp_path: Path
) -> None:
    headers = csrf(client)
    body = {"type": "tool", "title": "Semgrep", "source": "https://tool.test/"}
    data = send(client, "post", "/api/items", body, headers).json()
    assert data["imagePending"] is True and tool_site.requests == []  # run_jobs makes the requests
    assert Job.objects.get().payload == {"item_id": data["id"], "url": "https://tool.test/", "expect": ""}
    run_jobs()
    logo = Item.objects.get(pk=data["id"]).image_path
    with Image.open(tmp_path / logo) as image:
        assert (image.format, image.size) == ("WEBP", (180, 180))  # the site's icon, not its banner
    assert asked(tool_site) == ["tool.test/", "tool.test/touch.png"]
    assert Job.objects.get().status == "done"
    # a tool that gets a link later queues its logo too, while it has none
    later = a_tool(client, source="man semgrep")
    patched = send(client, "patch", f"/api/items/{later.pk}", {"source": "https://tool.test/"}, headers)
    assert patched.json()["imagePending"] is True
    with_logo = send(client, "patch", f"/api/items/{data['id']}", {"source": "https://tool.test/v2"}, headers)
    assert with_logo.json()["imagePending"] is False


def test_a_tool_on_request_takes_its_sites_logo_or_the_image_linked(
    client: Client, tool_site: FakeNet, tmp_path: Path
) -> None:
    item = a_tool(client)
    response = fetch(client, item)
    assert response.status_code == 202 and response.json()["imagePending"] is True
    run_jobs()
    first = Item.objects.get(pk=item.pk).image_path
    assert first and asked(tool_site) == ["tool.test/", "tool.test/touch.png"]
    # a link to an image is the logo itself, at most LOGO_SIZE px
    tool_site.site("cdn.test", PUBLIC, files({"/logo.png": ("image/png", icon_bytes((512, 512), "blue"))}))
    fetch(client, Item.objects.get(pk=item.pk), url="https://cdn.test/logo.png")
    run_jobs()
    second = Item.objects.get(pk=item.pk).image_path
    with Image.open(tmp_path / second) as image:
        assert second != first and image.size == (thumbnails.LOGO_SIZE, thumbnails.LOGO_SIZE)


def test_a_tool_whose_site_has_no_icon_ends_without_one(client: Client, net: FakeNet) -> None:
    net.site("bare.test", PUBLIC, files({"/": ("text/html", "<title>Bare</title>")}))
    item = a_tool(client, source="https://bare.test/")
    fetch(client, item)
    run_jobs()
    assert Job.objects.get().status == "done" and Item.objects.get(pk=item.pk).image_path == ""
    assert asked(net) == ["bare.test/", "bare.test/apple-touch-icon.png", "bare.test/favicon.ico"]


def test_a_tools_logo_is_retried_after_a_network_error(client: Client, net: FakeNet) -> None:
    net.site("down.test", PUBLIC, lambda r: httpx.Response(503))
    item = a_tool(client, source="https://down.test/")
    fetch(client, item)
    run_jobs()
    job = Job.objects.get()
    assert (job.status, job.attempts) == ("pending", 1) and job.last_error.startswith("FetchError")


def github_api(remaining: int, reset: dt.datetime | None = None) -> Route:
    """api.github.com refusing every repository (403), its /rate_limit saying how many requests remain."""
    core: dict[str, Any] = {"limit": 60, "remaining": remaining}
    if reset is not None:
        core["reset"] = int(reset.timestamp())

    def answer(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/rate_limit":
            return httpx.Response(200, json={"resources": {"core": core}})
        return httpx.Response(403)

    return answer


def test_the_github_limit_holds_only_the_repositories_until_it_resets(
    client: Client, net: FakeNet, monkeypatch: pytest.MonkeyPatch
) -> None:
    reset = timezone.now() + dt.timedelta(minutes=40)
    net.site("api.github.com", PUBLIC, github_api(remaining=0, reset=reset))
    repositories = [a_tool(client, source=f"https://github.com/acme/t{n}") for n in range(3)]
    other = book(client)  # queued after them
    for item in (*repositories, other):
        fetch(client, item)
    run_jobs()
    assert Item.objects.get(pk=other.pk).image_path  # the book's image comes in the same run
    for item in repositories:  # no attempt counted: they wait until the limit resets
        job = Job.objects.get(key=f"item_image:{item.pk}")
        assert (job.status, job.attempts) == ("pending", 0) and "limit used up" in job.last_error
        assert reset < job.run_after < reset + dt.timedelta(minutes=1)
    # the limit is asked about once; the other repositories wait without a request
    api_paths = [r.url.path for r in net.requests if r.headers["host"] == "api.github.com"]
    assert api_paths == ["/repos/acme/t0", "/rate_limit"]
    asked_before = len(net.requests)
    run_jobs()  # the next run, before the reset: nothing is due
    assert len(net.requests) == asked_before and Job.objects.filter(status="pending").count() == 3
    # after the reset (a later run_jobs process): the repositories are asked again
    monkeypatch.setattr(logos, "_limit_resets_at", None)
    net.site("api.github.com", PUBLIC, files({}))  # gone: no logo, final
    Job.objects.filter(status="pending").update(run_after=timezone.now())
    run_jobs()
    assert set(Job.objects.values_list("status", flat=True)) == {"done"}


def test_a_github_refusal_that_is_not_the_limit_ends_after_three_attempts(
    client: Client, net: FakeNet
) -> None:
    """A repository GitHub blocks (403 while requests remain) never waits for ever, nor holds the others."""
    net.site("api.github.com", PUBLIC, github_api(remaining=57))
    blocked = a_tool(client, source="https://github.com/acme/blocked")
    fetch(client, blocked)
    for expected in ("pending", "pending", "failed"):
        Job.objects.filter(status="pending").update(run_after=timezone.now())
        run_jobs()
        job = Job.objects.get(key=f"item_image:{blocked.pk}")
        assert job.status == expected
    assert (job.attempts, job.last_error) == (3, "FetchError: HTTP 403")
    assert client.get(f"/api/items/{blocked.pk}").json()["imagePending"] is False


def test_an_upload_while_a_tools_logo_waits_wins(
    client: Client, tool_site: FakeNet, django_capture_on_commit_callbacks: Any
) -> None:
    item = a_tool(client)
    fetch(client, item)
    assert upload(client, item, "blue")["imagePending"] is False
    uploaded = Item.objects.get(pk=item.pk).image_path
    with django_capture_on_commit_callbacks(execute=True):
        run_jobs()
    assert tool_site.requests == [] and Item.objects.get(pk=item.pk).image_path == uploaded


def test_linking_an_inbox_entry_leaves_a_tools_logo_fetch_alone(
    client: Client, tool_site: FakeNet, tmp_path: Path
) -> None:
    """'Thành item' with a tool: the entry's thumbnail is the page's banner, never the tool's logo, so the
    link copies nothing and the logo fetch the create queued goes on."""
    headers = csrf(client)
    thumbnail = thumbnails.store(thumbnails.to_webp(image_bytes((1600, 900), "green")))
    entry = InboxEntry.objects.create(user=owner(client), url="https://tool.test/", og_image_path=thumbnail)
    body = {"type": "tool", "title": "Semgrep", "source": "https://tool.test/"}
    item = send(client, "post", "/api/items", body, headers).json()
    send(client, "patch", f"/api/inbox/{entry.pk}", {"item": item["id"]}, headers)
    data = client.get(f"/api/items/{item['id']}").json()
    assert (data["imageUrl"], data["imagePending"]) == (None, True)
    run_jobs()
    logo = Item.objects.get(pk=item["id"]).image_path
    with Image.open(tmp_path / logo) as image:
        assert image.size == (180, 180)
