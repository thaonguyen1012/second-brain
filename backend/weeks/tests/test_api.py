import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.testing import csrf, send
from inbox.models import InboxEntry
from library.models import Item
from progress.models import PageProgress
from weeks.models import Objective, Week

pytestmark = pytest.mark.django_db

MON = dt.date(2026, 10, 26)
PREV = MON - dt.timedelta(days=14)  # a skipped week in between
PRAGUE = dt.timezone(dt.timedelta(hours=1))  # CET; late October 2026 is after the DST switch


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def test_current_week_is_created_once(client: Client) -> None:
    first = client.get("/api/weeks/current")
    assert first.status_code == 200
    data = first.json()
    today = timezone.localdate()
    assert data["startDate"] == (today - dt.timedelta(days=today.weekday())).isoformat()
    assert data["objectives"] == [] and data["plannedAt"] is None and data["reviewWin"] == ""
    assert client.get("/api/weeks/current").json()["id"] == data["id"]
    assert Week.objects.count() == 1


def test_list_weeks_newest_first(client: Client) -> None:
    user = owner(client)
    other = User.objects.create(username="other@x", email="other@x")
    for i in range(3):
        week = Week.objects.create(user=user, start_date=MON - dt.timedelta(weeks=i))
        Objective.objects.create(week=week, title=f"o{i}")
    Week.objects.create(user=other, start_date=MON + dt.timedelta(weeks=1))
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/weeks?limit=2").json()
    assert len(queries) <= 5  # session + user + page + objectives prefetch
    assert [w["startDate"] for w in data["results"]] == ["2026-10-26", "2026-10-19"]
    assert data["results"][0]["objectives"][0]["title"] == "o0"
    assert [w["startDate"] for w in client.get(data["next"]).json()["results"]] == ["2026-10-12"]


def test_get_plan_shows_previous_open_objectives(client: Client) -> None:
    user = owner(client)
    previous = Week.objects.create(user=user, start_date=PREV)
    keep = Objective.objects.create(week=previous, title="ship week", position=0)
    Objective.objects.create(week=previous, title="done one", status="done", position=1)
    response = client.get(f"/api/weeks/{MON}/plan")
    assert response.status_code == 200
    data = response.json()
    assert data["week"]["startDate"] == MON.isoformat()
    assert data["carryCandidates"] == [
        {"id": keep.pk, "title": "ship week", "weekStart": PREV.isoformat(), "carried": False}
    ]
    assert client.get("/api/weeks/2026-10-27/plan").status_code == 400  # a Tuesday
    assert client.get("/api/weeks/2026-02-30/plan").status_code == 404


