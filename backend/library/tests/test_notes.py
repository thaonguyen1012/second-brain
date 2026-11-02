import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.testing import csrf, send
from library.models import Item, Note

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def note(user: User, title: str, markdown: str = "body", items: list[Item] | None = None) -> Note:
    row = Note.objects.create(user=user, title=title, markdown=markdown)
    row.items.set(items or [])
    return row


def test_create_note(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Deep Work")
    film = Item.objects.create(user=user, type="film", title="Dune")
    body = {"title": "Ý chính", "markdown": "# Deep Work\n\n- focus\n", "items": [film.pk, book.pk, book.pk]}
    response = send(client, "post", "/api/notes", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["title"], data["markdown"]) == ("Ý chính", "# Deep Work\n\n- focus\n")
    assert data["items"] == sorted([book.pk, film.pk]) and data["createdAt"] and data["updatedAt"]
    # Markdown is required; another user's Item or an unknown id is refused.
    foreign = Item.objects.create(user=stranger(), type="book", title="x")
    assert send(client, "post", "/api/notes", {"title": "only a title"}, headers).status_code == 400
    for items in ([foreign.pk], [999_999]):
        assert (
            send(client, "post", "/api/notes", {"markdown": "x", "items": items}, headers).status_code == 400
        )
    assert Note.objects.count() == 1


def test_list_notes_searches_and_filters(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="book", title="Deep Work")
    other = Item.objects.create(user=user, type="book", title="Atomic Habits")
    for i in range(4):
        note(user, f"n{i}", items=[item, other])
    note(user, "Focus", "about **deep** work", [item])
    note(user, "Habits", "tiny changes", [other])
    note(stranger(), "deep secret", "deep")
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/notes?limit=3").json()
    assert len(queries) <= 4  # session + user + page + one prefetch of the items
    assert [n["title"] for n in data["results"]] == ["Habits", "Focus", "n3"]
    assert data["results"][2]["items"] == sorted([item.pk, other.pk])
    # Labels of the linked Items come with the note (same prefetch), so lists never load every Item.
    labels = {(row["id"], row["title"], row["type"]) for row in data["results"][2]["itemLabels"]}
    assert labels == {(item.pk, "Deep Work", "book"), (other.pk, "Atomic Habits", "book")}
    assert [n["title"] for n in client.get(data["next"]).json()["results"]] == ["n2", "n1", "n0"]
    assert [n["title"] for n in client.get("/api/notes?q=DEEP").json()["results"]] == ["Focus"]
    assert [n["title"] for n in client.get("/api/notes?q=habits").json()["results"]] == ["Habits"]
    assert [n["title"] for n in client.get(f"/api/notes?item={item.pk}&q=n").json()["results"]] == [
        "n3",
        "n2",
        "n1",
        "n0",
    ]
    assert client.get(f"/api/notes?item={other.pk}").json()["results"][0]["title"] == "Habits"
    assert client.get("/api/notes?item=abc").status_code == 400


def test_get_note(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="article", title="t")
    row = note(user, "Mine", "text", [item])
    data = client.get(f"/api/notes/{row.pk}").json()
    assert (data["id"], data["title"], data["markdown"], data["items"]) == (row.pk, "Mine", "text", [item.pk])
    assert client.get(f"/api/notes/{note(stranger(), 'theirs').pk}").status_code == 404
    assert client.get("/api/notes/999999").status_code == 404


def test_update_note(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    first = Item.objects.create(user=user, type="book", title="a")
    second = Item.objects.create(user=user, type="book", title="b")
    row = note(user, "Old", "old body", [first])
    response = send(client, "patch", f"/api/notes/{row.pk}", {"title": "New"}, headers)
    assert response.status_code == 200
    assert (response.json()["title"], response.json()["markdown"], response.json()["items"]) == (
        "New",
        "old body",
        [first.pk],
    )
    data = send(client, "patch", f"/api/notes/{row.pk}", {"items": [second.pk]}, headers).json()
    assert data["items"] == [second.pk]
    assert send(client, "patch", f"/api/notes/{row.pk}", {"items": []}, headers).json()["items"] == []
    foreign = Item.objects.create(user=stranger(), type="book", title="x")
    assert send(client, "patch", f"/api/notes/{row.pk}", {"items": [foreign.pk]}, headers).status_code == 400
    assert send(client, "patch", f"/api/notes/{row.pk}", {"markdown": ""}, headers).status_code == 400
    theirs = note(stranger(), "theirs")
    assert send(client, "patch", f"/api/notes/{theirs.pk}", {"title": "mine"}, headers).status_code == 404
    assert Note.objects.get(pk=theirs.pk).title == "theirs"


def test_notes_require_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/notes").status_code == 401
    assert anon_client.get("/api/notes/1").status_code == 401
    assert send(anon_client, "post", "/api/notes", {"markdown": "x"}, {}).status_code == 401
    assert send(anon_client, "patch", "/api/notes/1", {"title": "x"}, {}).status_code == 401
    assert Note.objects.count() == 0


def test_notes_require_csrf(client: Client) -> None:
    row = note(owner(client), "keep")
    assert send(client, "post", "/api/notes", {"markdown": "x"}, {}).status_code == 403
    assert send(client, "patch", f"/api/notes/{row.pk}", {"title": "x"}, {}).status_code == 403
    assert Note.objects.count() == 1 and Note.objects.get().title == "keep"
