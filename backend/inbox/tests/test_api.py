from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.test import Client
from PIL import Image

from core.services import thumbnails
from core.testing import csrf, image_bytes, send
from inbox.models import InboxEntry
from library.models import Item

pytestmark = pytest.mark.django_db


def test_create_entry_returns_at_once(client: Client) -> None:
    response = send(client, "post", "/api/inbox", {"url": "https://example.com/a"}, csrf(client))
    assert response.status_code == 201
    data = response.json()
    assert (data["url"], data["status"], data["processed"]) == ("https://example.com/a", "inbox", False)
    assert data["thumbnailUrl"] is None and data["suggestedTags"] == []


def test_create_entry_validation(client: Client) -> None:
    headers = csrf(client)
    assert send(client, "post", "/api/inbox", {"text": "an idea"}, headers).status_code == 201
    assert send(client, "post", "/api/inbox", {}, headers).status_code == 400
    assert send(client, "post", "/api/inbox", {"url": "", "text": " "}, headers).status_code == 400
    for url in ("ftp://example.com/x", "file:///etc/passwd", "javascript:alert(1)", "not a url"):
        assert send(client, "post", "/api/inbox", {"url": url}, headers).status_code == 400
    # Read-only fields are ignored on create.
    body = {"text": "x", "processed": True, "summary": "forged", "status": "archived"}
    data = send(client, "post", "/api/inbox", body, headers).json()
    assert (data["processed"], data["summary"], data["status"]) == (False, "", "inbox")


def test_list_entries(client: Client) -> None:
    client.get("/api/me")
    owner = User.objects.get(username="dev@localhost")
    other = User.objects.create(username="other@x", email="other@x")
    item = Item.objects.create(user=owner, type="article", title="t")
    InboxEntry.objects.create(user=owner, text="one", item=item)
    InboxEntry.objects.create(user=owner, text="two", status="later")
    InboxEntry.objects.create(user=other, text="not mine")
    data = client.get("/api/inbox").json()
    assert [e["text"] for e in data["results"]] == ["two", "one"]
    assert data["results"][1]["item"] == item.pk
    # The linked Item's label comes with the entry; null without a link.
    assert (data["results"][1]["itemTitle"], data["results"][1]["itemType"]) == ("t", "article")
    assert (data["results"][0]["itemTitle"], data["results"][0]["itemType"]) == (None, None)
    assert [e["text"] for e in client.get("/api/inbox?status=later").json()["results"]] == ["two"]


def test_triage_entry(client: Client) -> None:
    headers = csrf(client)
    entry_id = send(client, "post", "/api/inbox", {"text": "book idea"}, headers).json()["id"]
    item_id = send(client, "post", "/api/items", {"type": "book", "title": "B"}, headers).json()["id"]
    response = send(
        client, "patch", f"/api/inbox/{entry_id}", {"status": "archived", "item": item_id}, headers
    )
    assert response.status_code == 200
    assert (response.json()["status"], response.json()["item"]) == ("archived", item_id)
    # Only status and item can change; a foreign item is refused.
    other = User.objects.create(username="other@x", email="other@x")
    foreign = Item.objects.create(user=other, type="book", title="x")
    assert send(client, "patch", f"/api/inbox/{entry_id}", {"item": foreign.pk}, headers).status_code == 400
    assert send(client, "patch", f"/api/inbox/{entry_id}", {"status": "gone"}, headers).status_code == 400
    send(client, "patch", f"/api/inbox/{entry_id}", {"text": "changed", "processed": True}, headers)
    entry = InboxEntry.objects.get(pk=entry_id)
    assert (entry.text, entry.processed, entry.item_id) == ("book idea", False, item_id)


def test_inbox_requires_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/inbox").status_code == 401
    assert send(anon_client, "post", "/api/inbox", {"text": "x"}, {}).status_code == 401
    assert send(anon_client, "patch", "/api/inbox/1", {"status": "later"}, {}).status_code == 401


def test_inbox_requires_csrf(client: Client) -> None:
    client.get("/api/me")
    assert send(client, "post", "/api/inbox", {"text": "x"}, {}).status_code == 403


