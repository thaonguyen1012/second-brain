import pytest
from django.contrib.auth.models import User
from django.test import Client

from core.testing import csrf, send
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