def test_plan_week_carries_objectives_idempotently(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    previous = Week.objects.create(user=user, start_date=PREV)
    one = Objective.objects.create(week=previous, title="one", position=0)
    two = Objective.objects.create(week=previous, title="two", position=1)
    done = Objective.objects.create(week=previous, title="done", status="done", position=2)
    body = {"carry": [two.pk, one.pk], "planningJournal": "Focus on Week."}
    for _ in range(2):
        response = send(client, "post", f"/api/weeks/{MON}/plan", body, headers)
        assert response.status_code == 200
    data = response.json()
    assert [(o["title"], o["carriedFrom"], o["position"]) for o in data["objectives"]] == [
        ("one", one.pk, 0),
        ("two", two.pk, 1),
    ]
    assert data["planningJournal"] == "Focus on Week." and data["plannedAt"]
    candidates = client.get(f"/api/weeks/{MON}/plan").json()["carryCandidates"]
    assert all(c["carried"] for c in candidates)
    assert send(client, "post", f"/api/weeks/{MON}/plan", {"carry": [done.pk]}, headers).status_code == 400
    # The journal is optional; the objectives stay.
    data = send(client, "post", f"/api/weeks/{MON}/plan", {}, headers).json()
    assert data["planningJournal"] == "Focus on Week." and len(data["objectives"]) == 2


def test_get_review_lists_body_of_work_per_day(client: Client) -> None:
    user = owner(client)
    other = User.objects.create(username="other@x", email="other@x")
    week = Week.objects.create(user=user, start_date=MON)
    Objective.objects.create(week=week, title="a", status="done")
    Objective.objects.create(week=week, title="b")
    tuesday_early = dt.datetime(2026, 10, 27, 0, 30, tzinfo=PRAGUE)  # still Monday in UTC
    sunday_late = dt.datetime(2026, 11, 1, 23, 30, tzinfo=PRAGUE)
    archived = InboxEntry.objects.create(user=user, text="read it", status="archived")
    InboxEntry.objects.create(user=user, text="still inbox")
    InboxEntry.objects.create(user=other, text="not mine", status="archived", archived_at=tuesday_early)
    # Archived on Tuesday, edited again on Wednesday: the archive day counts, not the last update.
    InboxEntry.objects.filter(pk=archived.pk).update(
        archived_at=tuesday_early, updated_at=tuesday_early + dt.timedelta(days=1)
    )
    Item.objects.create(user=user, type="book", title="Deep Work", finished_at=sunday_late)
    Item.objects.create(
        user=user, type="film", title="later", finished_at=sunday_late + dt.timedelta(hours=1)
    )
    PageProgress.objects.create(user=user, book="handbook-08", page="p1", done=True)
    PageProgress.objects.create(user=user, book="handbook-08", page="p2", done=False)
    PageProgress.objects.filter(user=user).update(updated_at=tuesday_early)

    response = client.get(f"/api/weeks/{MON}/review")
    assert response.status_code == 200
    data = response.json()
    assert data["week"]["startDate"] == MON.isoformat()
    assert data["objectiveCounts"] == {"open": 1, "done": 1, "dropped": 0}
    days = {d["date"]: d for d in data["days"]}
    assert len(days) == 7
    assert days["2026-10-26"]["inboxArchived"] == []
    assert days["2026-10-27"]["inboxArchived"] == [{"id": archived.pk, "title": "read it"}]
    assert days["2026-10-27"]["pagesDone"] == [{"book": "handbook-08", "page": "p1"}]
    assert [i["title"] for i in days["2026-11-01"]["itemsFinished"]] == ["Deep Work"]
    assert client.get(f"/api/weeks/{MON + dt.timedelta(weeks=1)}/review").status_code == 404


def test_items_marked_done_through_the_api_reach_the_review(client: Client) -> None:
    # Thư viện and the Dự án board send only the status; the API sets finishedAt.
    headers = csrf(client)
    book = send(client, "post", "/api/items", {"type": "book", "title": "Deep Work"}, headers).json()
    send(client, "patch", f"/api/items/{book['id']}", {"status": "done"}, headers)
    shop = send(client, "post", "/api/projects", {"title": "Shop", "status": "active"}, headers).json()
    send(client, "patch", f"/api/projects/{shop['id']}", {"status": "done"}, headers)
    send(client, "post", "/api/items", {"type": "film", "title": "Still planned"}, headers)

    start = client.get("/api/weeks/current").json()["startDate"]
    days = {d["date"]: d for d in client.get(f"/api/weeks/{start}/review").json()["days"]}
    finished = days[timezone.localdate().isoformat()]["itemsFinished"]
    assert finished == [
        {"id": book["id"], "title": "Deep Work", "type": "book"},
        {"id": shop["id"], "title": "Shop", "type": "project"},
    ]


def test_update_review(client: Client) -> None:
    headers = csrf(client)
    body = {"reviewWin": "Week API", "reviewChangedMind": "Less is more."}
    response = send(client, "patch", f"/api/weeks/{MON}/review", body, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["reviewWin"], data["reviewChangedMind"], data["reviewLearned"]) == (
        "Week API",
        "Less is more.",
        "",
    )
    assert data["reviewedAt"]
    data = send(client, "patch", f"/api/weeks/{MON}/review", {"reviewLearned": "x"}, headers).json()
    assert (data["reviewWin"], data["reviewLearned"]) == ("Week API", "x")
    assert send(client, "patch", "/api/weeks/2026-10-28/review", body, headers).status_code == 400


def test_create_objective(client: Client) -> None:
    headers = csrf(client)
    url = f"/api/weeks/{MON}/objectives"
    first = send(client, "post", url, {"title": "Ship Week"}, headers)
    assert first.status_code == 201
    assert (first.json()["title"], first.json()["status"], first.json()["position"]) == (
        "Ship Week",
        "open",
        0,
    )
    assert send(client, "post", url, {"title": "Write"}, headers).json()["position"] == 1
    assert send(client, "post", url, {"title": ""}, headers).status_code == 400


def test_update_objective(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    week = Week.objects.create(user=user, start_date=MON)
    objective = Objective.objects.create(week=week, title="a")
    url = f"/api/weeks/{MON}/objectives/{objective.pk}"
    response = send(client, "patch", url, {"status": "done", "position": 3}, headers)
    assert response.status_code == 200
    assert (response.json()["status"], response.json()["position"], response.json()["title"]) == (
        "done",
        3,
        "a",
    )
    assert send(client, "patch", url, {"status": "finished"}, headers).status_code == 400
    wrong_week = f"/api/weeks/{PREV}/objectives/{objective.pk}"
    assert send(client, "patch", wrong_week, {"status": "open"}, headers).status_code == 404
    other = User.objects.create(username="other@x", email="other@x")
    foreign = Objective.objects.create(week=Week.objects.create(user=other, start_date=MON), title="x")
    foreign_url = f"/api/weeks/{MON}/objectives/{foreign.pk}"
    assert send(client, "patch", foreign_url, {"status": "done"}, headers).status_code == 404


def test_weeks_require_auth(anon_client: Client) -> None:
    for url in ("/api/weeks", "/api/weeks/current", f"/api/weeks/{MON}/plan", f"/api/weeks/{MON}/review"):
        assert anon_client.get(url).status_code == 401
    writes = [
        ("post", f"/api/weeks/{MON}/plan"),
        ("patch", f"/api/weeks/{MON}/review"),
        ("post", f"/api/weeks/{MON}/objectives"),
        ("patch", f"/api/weeks/{MON}/objectives/1"),
    ]
    for method, url in writes:
        assert send(anon_client, method, url, {}, {}).status_code == 401
    assert Week.objects.count() == 0


def test_weeks_require_csrf(client: Client) -> None:
    client.get("/api/me")
    writes = [
        ("post", f"/api/weeks/{MON}/plan", {}),
        ("patch", f"/api/weeks/{MON}/review", {"reviewWin": "x"}),
        ("post", f"/api/weeks/{MON}/objectives", {"title": "x"}),
        ("patch", f"/api/weeks/{MON}/objectives/1", {"status": "done"}),
    ]
    for method, url, body in writes:
        assert send(client, method, url, body, {}).status_code == 403
    assert Week.objects.count() == 0
