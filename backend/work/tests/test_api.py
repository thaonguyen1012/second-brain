import datetime as dt
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.testing import csrf, send
from library.models import Item
from weeks.models import Objective, Week
from work.models import ProjectDetails, TimeEntry

pytestmark = pytest.mark.django_db

MON = dt.date(2026, 10, 26)


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def project(user: User, title: str = "Shop", **details: object) -> Item:
    item = Item.objects.create(user=user, type="project", title=title)
    ProjectDetails.objects.create(item=item, **details)
    return item


def entry(user: User, item: Item, minutes: int, day: dt.date = MON, **fields: object) -> TimeEntry:
    return TimeEntry.objects.create(user=user, project=item, minutes=minutes, date=day, **fields)


def test_create_project(client: Client) -> None:
    headers = csrf(client)
    body = {"title": "Eshop", "client": "Pekárna", "billing": "hourly", "hourlyRate": "800", "tags": ["SME"]}
    response = send(client, "post", "/api/projects", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["title"], data["client"], data["billing"], data["hourlyRate"], data["currency"]) == (
        "Eshop",
        "Pekárna",
        "hourly",
        "800.00",
        "CZK",
    )
    assert data["tags"] == ["sme"] and data["status"] == "planned"
    assert (data["minutesTotal"], data["earned"], data["effectiveRate"]) == (0, "0.00", None)
    assert Item.objects.get(pk=data["id"]).type == "project"
    # An hourly project needs a rate; money is never negative; currency is ISO 4217.
    for bad in (
        {"title": "x", "billing": "hourly"},
        {"title": "x", "price": "-1"},
        {"title": "x", "currency": "czk"},
        {"client": "no title"},
    ):
        assert send(client, "post", "/api/projects", bad, headers).status_code == 400
    assert Item.objects.count() == 1


def test_list_projects_with_totals(client: Client) -> None:
    user = owner(client)
    other = User.objects.create(username="other@x", email="other@x")
    fixed = project(user, "Fixed", billing="fixed", price=Decimal("30000"), client="A")
    hourly = project(user, "Hourly", billing="hourly", hourly_rate=Decimal("800"))
    bare = Item.objects.create(user=user, type="project", title="No details")  # made via /api/items
    Item.objects.create(user=user, type="book", title="Not a project")
    project(other, "Foreign")
    entry(user, fixed, 600)
    entry(user, fixed, 120, billable=False)
    entry(user, hourly, 360)
    entry(user, hourly, 120, billable=False)
    TimeEntry.objects.create(user=user, project=hourly, date=MON, started_at=timezone.now())  # running
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/projects")
    assert response.status_code == 200
    assert len(queries) <= 4  # session + user + one page query with details and totals
    rows = {p["title"]: p for p in response.json()["results"]}
    assert set(rows) == {"Fixed", "Hourly", "No details"}
    assert (rows["Fixed"]["minutesTotal"], rows["Fixed"]["minutesNonBillable"]) == (720, 120)
    assert (rows["Fixed"]["earned"], rows["Fixed"]["effectiveRate"]) == ("30000.00", "2500.00")
    assert (rows["Hourly"]["earned"], rows["Hourly"]["effectiveRate"]) == ("4800.00", "600.00")
    assert (rows["No details"]["billing"], rows["No details"]["effectiveRate"]) == ("fixed", None)
    assert rows["No details"]["id"] == bare.pk
    assert client.get("/api/projects?status=done").json()["results"] == []


def test_get_project(client: Client) -> None:
    user = owner(client)
    item = project(user, billing="fixed", price=Decimal("1000"))
    entry(user, item, 30)
    response = client.get(f"/api/projects/{item.pk}")
    assert response.status_code == 200
    assert response.json()["effectiveRate"] == "2000.00"
    book = Item.objects.create(user=user, type="book", title="Book")
    assert client.get(f"/api/projects/{book.pk}").status_code == 404


