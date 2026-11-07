"""One image per Item (DECISIONS 9.6): upload, read and remove through /api/items/{id}/image, and the
imageUrl / imagePending fields of every Item response."""

import io
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from PIL import Image

from core.models import Job
from core.services import thumbnails
from core.testing import csrf, image_bytes, send
from inbox.models import InboxEntry
from library.models import Item
from library.serializers import IMAGE_UNREADABLE, image_too_large

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def thumbs(settings: Any, tmp_path: Path) -> Path:
    settings.THUMBS_DIR = tmp_path
    return tmp_path


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def upload(
    client: Client, item_id: int, data: bytes, name: str = "cover.png", headers: dict[str, str] | None = None
) -> Any:
    file = SimpleUploadedFile(name, data, content_type="image/png")
    return client.post(
        f"/api/items/{item_id}/image", {"file": file}, headers=csrf(client) if headers is None else headers
    )


def files(folder: Path) -> set[str]:
    return {p.name for p in folder.iterdir()}


def test_upload_stores_a_light_webp_and_answers_the_item(client: Client, thumbs: Path) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    response = upload(client, item.pk, image_bytes((2400, 1200), fmt="JPEG"), name="dune.jpg")
    assert response.status_code == 200, response.json()
    data = response.json()
    item.refresh_from_db()
    assert data["imageUrl"] == f"/api/items/{item.pk}/image?v={item.image_path[:8]}"
    assert (data["id"], data["imagePending"], data["noteCount"]) == (item.pk, False, 0)
    stored = thumbs / item.image_path
    with Image.open(stored) as image:
        assert image.format == "WEBP" and max(image.size) == thumbnails.ITEM_SIZES[0]
    assert stored.stat().st_size <= thumbnails.MAX_BYTES

    image_response = client.get(data["imageUrl"])
    assert image_response.status_code == 200
    assert image_response["X-Accel-Redirect"] == f"/internal/thumbs/{item.image_path}"
    assert image_response["Content-Type"] == "image/webp"
    assert image_response["Cache-Control"] == "private, max-age=86400"
    assert client.get(f"/api/items/{item.pk}").json()["imageUrl"] == data["imageUrl"]


def test_replacing_changes_the_url_and_discards_only_unused_files(
    client: Client, thumbs: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    with django_capture_on_commit_callbacks(execute=True):
        first = upload(client, item.pk, image_bytes(color="red")).json()["imageUrl"]
    red = Item.objects.get(pk=item.pk).image_path
    # An inbox entry of another owner has the same file (content addressed): it stays.
    InboxEntry.objects.create(user=stranger(), url="https://a.test/", og_image_path=red)
    with django_capture_on_commit_callbacks(execute=True):
        second = upload(client, item.pk, image_bytes(color="blue")).json()["imageUrl"]
    blue = Item.objects.get(pk=item.pk).image_path
    assert second != first and blue != red
    assert files(thumbs) == {red, blue}
    # Another Item uses the blue file: replacing it keeps the file.
    Item.objects.create(user=stranger(), type="film", title="theirs", image_path=blue)
    with django_capture_on_commit_callbacks(execute=True):
        upload(client, item.pk, image_bytes(color="green"))
    green = Item.objects.get(pk=item.pk).image_path
    assert files(thumbs) == {red, blue, green}
    # A file nobody else uses goes with the replacement.
    with django_capture_on_commit_callbacks(execute=True):
        upload(client, item.pk, image_bytes(color="white"))
    assert green not in files(thumbs)


def test_delete_image_is_idempotent(
    client: Client, thumbs: Path, django_capture_on_commit_callbacks: Any
) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    upload(client, item.pk, image_bytes())
    name = Item.objects.get(pk=item.pk).image_path
    headers = csrf(client)
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"/api/items/{item.pk}/image", headers=headers).status_code == 204
    assert Item.objects.get(pk=item.pk).image_path == "" and name not in files(thumbs)
    assert client.delete(f"/api/items/{item.pk}/image", headers=headers).status_code == 204
    assert client.get(f"/api/items/{item.pk}").json()["imageUrl"] is None
    assert client.get(f"/api/items/{item.pk}/image").status_code == 404


def test_image_endpoints_answer_404_for_another_owner(client: Client, thumbs: Path) -> None:
    name = thumbnails.store(thumbnails.to_webp(image_bytes(), thumbnails.ITEM_SIZES))
    theirs = Item.objects.create(
        user=stranger(), type="book", title="theirs", source="https://a.test/", image_path=name
    )
    headers = csrf(client)
    url = f"/api/items/{theirs.pk}/image"
    assert client.get(url).status_code == 404
    assert upload(client, theirs.pk, image_bytes(color="blue"), headers=headers).status_code == 404
    assert client.delete(url, headers=headers).status_code == 404
    assert send(client, "post", f"{url}/fetch", {}, headers).status_code == 404
    assert Item.objects.get(pk=theirs.pk).image_path == name and files(thumbs) == {name}
    assert not Job.objects.exists()
    assert client.get("/api/items/999999/image").status_code == 404


