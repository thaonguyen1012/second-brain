import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from growth.models import Skill, SkillEvidence
from library.models import Item
from opportunities.models import Evidence, Opportunity

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def opportunity(user: User, title: str) -> Opportunity:
    return Opportunity.objects.create(user=user, title=title, hypothesis="h")


def item_evidence(opp: Opportunity, item: Item | None, stance: str, day: str, title: str = "") -> Evidence:
    return Evidence.objects.create(
        opportunity=opp,
        kind="item",
        item=item,
        stance=stance,
        title=title or (item.title if item else "gone"),
        date=dt.date.fromisoformat(day),
    )


def skill_evidence(skill: Skill, item: Item | None, day: str, title: str = "") -> SkillEvidence:
    return SkillEvidence.objects.create(
        skill=skill, kind="item", item=item, title=title or "shipped", date=dt.date.fromisoformat(day)
    )


def test_item_mentions_lists_opportunities_with_stance_and_skills_with_freshness(client: Client) -> None:
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")
    other = Item.objects.create(user=user, type="book", title="Deep Work")
    habits = opportunity(user, "Habit coach")
    bakery = opportunity(user, "Bakery stock")
    item_evidence(habits, book, "supports", "2026-10-01", "chapter 3")
    item_evidence(bakery, book, "contradicts", "2026-11-02")
    item_evidence(habits, book, "contradicts", "2026-11-05", "chapter 9")
    item_evidence(bakery, other, "supports", "2026-11-06")  # another Item: not listed
    django = Skill.objects.create(user=user, name="Django", key="django")
    writing = Skill.objects.create(user=user, name="Writing", key="writing")
    skill_evidence(django, book, "2026-09-01")
    skill_evidence(django, other, "2026-11-01")  # freshness counts every evidence row of the skill
    skill_evidence(writing, book, "2025-01-10")

    data = client.get(f"/api/items/{book.pk}/mentions").json()

    # newest evidence first: Habit coach (05/11) before Bakery stock (02/11); its rows newest first too
    assert [o["title"] for o in data["opportunities"]] == ["Habit coach", "Bakery stock"]
    assert data["opportunities"][0]["decision"] == "open"
    assert [(e["title"], e["stance"], e["date"]) for e in data["opportunities"][0]["evidence"]] == [
        ("chapter 9", "contradicts", "2026-11-05"),
        ("chapter 3", "supports", "2026-10-01"),
    ]
    assert [e["stance"] for e in data["opportunities"][1]["evidence"]] == ["contradicts"]
    assert [(s["name"], len(s["evidence"])) for s in data["skills"]] == [("Django", 1), ("Writing", 1)]
    assert data["skills"][1]["freshness"] == "faded"
    assert set(data["skills"][0]) == {"id", "name", "freshness", "evidence"}
    assert set(data["skills"][0]["evidence"][0]) == {"id", "title", "note", "date"}


def test_item_mentions_are_empty_for_an_unused_item_and_ignore_unlinked_evidence(client: Client) -> None:
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Unused")
    item_evidence(opportunity(user, "Old"), None, "supports", "2026-10-01")  # its Item was deleted
    assert client.get(f"/api/items/{book.pk}/mentions").json() == {
        "opportunities": [],
        "skills": [],
        "notes": [],
    }


def test_item_mentions_are_owner_only(client: Client) -> None:
    owner(client)
    theirs = Item.objects.create(user=stranger(), type="book", title="Not yours")
    item_evidence(opportunity(stranger(), "Theirs"), theirs, "supports", "2026-10-01")
    assert client.get(f"/api/items/{theirs.pk}/mentions").status_code == 404
    assert client.get("/api/items/999999/mentions").status_code == 404


def test_item_mentions_need_a_login(anon_client: Client) -> None:
    assert anon_client.get("/api/items/1/mentions").status_code == 401


def test_item_mentions_use_the_same_queries_for_one_row_or_many(client: Client) -> None:
    user = owner(client)
    book = Item.objects.create(user=user, type="book", title="Atomic Habits")

    def queries() -> int:
        with CaptureQueriesContext(connection) as captured:
            assert client.get(f"/api/items/{book.pk}/mentions").status_code == 200
        return len(captured)

    item_evidence(opportunity(user, "o0"), book, "supports", "2026-10-01")
    skill_evidence(Skill.objects.create(user=user, name="s0", key="s0"), book, "2026-10-01")
    few = queries()
    for i in range(1, 6):
        item_evidence(opportunity(user, f"o{i}"), book, "supports", "2026-10-01")
        skill_evidence(Skill.objects.create(user=user, name=f"s{i}", key=f"s{i}"), book, "2026-10-01")
    assert queries() == few