def test_update_project(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    bare = Item.objects.create(user=user, type="project", title="Bare")
    url = f"/api/projects/{bare.pk}"
    response = send(client, "patch", url, {"client": "B", "price": "5000", "status": "active"}, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["client"], data["price"], data["status"], data["title"]) == (
        "B",
        "5000.00",
        "active",
        "Bare",
    )
    assert ProjectDetails.objects.filter(item=bare).exists()
    assert send(client, "patch", url, {"billing": "hourly"}, headers).status_code == 400  # no rate yet
    data = send(client, "patch", url, {"billing": "hourly", "hourlyRate": "900"}, headers).json()
    assert (data["billing"], data["hourlyRate"]) == ("hourly", "900.00")
    assert send(client, "patch", url, {"hourlyRate": None}, headers).status_code == 400
    assert send(client, "patch", url, {"currency": "EUR"}, headers).json()["currency"] == "EUR"
    other = User.objects.create(username="other@x", email="other@x")
    foreign = project(other)
    assert send(client, "patch", f"/api/projects/{foreign.pk}", {"client": "x"}, headers).status_code == 404


def test_create_time_entry(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    item = project(user)
    week = Week.objects.create(user=user, start_date=MON)
    objective = Objective.objects.create(week=week, title="Ship shop")
    body = {
        "project": item.pk,
        "date": "2026-10-27",
        "minutes": 90,
        "note": "checkout",
        "objective": objective.pk,
    }
    response = send(client, "post", "/api/time-entries", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["project"], data["projectTitle"], data["minutes"], data["billable"], data["running"]) == (
        item.pk,
        "Shop",
        90,
        True,
        False,
    )
    assert (data["objective"], data["date"], data["startedAt"]) == (objective.pk, "2026-10-27", None)
    other = User.objects.create(username="other@x", email="other@x")
    foreign_week = Week.objects.create(user=other, start_date=MON)
    book = Item.objects.create(user=user, type="book", title="Book")
    for bad in (
        {**body, "project": book.pk},
        {**body, "project": project(other).pk},
        {**body, "objective": Objective.objects.create(week=foreign_week, title="x").pk},
        {**body, "minutes": 0},
        {**body, "minutes": 24 * 60 + 1},
        {"project": item.pk, "date": "2026-10-27"},
    ):
        assert send(client, "post", "/api/time-entries", bad, headers).status_code == 400
    assert TimeEntry.objects.count() == 1


def test_list_time_entries_filters(client: Client) -> None:
    user = owner(client)
    other = User.objects.create(username="other@x", email="other@x")
    shop, blog = project(user, "Shop"), project(user, "Blog")
    for i in range(3):
        entry(user, shop, 10 + i, MON + dt.timedelta(days=i))
    entry(user, blog, 50, MON)
    entry(other, project(other), 99, MON)
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/time-entries?limit=2").json()
    assert len(queries) <= 4
    assert [e["minutes"] for e in data["results"]] == [12, 11]
    assert len(client.get(data["next"]).json()["results"]) == 2
    rows = client.get(f"/api/time-entries?project={shop.pk}&from=2026-10-27&to=2026-10-27").json()["results"]
    assert [e["minutes"] for e in rows] == [11]
    assert client.get("/api/time-entries?from=yesterday").status_code == 400
    assert client.get("/api/time-entries?project=abc").status_code == 400


def test_update_time_entry(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    item = project(user)
    done = entry(user, item, 30)
    url = f"/api/time-entries/{done.pk}"
    data = send(client, "patch", url, {"minutes": 45, "billable": False}, headers).json()
    assert (data["minutes"], data["billable"], data["note"]) == (45, False, "")
    data = send(client, "patch", url, {"objective": None, "note": "fix"}, headers).json()
    assert (data["objective"], data["note"], data["minutes"]) == (None, "fix", 45)
    running = TimeEntry.objects.create(user=user, project=item, date=MON, started_at=timezone.now())
    running_url = f"/api/time-entries/{running.pk}"
    assert send(client, "patch", running_url, {"minutes": 5}, headers).status_code == 400
    assert send(client, "patch", running_url, {"note": "ok"}, headers).status_code == 200
    other = User.objects.create(username="other@x", email="other@x")
    foreign = entry(other, project(other), 10)
    assert send(client, "patch", f"/api/time-entries/{foreign.pk}", {"note": "x"}, headers).status_code == 404


def test_delete_time_entry(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    item = project(user)
    done = entry(user, item, 30)
    keep = entry(user, item, 15)
    response = send(client, "delete", f"/api/time-entries/{done.pk}", {}, headers)
    assert response.status_code == 204
    assert list(TimeEntry.objects.values_list("pk", flat=True)) == [keep.pk]
    assert send(client, "delete", f"/api/time-entries/{done.pk}", {}, headers).status_code == 404
    # A running timer may be discarded: nothing runs afterwards and no minutes were recorded.
    running = TimeEntry.objects.create(user=user, project=item, date=MON, started_at=timezone.now())
    assert send(client, "delete", f"/api/time-entries/{running.pk}", {}, headers).status_code == 204
    assert client.get("/api/time-entries/timer").json() == {"running": None}
    assert client.get(f"/api/projects/{item.pk}").json()["minutesTotal"] == 15
    other = User.objects.create(username="other@x", email="other@x")
    foreign = entry(other, project(other), 10)
    assert send(client, "delete", f"/api/time-entries/{foreign.pk}", {}, headers).status_code == 404
    assert TimeEntry.objects.filter(pk=foreign.pk).exists()


def test_get_timer(client: Client) -> None:
    user = owner(client)
    assert client.get("/api/time-entries/timer").json() == {"running": None}
    running = TimeEntry.objects.create(user=user, project=project(user), date=MON, started_at=timezone.now())
    data = client.get("/api/time-entries/timer").json()["running"]
    assert (data["id"], data["running"], data["minutes"]) == (running.pk, True, None)


def test_start_timer_stops_the_running_one(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    shop, blog = project(user, "Shop"), project(user, "Blog")
    first = send(client, "post", "/api/time-entries/timer/start", {"project": shop.pk}, headers)
    assert first.status_code == 201
    started = first.json()
    assert started["running"] and started["startedAt"] and started["date"] == timezone.localdate().isoformat()
    TimeEntry.objects.filter(pk=started["id"]).update(started_at=timezone.now() - dt.timedelta(minutes=25))
    body = {"project": blog.pk, "billable": False, "note": "write"}
    second = send(client, "post", "/api/time-entries/timer/start", body, headers).json()
    assert (second["project"], second["billable"], second["running"]) == (blog.pk, False, True)
    assert TimeEntry.objects.get(pk=started["id"]).minutes == 25
    assert TimeEntry.objects.filter(minutes__isnull=True).count() == 1
    book = Item.objects.create(user=user, type="book", title="Book")
    assert (
        send(client, "post", "/api/time-entries/timer/start", {"project": book.pk}, headers).status_code
        == 400
    )


def test_stop_timer(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    assert send(client, "post", "/api/time-entries/timer/stop", {}, headers).status_code == 404
    running = TimeEntry.objects.create(
        user=user, project=project(user), date=MON, started_at=timezone.now() - dt.timedelta(seconds=20)
    )
    response = send(client, "post", "/api/time-entries/timer/stop", {}, headers)
    assert response.status_code == 200
    assert (response.json()["id"], response.json()["minutes"], response.json()["running"]) == (
        running.pk,
        1,  # at least one minute
        False,
    )


def test_one_running_timer_per_user_in_the_database(client: Client) -> None:
    user = owner(client)
    item = project(user)
    TimeEntry.objects.create(user=user, project=item, date=MON, started_at=timezone.now())
    with pytest.raises(IntegrityError), transaction.atomic():
        TimeEntry.objects.create(user=user, project=item, date=MON, started_at=timezone.now())
    with pytest.raises(IntegrityError), transaction.atomic():
        TimeEntry.objects.create(user=user, project=item, date=MON)  # neither minutes nor a timer


def test_week_summary(client: Client) -> None:
    user = owner(client)
    shop = project(user, "Shop", client="Pekárna")
    blog = project(user, "Blog")
    entry(user, shop, 120)
    entry(user, shop, 30, MON + dt.timedelta(days=6), billable=False)
    entry(user, blog, 60, MON + dt.timedelta(days=2), billable=False)
    entry(user, shop, 500, MON + dt.timedelta(days=7))  # next week
    TimeEntry.objects.create(user=user, project=shop, date=MON, started_at=timezone.now())  # running
    response = client.get(f"/api/time-entries/summary?week={MON}")
    assert response.status_code == 200
    assert response.json() == {
        "weekStart": "2026-10-26",
        "minutesTotal": 210,
        "minutesBillable": 120,
        "minutesNonBillable": 90,
        "projects": [
            {
                "id": shop.pk,
                "title": "Shop",
                "client": "Pekárna",
                "minutesTotal": 150,
                "minutesBillable": 120,
                "minutesNonBillable": 30,
            },
            {
                "id": blog.pk,
                "title": "Blog",
                "client": "",
                "minutesTotal": 60,
                "minutesBillable": 0,
                "minutesNonBillable": 60,
            },
        ],
    }
    today = timezone.localdate()
    current = client.get("/api/time-entries/summary").json()
    assert current["weekStart"] == (today - dt.timedelta(days=today.weekday())).isoformat()
    assert client.get("/api/time-entries/summary?week=2026-10-27").status_code == 400


def test_week_review_splits_objective_time(client: Client) -> None:
    user = owner(client)
    week = Week.objects.create(user=user, start_date=MON)
    ship = Objective.objects.create(week=week, title="Ship shop", position=0)
    idle = Objective.objects.create(week=week, title="Idle", position=1)
    old = Objective.objects.create(
        week=Week.objects.create(user=user, start_date=MON - dt.timedelta(weeks=1)), title="Old"
    )
    item = project(user)
    entry(user, item, 90, MON, objective=ship)
    entry(user, item, 30, MON + dt.timedelta(days=1), objective=ship)
    entry(user, item, 45, MON + dt.timedelta(days=1))
    entry(user, item, 15, MON + dt.timedelta(days=1), objective=old)  # another week's objective: other
    data = client.get(f"/api/weeks/{MON}/review").json()
    assert data["time"] == {
        "minutesForObjectives": 120,
        "minutesOther": 60,
        "byObjective": [
            {"id": ship.pk, "title": "Ship shop", "minutes": 120},
            {"id": idle.pk, "title": "Idle", "minutes": 0},
        ],
    }
    days = {d["date"]: d for d in data["days"]}
    assert (days["2026-10-26"]["minutesForObjectives"], days["2026-10-26"]["minutesOther"]) == (90, 0)
    assert (days["2026-10-27"]["minutesForObjectives"], days["2026-10-27"]["minutesOther"]) == (30, 60)
    assert "inboxArchived" in days["2026-10-27"]  # existing fields stay


def test_work_requires_auth(anon_client: Client) -> None:
    reads = (
        "/api/projects",
        "/api/projects/1",
        "/api/time-entries",
        "/api/time-entries/timer",
        "/api/time-entries/summary",
    )
    for url in reads:
        assert anon_client.get(url).status_code == 401
    writes = [
        ("post", "/api/projects"),
        ("patch", "/api/projects/1"),
        ("post", "/api/time-entries"),
        ("patch", "/api/time-entries/1"),
        ("delete", "/api/time-entries/1"),
        ("post", "/api/time-entries/timer/start"),
        ("post", "/api/time-entries/timer/stop"),
    ]
    for method, url in writes:
        assert send(anon_client, method, url, {}, {}).status_code == 401
    assert Item.objects.count() == 0 and TimeEntry.objects.count() == 0


def test_work_requires_csrf(client: Client) -> None:
    user = owner(client)
    item = project(user)
    done = entry(user, item, 10)
    TimeEntry.objects.create(user=user, project=item, date=MON, started_at=timezone.now())
    writes = [
        ("post", "/api/projects", {"title": "x"}),
        ("patch", f"/api/projects/{item.pk}", {"client": "x"}),
        ("post", "/api/time-entries", {"project": item.pk, "date": "2026-10-26", "minutes": 5}),
        ("patch", f"/api/time-entries/{done.pk}", {"minutes": 5}),
        ("delete", f"/api/time-entries/{done.pk}", {}),
        ("post", "/api/time-entries/timer/start", {"project": item.pk}),
        ("post", "/api/time-entries/timer/stop", {}),
    ]
    for method, url, body in writes:
        assert send(client, method, url, body, {}).status_code == 403
    assert Item.objects.count() == 1 and TimeEntry.objects.count() == 2
    assert TimeEntry.objects.get(pk=done.pk).minutes == 10
    assert TimeEntry.objects.filter(minutes__isnull=True).count() == 1