def test_image_endpoints_require_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/items/1/image").status_code == 401
    file = SimpleUploadedFile("a.png", image_bytes(), content_type="image/png")
    assert anon_client.post("/api/items/1/image", {"file": file}).status_code == 401
    assert anon_client.delete("/api/items/1/image").status_code == 401
    assert send(anon_client, "post", "/api/items/1/image/fetch", {}, {}).status_code == 401


def test_image_writes_require_csrf(client: Client) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune", source="https://a.test/")
    assert upload(client, item.pk, image_bytes(), headers={}).status_code == 403
    assert client.delete(f"/api/items/{item.pk}/image").status_code == 403
    assert send(client, "post", f"/api/items/{item.pk}/image/fetch", {}, {}).status_code == 403
    assert Item.objects.get(pk=item.pk).image_path == "" and not Job.objects.exists()


def test_upload_takes_only_a_multipart_file(client: Client) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    headers = csrf(client)
    url = f"/api/items/{item.pk}/image"
    assert send(client, "post", url, {"file": "aGVsbG8="}, headers).status_code == 415
    response = client.post(url, {}, headers=headers)
    assert response.status_code == 400 and response.json() == {"file": ["Chọn một ảnh để tải lên."]}


def test_upload_refuses_big_files_svg_and_bombs(client: Client, settings: Any, thumbs: Path) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    assert image_too_large() == "Ảnh lớn hơn 10 MB."
    settings.ITEM_IMAGE_MAX_BYTES = 2**20
    # Refused on its size, before Pillow reads anything (these bytes are no image at all).
    response = upload(client, item.pk, b"x" * (2**20 + 1))
    assert response.status_code == 400 and response.json() == {"file": ["Ảnh lớn hơn 1 MB."]}

    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    response = upload(client, item.pk, svg, name="logo.svg")
    assert response.status_code == 400 and response.json() == {"file": [IMAGE_UNREADABLE]}
    # 8000 x 8000 pixels in a file of a few kB: Pillow refuses it on the header (decompression bomb).
    out = io.BytesIO()
    Image.new("1", (8000, 8000)).save(out, "PNG")
    assert len(out.getvalue()) < 100_000
    response = upload(client, item.pk, out.getvalue(), name="bomb.png")
    assert response.status_code == 400 and response.json() == {"file": [IMAGE_UNREADABLE]}
    assert Item.objects.get(pk=item.pk).image_path == "" and files(thumbs) == set()


def test_the_item_body_cannot_set_the_image(client: Client) -> None:
    item = Item.objects.create(user=owner(client), type="book", title="Dune")
    forged = "a" * 32 + ".webp"
    body = {"image_path": forged, "imagePath": forged, "imageUrl": "/x", "imagePending": True}
    data = send(client, "patch", f"/api/items/{item.pk}", body, csrf(client)).json()
    assert (data["imageUrl"], data["imagePending"]) == (None, False)
    created = send(client, "post", "/api/items", {"type": "film", "title": "x", **body}, csrf(client)).json()
    assert created["imageUrl"] is None
    assert set(Item.objects.values_list("image_path", flat=True)) == {""}


def test_an_insert_without_the_image_column_still_works(client: Client) -> None:
    # A Django process from before the image field (an unrestarted container) inserts Items without it.
    user = owner(client)
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO library_item (user_id, type, status, title, tags, source, created_at, updated_at) "
            "VALUES (%s, 'book', 'planned', 'Old code', '{}', '', now(), now()) RETURNING id",
            [user.pk],
        )
        row = cursor.fetchone()
    assert row is not None
    assert Item.objects.get(pk=row[0]).image_path == ""


def test_every_item_carries_image_fields_without_extra_queries(client: Client) -> None:
    user = owner(client)
    name = "b" * 32 + ".webp"
    plain = Item.objects.create(user=user, type="book", title="plain")
    pictured = Item.objects.create(user=user, type="book", title="pictured", image_path=name)
    states = {}
    for status in ("pending", "running", "done", "failed"):
        item = Item.objects.create(user=user, type="article", title=status)
        Job.objects.create(kind="item_image", key=f"item_image:{item.pk}", status=status)
        states[status] = item
    Job.objects.create(kind="unfurl", key=f"unfurl:{plain.pk}")  # another kind with the same number
    with CaptureQueriesContext(connection) as queries:
        rows = {i["title"]: i for i in client.get("/api/items").json()["results"]}
    assert len(queries) <= 4  # session + user + one page query (noteCount and imagePending annotated)
    assert {t: r["imagePending"] for t, r in rows.items()} == {
        "plain": False,
        "pictured": False,
        "pending": True,
        "running": True,
        "done": False,
        "failed": False,
    }
    assert rows["pictured"]["imageUrl"] == f"/api/items/{pictured.pk}/image?v=bbbbbbbb"
    assert rows["plain"]["imageUrl"] is None
    one = client.get(f"/api/items/{states['pending'].pk}").json()
    assert (one["imagePending"], one["imageUrl"]) == (True, None)