def test_triage_sets_and_clears_archived_at(client: Client) -> None:
    headers = csrf(client)
    entry_id = send(client, "post", "/api/inbox", {"text": "read later"}, headers).json()["id"]
    assert client.get("/api/inbox").json()["results"][0]["archivedAt"] is None
    data = send(client, "patch", f"/api/inbox/{entry_id}", {"status": "archived"}, headers).json()
    archived_at = data["archivedAt"]
    assert archived_at
    # Staying archived (or only relinking) keeps the first archive time; leaving the archive clears it.
    item_id = send(client, "post", "/api/items", {"type": "article", "title": "A"}, headers).json()["id"]
    data = send(client, "patch", f"/api/inbox/{entry_id}", {"status": "archived", "item": item_id}, headers)
    assert data.json()["archivedAt"] == archived_at
    data = send(client, "patch", f"/api/inbox/{entry_id}", {"status": "later"}, headers).json()
    assert (data["status"], data["archivedAt"]) == ("later", None)
    data = send(client, "patch", f"/api/inbox/{entry_id}", {"status": "archived"}, headers).json()
    assert data["archivedAt"] and data["archivedAt"] >= archived_at


def test_linking_gives_the_item_its_own_copy_of_the_thumbnail(
    client: Client, settings: Any, tmp_path: Path
) -> None:
    settings.THUMBS_DIR = tmp_path
    client.get("/api/me")
    user = User.objects.get(username="dev@localhost")
    thumbnail = thumbnails.store(thumbnails.to_webp(image_bytes((1600, 900))))  # an inbox card, 1200 px
    entry = InboxEntry.objects.create(user=user, url="https://blog.test/p", og_image_path=thumbnail)
    headers = csrf(client)
    item_id = send(client, "post", "/api/items", {"type": "article", "title": "A post"}, headers).json()["id"]

    send(client, "patch", f"/api/inbox/{entry.pk}", {"item": item_id}, headers)
    copy = Item.objects.get(pk=item_id).image_path
    assert copy and copy != thumbnail  # re-encoded: the Item's own, lighter file
    with Image.open(tmp_path / copy) as image:
        assert max(image.size) == thumbnails.ITEM_SIZES[0]
    assert (tmp_path / thumbnail).is_file()  # the entry keeps its card
    expected = f"/api/items/{item_id}/image?v={copy[:8]}"
    assert client.get(f"/api/items/{item_id}").json()["imageUrl"] == expected

    # An Item that has an image keeps it; an entry without a thumbnail gives nothing.
    pictured = Item.objects.create(user=user, type="book", title="B", image_path="d" * 32 + ".webp")
    send(client, "patch", f"/api/inbox/{entry.pk}", {"item": pictured.pk}, headers)
    assert Item.objects.get(pk=pictured.pk).image_path == "d" * 32 + ".webp"
    bare = Item.objects.create(user=user, type="book", title="C")
    text = InboxEntry.objects.create(user=user, text="an idea")
    send(client, "patch", f"/api/inbox/{text.pk}", {"item": bare.pk, "status": "archived"}, headers)
    assert Item.objects.get(pk=bare.pk).image_path == ""


def test_linking_with_a_missing_or_unreadable_thumbnail_gives_no_image(
    client: Client, settings: Any, tmp_path: Path
) -> None:
    settings.THUMBS_DIR = tmp_path
    client.get("/api/me")
    user = User.objects.get(username="dev@localhost")
    broken = "f" * 32 + ".webp"
    (tmp_path / broken).write_bytes(b"webp")  # a file Pillow cannot read
    headers = csrf(client)
    for thumbnail in ("e" * 32 + ".webp", broken):  # not on disk; unreadable
        entry = InboxEntry.objects.create(user=user, url="https://blog.test/p", og_image_path=thumbnail)
        item = Item.objects.create(user=user, type="article", title=thumbnail)
        response = send(client, "patch", f"/api/inbox/{entry.pk}", {"item": item.pk}, headers)
        assert response.status_code == 200 and response.json()["item"] == item.pk
        assert Item.objects.get(pk=item.pk).image_path == ""
    assert {p.name for p in tmp_path.iterdir()} == {broken}
