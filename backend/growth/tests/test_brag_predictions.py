import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.testing import csrf, send
from growth import services
from growth.models import Achievement, Prediction, Skill
from library.models import Item
from weeks.models import Week

pytestmark = pytest.mark.django_db

MON = dt.date(2026, 10, 26)


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def skill(user: User, name: str) -> Skill:
    return services.save_skill(Skill(user=user), {"name": name})


def achievement(user: User, title: str, date: dt.date = MON, **fields: object) -> Achievement:
    return Achievement.objects.create(user=user, title=title, date=date, **fields)


def prediction(user: User, statement: str, made_on: dt.date, **fields: object) -> Prediction:
    values: dict[str, object] = {"check_on": services.months_after(made_on, 6), **fields}
    return Prediction.objects.create(user=user, statement=statement, made_on=made_on, **values)


# --- Achievements -----------------------------------------------------------------------------------


def test_create_achievement(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    shop = Item.objects.create(user=user, type="project", title="Eshop")
    django, react = skill(user, "Django"), skill(user, "React")
    body = {
        "title": "Ship checkout",
        "description": "Rewrote the checkout flow.",
        "impact": "Checkout 40 s -> 12 s, conversion +8 %",
        "date": "2026-10-28",
        "project": shop.pk,
        "skills": [react.pk, django.pk],
    }
    response = send(client, "post", "/api/achievements", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["title"], data["impact"], data["date"]) == (
        "Ship checkout",
        "Checkout 40 s -> 12 s, conversion +8 %",
        "2026-10-28",
    )
    assert (data["project"], data["projectTitle"]) == (shop.pk, "Eshop")
    assert data["skills"] == [{"id": django.pk, "name": "Django"}, {"id": react.pk, "name": "React"}]
    # Date defaults to today; links are optional.
    data = send(client, "post", "/api/achievements", {"title": "Wrote a post"}, headers).json()
    assert (data["date"], data["project"], data["projectTitle"], data["skills"]) == (
        timezone.localdate().isoformat(),
        None,
        None,
        [],
    )
    # A title is required; the project must be the owner's project Item; skills must be the owner's.
    book = Item.objects.create(user=user, type="book", title="b")
    theirs = Item.objects.create(user=stranger(), type="project", title="x")
    foreign_skill = skill(stranger(), "Go")
    for bad in (
        {},
        {"title": "x", "project": book.pk},
        {"title": "x", "project": theirs.pk},
        {"title": "x", "skills": [foreign_skill.pk]},
        {"title": "x", "skills": [999_999]},
    ):
        assert send(client, "post", "/api/achievements", bad, headers).status_code == 400
    assert Achievement.objects.count() == 2


def test_list_achievements_by_week(client: Client) -> None:
    user = owner(client)
    shop = Item.objects.create(user=user, type="project", title="Eshop")
    tags = [skill(user, n) for n in ("Python", "SQL", "AWS")]
    for i in range(4):
        row = achievement(user, f"a{i}", MON + dt.timedelta(days=i), project=shop)
        row.skills.set(tags)
    achievement(user, "previous Sunday", MON - dt.timedelta(days=1))
    achievement(user, "next Monday", MON + dt.timedelta(days=7))
    achievement(stranger(), "not mine")
    with CaptureQueriesContext(connection) as queries:
        data = client.get(f"/api/achievements?week={MON}&limit=3").json()
    assert len(queries) <= 4  # session + user + page with its project + one prefetch of the skills
    assert [a["title"] for a in data["results"]] == ["a3", "a2", "a1"]
    assert [s["name"] for s in data["results"][0]["skills"]] == ["AWS", "Python", "SQL"]
    assert [a["title"] for a in client.get(data["next"]).json()["results"]] == ["a0"]
    assert len(client.get("/api/achievements").json()["results"]) == 6
    assert client.get("/api/achievements?week=2026-10-27").status_code == 400  # a Tuesday
    assert client.get("/api/achievements?week=soon").status_code == 400


def test_update_achievement(client: Client) -> None:
    headers = csrf(client)
    user = owner(client)
    shop = Item.objects.create(user=user, type="project", title="Eshop")
    python = skill(user, "Python")
    row = achievement(user, "Draft", project=shop)
    row.skills.set([python])
    body = {"impact": "3 clients onboarded", "skills": []}
    response = send(client, "patch", f"/api/achievements/{row.pk}", body, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["title"], data["impact"], data["project"], data["skills"]) == (
        "Draft",
        "3 clients onboarded",
        shop.pk,
        [],
    )
    data = send(client, "patch", f"/api/achievements/{row.pk}", {"project": None}, headers).json()
    assert data["project"] is None and data["projectTitle"] is None
    assert send(client, "patch", f"/api/achievements/{row.pk}", {"title": ""}, headers).status_code == 400
    theirs = achievement(stranger(), "theirs")
    assert send(client, "patch", f"/api/achievements/{theirs.pk}", {"title": "x"}, headers).status_code == 404


def test_week_review_lists_the_weeks_achievements(client: Client) -> None:
    user = owner(client)
    Week.objects.create(user=user, start_date=MON)
    achievement(user, "Sunday win", MON + dt.timedelta(days=6))
    achievement(user, "Monday win", MON)
    achievement(user, "last week", MON - dt.timedelta(days=1))
    achievement(stranger(), "not mine", MON)
    data = client.get(f"/api/weeks/{MON}/review").json()
    assert [a["title"] for a in data["achievements"]] == ["Monday win", "Sunday win"]
    assert {"week", "objectiveCounts", "days", "time", "opportunities"} <= set(data)  # existing fields stay


# --- Predictions ------------------------------------------------------------------------------------


def test_create_prediction(client: Client) -> None:
    headers = csrf(client)
    body = {"statement": "Gemini 4 ships before June", "madeOn": "2026-08-31", "confidence": 7}
    response = send(client, "post", "/api/predictions", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["statement"], data["madeOn"], data["checkOn"], data["confidence"]) == (
        "Gemini 4 ships before June",
        "2026-08-31",
        "2027-02-28",  # 6 months later, clamped to the month's end
        7,
    )
    assert (data["outcome"], data["note"], data["scoredAt"]) == ("open", "", None)
    data = send(client, "post", "/api/predictions", {"statement": "x"}, headers).json()
    today = timezone.localdate()
    assert (data["madeOn"], data["checkOn"], data["confidence"]) == (
        today.isoformat(),
        services.months_after(today, 6).isoformat(),
        None,
    )
    for bad in (
        {},
        {"statement": "x", "confidence": 11},
        {"statement": "x", "confidence": 0},
        {"statement": "x", "outcome": "maybe"},
        {"statement": "x", "madeOn": "2026-11-02", "checkOn": "2026-11-01"},
    ):
        assert send(client, "post", "/api/predictions", bad, headers).status_code == 400
    assert Prediction.objects.count() == 2


def test_list_predictions_due(client: Client) -> None:
    user = owner(client)
    today = timezone.localdate()
    long_ago = today - dt.timedelta(days=200)
    for i in range(3):
        prediction(user, f"due{i}", long_ago)
    prediction(user, "due today", today - dt.timedelta(days=10), check_on=today)
    prediction(user, "scored", long_ago, outcome="right", scored_at=timezone.now())
    prediction(user, "not yet", today)
    prediction(stranger(), "not mine", long_ago)
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/predictions?due=true&limit=3").json()
    assert len(queries) <= 3  # session + user + page
    assert [p["statement"] for p in data["results"]] == ["due today", "due2", "due1"]
    assert [p["statement"] for p in client.get(data["next"]).json()["results"]] == ["due0"]
    rest = client.get("/api/predictions?due=false").json()["results"]
    assert [p["statement"] for p in rest] == ["not yet", "scored"]
    assert len(client.get("/api/predictions").json()["results"]) == 6
    assert [p["statement"] for p in client.get("/api/predictions?outcome=right").json()["results"]] == [
        "scored"
    ]
    assert client.get("/api/predictions?due=yes").status_code == 400
    assert client.get("/api/predictions?outcome=maybe").status_code == 400


def test_update_prediction_rescore(client: Client) -> None:
    headers = csrf(client)
    row = prediction(owner(client), "Rust overtakes Go in CZ job ads", dt.date(2026, 4, 1))
    body = {"outcome": "wrong", "note": "Go still 3x more ads."}
    response = send(client, "patch", f"/api/predictions/{row.pk}", body, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["outcome"], data["note"], data["checkOn"]) == (
        "wrong",
        "Go still 3x more ads.",
        "2026-10-01",
    )
    scored_at = data["scoredAt"]
    assert scored_at
    # Changing other fields keeps the score time; open again clears it.
    data = send(client, "patch", f"/api/predictions/{row.pk}", {"confidence": 3}, headers).json()
    assert (data["confidence"], data["scoredAt"]) == (3, scored_at)
    data = send(client, "patch", f"/api/predictions/{row.pk}", {"outcome": "open"}, headers).json()
    assert (data["outcome"], data["scoredAt"]) == ("open", None)
    bad = {"checkOn": "2026-03-01"}
    assert send(client, "patch", f"/api/predictions/{row.pk}", bad, headers).status_code == 400
    assert Prediction.objects.get(pk=row.pk).check_on == dt.date(2026, 10, 1)
    theirs = prediction(stranger(), "theirs", dt.date(2026, 4, 1))
    assert send(client, "patch", f"/api/predictions/{theirs.pk}", body, headers).status_code == 404


def test_prediction_dates_and_confidence_in_the_database() -> None:
    user = stranger()
    for fields in ({"check_on": dt.date(2026, 1, 1)}, {"confidence": 11}):
        with pytest.raises(IntegrityError), transaction.atomic():
            prediction(user, "x", dt.date(2026, 2, 1), **fields)


# --- Auth and CSRF ----------------------------------------------------------------------------------


def test_brag_and_predictions_require_auth(anon_client: Client) -> None:
    for url in ("/api/achievements", "/api/predictions"):
        assert anon_client.get(url).status_code == 401
        assert send(anon_client, "post", url, {"title": "x", "statement": "x"}, {}).status_code == 401
        assert send(anon_client, "patch", f"{url}/1", {"title": "x"}, {}).status_code == 401
    assert Achievement.objects.count() == 0 and Prediction.objects.count() == 0


def test_brag_and_predictions_require_csrf(client: Client) -> None:
    user = owner(client)
    row = achievement(user, "keep")
    guess = prediction(user, "keep", MON)
    writes = [
        ("post", "/api/achievements", {"title": "x"}),
        ("patch", f"/api/achievements/{row.pk}", {"title": "x"}),
        ("post", "/api/predictions", {"statement": "x"}),
        ("patch", f"/api/predictions/{guess.pk}", {"outcome": "right"}),
    ]
    for method, url, body in writes:
        assert send(client, method, url, body, {}).status_code == 403
    assert Achievement.objects.get().title == "keep" and Prediction.objects.get().outcome == "open"
