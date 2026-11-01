import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.testing import csrf, send
from library.models import Item

pytestmark = pytest.mark.django_db


def test_create_item(client: Client) -> None:
    body = {"type": "book", "title": "Deep Work", "tags": [" Focus ", "focus", "Productivity"], "rating": 9}
    response = send(client, "post", "/api/items", body, csrf(client))
    assert response.status_code == 201
    data = response.json()
    assert (data["type"], data["status"], data["title"]) == ("book", "planned", "Deep Work")
    assert data["tags"] == ["focus", "productivity"]
    assert data["createdAt"] and data["startedAt"] is None


def test_create_item_rejects_bad_values(client: Client) -> None:
    headers = csrf(client)
    assert send(client, "post", "/api/items", {"type": "song", "title": "x"}, headers).status_code == 400
    assert (
        send(client, "post", "/api/items", {"type": "book", "title": "x", "rating": 11}, headers).status_code
        == 400
    )
    assert send(client, "post", "/api/items", {"type": "book"}, headers).status_code == 400


def test_list_items_filters_and_paginates(client: Client) -> None:
    user = User.objects.create(username="other@x", email="other@x")
    client.get("/api/me")
    owner = User.objects.get(username="dev@localhost")
    Item.objects.bulk_create(
        [Item(user=owner, type="book", title=f"b{i}") for i in range(3)]
        + [Item(user=owner, type="film", title="f", status="done"), Item(user=user, type="book", title="x")]
    )
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/items?limit=2").json()
    assert len(queries) <= 4  # session + user + page, no per-row queries
    assert [i["title"] for i in data["results"]] == ["f", "b2"]
    assert data["next"] and data["previous"] is None
    assert [i["title"] for i in client.get(data["next"]).json()["results"]] == ["b1", "b0"]
    assert [i["title"] for i in client.get("/api/items?type=film&status=done").json()["results"]] == ["f"]


def test_update_item(client: Client) -> None:
    headers = csrf(client)
    item_id = send(client, "post", "/api/items", {"type": "film", "title": "Dune"}, headers).json()["id"]
    body = {"status": "done", "rating": 8, "finishedAt": "2026-11-01T20:00:00Z"}
    response = send(client, "patch", f"/api/items/{item_id}", body, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["status"], data["rating"], data["title"]) == ("done", 8, "Dune")
    assert data["finishedAt"].startswith("2026-11-01")
    assert send(client, "patch", "/api/items/999999", body, headers).status_code == 404


def test_items_require_auth_and_csrf(client: Client, anon_client: Client) -> None:
    assert anon_client.get("/api/items").status_code == 401
    assert send(anon_client, "post", "/api/items", {"type": "book", "title": "x"}, {}).status_code == 401


def test_items_requires_csrf(client: Client) -> None:
    client.get("/api/me")
    assert send(client, "post", "/api/items", {"type": "book", "title": "x"}, {}).status_code == 403
