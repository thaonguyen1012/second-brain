import uuid

import pytest
from django.contrib.auth.models import User
from django.test import Client

from core.testing import csrf, send
from library import services
from library.models import Item, Note

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def test_a_create_sent_again_with_its_client_id_answers_the_same_note(client: Client) -> None:
    """The editor's create may leave twice (a save sent as the page closed, then a restored copy)."""
    headers = csrf(client)
    owner(client)
    key = str(uuid.uuid4())
    first = send(client, "post", "/api/notes", {"markdown": "Một", "clientId": key}, headers)
    again = send(client, "post", "/api/notes", {"markdown": "Một hai", "clientId": key}, headers)
    assert first.status_code == 201 and again.status_code == 200
    assert again.json()["id"] == first.json()["id"]
    # the second create changes nothing: the editor then sends its newer text with a PATCH
    assert again.json()["markdown"] == "Một"
    assert Note.objects.count() == 1
    other = send(client, "post", "/api/notes", {"markdown": "Khác", "clientId": str(uuid.uuid4())}, headers)
    assert other.status_code == 201 and Note.objects.count() == 2
    plain = send(client, "post", "/api/notes", {"markdown": "Không id"}, headers)
    assert plain.status_code == 201 and Note.objects.count() == 3


def test_a_create_answers_one_time_for_created_and_updated(client: Client) -> None:
    """A create sent again answers 200 with the note: updatedAt == createdAt says nobody edited it
    since (the editor goes on from it), a later edit makes them differ (it shows that version)."""
    headers = csrf(client)
    owner(client)
    key = str(uuid.uuid4())
    made = send(client, "post", "/api/notes", {"markdown": "Một", "clientId": key}, headers).json()
    assert made["createdAt"] == made["updatedAt"]
    plain = send(client, "post", "/api/notes", {"markdown": "Không id"}, headers).json()
    assert plain["createdAt"] == plain["updatedAt"]
    again = send(client, "post", "/api/notes", {"markdown": "Một hai", "clientId": key}, headers)
    assert again.status_code == 200 and again.json()["updatedAt"] == again.json()["createdAt"]
    # the version the create answered is the one an edit starts from
    url = f"/api/notes/{made['id']}"
    edited = send(client, "patch", url, {"markdown": "Một ba", "baseUpdatedAt": made["updatedAt"]}, headers)
    assert edited.status_code == 200 and edited.json()["updatedAt"] != edited.json()["createdAt"]
    later = send(client, "post", "/api/notes", {"markdown": "Một hai", "clientId": key}, headers).json()
    assert later["markdown"] == "Một ba" and later["updatedAt"] != later["createdAt"]


def test_client_ids_belong_to_one_owner(client: Client) -> None:
    headers = csrf(client)
    owner(client)
    stranger = User.objects.create(username="other@x")
    key = uuid.uuid4()
    Note.objects.create(user=stranger, markdown="của người khác", client_id=key)
    mine = send(client, "post", "/api/notes", {"markdown": "của tôi", "clientId": str(key)}, headers)
    assert mine.status_code == 201 and mine.json()["markdown"] == "của tôi"


def test_the_list_finds_the_note_a_client_id_made(client: Client) -> None:
    """The editor asks whether a create sent as a page closed arrived: its copy then belongs to that note."""
    headers = csrf(client)
    user = owner(client)
    key = uuid.uuid4()
    made = send(client, "post", "/api/notes", {"markdown": "Viết, đóng tab", "clientId": str(key)}, headers)
    send(client, "post", "/api/notes", {"markdown": "Khác", "clientId": str(uuid.uuid4())}, headers)
    found = client.get(f"/api/notes?clientId={key}").json()["results"]
    assert [n["id"] for n in found] == [made.json()["id"]]
    # a create that never arrived: no note; another owner's client id: no note either
    assert client.get(f"/api/notes?clientId={uuid.uuid4()}").json()["results"] == []
    stranger = User.objects.create(username="other@x")
    theirs = uuid.uuid4()
    Note.objects.create(user=stranger, markdown="của người khác", client_id=theirs)
    assert client.get(f"/api/notes?clientId={theirs}").json()["results"] == []
    assert client.get("/api/notes?clientId=abc").status_code == 400
    assert Note.objects.filter(user=user).count() == 2


def test_an_edit_started_from_an_older_version_answers_409(client: Client) -> None:
    """Another tab or device saved the note since: nothing is written, the answer carries the note now."""
    headers = csrf(client)
    owner(client)
    note = send(client, "post", "/api/notes", {"markdown": "Gốc."}, headers).json()
    base = note["updatedAt"]
    url = f"/api/notes/{note['id']}"
    elsewhere = send(client, "patch", url, {"markdown": "Viết ở tab B.", "baseUpdatedAt": base}, headers)
    assert elsewhere.status_code == 200
    stale = send(client, "patch", url, {"markdown": "Gốc. Thêm ở tab A.", "baseUpdatedAt": base}, headers)
    assert stale.status_code == 409
    body = stale.json()
    assert body["note"]["markdown"] == "Viết ở tab B." and body["detail"]
    assert Note.objects.get(pk=note["id"]).markdown == "Viết ở tab B."
    # from the version it now has, the edit goes through; without a base it always does
    fresh = send(
        client,
        "patch",
        f"/api/notes/{note['id']}",
        {"markdown": "Viết ở tab B. Và A.", "baseUpdatedAt": body["note"]["updatedAt"]},
        headers,
    )
    assert fresh.status_code == 200
    assert send(client, "patch", f"/api/notes/{note['id']}", {"title": "T"}, headers).status_code == 200


def test_saving_the_items_never_puts_back_older_text(client: Client) -> None:
    """Two saves of one note that cross (the text, then the Items read before it) keep the newer text."""
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Deep Work")
    note = services.save_note(Note(user=user), {"title": "", "markdown": "Cũ"})
    stale = Note.objects.get(pk=note.pk)  # loaded before the text save below
    services.save_note(Note.objects.get(pk=note.pk), {"markdown": f"Mới [B](/thu-vien/item/?id={book.pk})"})
    services.save_note(stale, {"items": []})
    again = Note.objects.get(pk=note.pk)
    assert again.markdown.startswith("Mới")
    # the links come from the text as it is now: the Item the text links stays linked
    assert list(again.items.all()) == [book]
