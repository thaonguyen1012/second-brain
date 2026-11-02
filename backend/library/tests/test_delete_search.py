import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.testing import csrf, send
from growth.models import Achievement, Skill, SkillEvidence
from inbox.models import InboxEntry
from library.models import Item, Note
from opportunities.models import Evidence, Opportunity
from work.models import ProjectDetails, TimeEntry

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def test_list_items_note_count_and_search_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    deep = Item.objects.create(user=user, type="book", title="Deep Work", source="Cal Newport")
    Item.objects.create(user=user, type="film", title="Dune", source="Villeneuve")
    Item.objects.create(user=user, type="article", title="Attention", tags=["deep focus"])
    Item.objects.create(user=stranger(), type="book", title="Deep Learning")
    for i in range(3):
        Note.objects.create(user=user, markdown=f"n{i}").items.add(deep)
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/items").json()["results"]
    assert len(queries) <= 4  # session + user + page (note count annotated)
    assert {i["title"]: i["noteCount"] for i in data} == {"Deep Work": 3, "Dune": 0, "Attention": 0}

    def titles(query: str) -> list[str]:
        return [i["title"] for i in client.get("/api/items", {"q": query}).json()["results"]]

    assert titles("deep") == ["Deep Work"]  # never another owner's item
    assert titles("  NEWPORT ") == ["Deep Work"]  # source, case-insensitive
    assert titles("Deep focus") == ["Attention"]  # one exact tag
    assert titles("n0") == []  # never the note markdown
    assert client.get("/api/items", {"q": "dune", "type": "book"}).json()["results"] == []


def test_create_and_update_item_answer_note_count(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    created = send(client, "post", "/api/items", {"type": "book", "title": "x"}, headers).json()
    assert created["noteCount"] == 0
    Note.objects.create(user=user, markdown="m").items.add(created["id"])
    updated = send(client, "patch", f"/api/items/{created['id']}", {"status": "active"}, headers).json()
    assert updated["noteCount"] == 1 and updated["status"] == "active"


def test_delete_item_keeps_linked_rows(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="project", title="Shop")
    ProjectDetails.objects.create(item=item, client="ACME")
    note = Note.objects.create(user=user, markdown="m")
    note.items.add(item)
    entry = InboxEntry.objects.create(user=user, text="idea", item=item)
    opportunity = Opportunity.objects.create(user=user, title="o", hypothesis="h")
    proof = Evidence.objects.create(
        opportunity=opportunity, kind="item", stance="supports", item=item, title="Shop"
    )
    skill = Skill.objects.create(user=user, name="Python", key="python")
    skill_proof = SkillEvidence.objects.create(skill=skill, kind="item", item=item, title="Shop")
    win = Achievement.objects.create(user=user, title="Shipped", project=item)
    headers = csrf(client)
    assert client.delete(f"/api/items/{item.pk}", headers=headers).status_code == 204
    assert client.delete(f"/api/items/{item.pk}", headers=headers).status_code == 404
    assert not Item.objects.exists() and not ProjectDetails.objects.exists()
    assert list(Note.objects.get(pk=note.pk).items.all()) == []
    assert InboxEntry.objects.get(pk=entry.pk).item is None
    proof.refresh_from_db()
    skill_proof.refresh_from_db()
    win.refresh_from_db()
    assert (proof.item, proof.title, skill_proof.item, win.project) == (None, "Shop", None, None)
    assert client.get(f"/api/opportunities/{opportunity.pk}").json()["evidence"][0]["title"] == "Shop"


def test_delete_project_with_time_entries_is_refused(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="project", title="Shop")
    TimeEntry.objects.create(user=user, project=item, date=dt.date(2026, 11, 2), minutes=30)
    response = client.delete(f"/api/items/{item.pk}", headers=csrf(client))
    assert response.status_code == 409 and "giờ làm" in response.json()["detail"]
    assert Item.objects.filter(pk=item.pk).exists() and TimeEntry.objects.count() == 1


def test_delete_note_keeps_evidence(client: Client) -> None:
    user = owner(client)
    note = Note.objects.create(user=user, title="Interview", markdown="m")
    opportunity = Opportunity.objects.create(user=user, title="o", hypothesis="h")
    proof = Evidence.objects.create(
        opportunity=opportunity, kind="note", stance="supports", library_note=note, title="Interview"
    )
    headers = csrf(client)
    assert client.delete(f"/api/notes/{note.pk}", headers=headers).status_code == 204
    assert client.get(f"/api/notes/{note.pk}").status_code == 404
    proof.refresh_from_db()
    assert proof.library_note is None and proof.title == "Interview"


def test_delete_another_owners_item_or_note_answers_404(client: Client) -> None:
    other = stranger()
    item = Item.objects.create(user=other, type="book", title="theirs")
    note = Note.objects.create(user=other, markdown="theirs")
    headers = csrf(client)
    assert client.delete(f"/api/items/{item.pk}", headers=headers).status_code == 404
    assert client.delete(f"/api/notes/{note.pk}", headers=headers).status_code == 404
    assert Item.objects.filter(pk=item.pk).exists() and Note.objects.filter(pk=note.pk).exists()


def test_deletes_require_csrf(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="book", title="x")
    note = Note.objects.create(user=user, markdown="m")
    assert client.delete(f"/api/items/{item.pk}").status_code == 403
    assert client.delete(f"/api/notes/{note.pk}").status_code == 403
    assert Item.objects.count() == 1 and Note.objects.count() == 1


def test_deletes_require_auth(anon_client: Client) -> None:
    for url in ("/api/items/1", "/api/notes/1"):
        assert anon_client.delete(url).status_code == 401
    assert anon_client.get("/api/items?q=x").status_code == 401
