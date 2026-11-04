import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.services.counts import snapshot
from growth import services as growth
from growth.models import Achievement, JobAd, Skill
from library.models import Item, Note
from opportunities.models import Opportunity
from weeks.models import Objective, Week
from weeks.services import monday_of
from work.models import ProjectDetails, TimeEntry

pytestmark = pytest.mark.django_db

KEYS = {
    "objectivesOpen",
    "skills",
    "jobAds",
    "achievements",
    "items",
    "notes",
    "opportunities",
    "projects",
    "timerRunning",
}


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def this_week() -> dt.date:
    return monday_of(timezone.localdate())


def this_month() -> dt.date:
    return growth.month_start(timezone.localdate())


def week_with(user: User, start: dt.date, *statuses: str) -> Week:
    week = Week.objects.create(user=user, start_date=start)
    for n, status in enumerate(statuses):
        Objective.objects.create(week=week, title=f"Objective {n}", status=status, position=n)
    return week


def project(user: User, title: str = "Shop", **fields: object) -> Item:
    item = Item.objects.create(user=user, type="project", title=title, **fields)
    ProjectDetails.objects.create(item=item)
    return item


def timer(user: User, item: Item) -> TimeEntry:
    return TimeEntry.objects.create(
        user=user, project=item, date=timezone.localdate(), minutes=None, started_at=timezone.now()
    )


def fill(user: User) -> None:
    """Rows of every counted kind that the pages show by default: this week, this month."""
    week_with(user, this_week(), "open", "open", "done")
    growth.save_skill(Skill(user=user), {"name": "Django"})
    JobAd.objects.create(user=user, title="Backend dev", text="Django, Postgres", month=this_month())
    Achievement.objects.create(user=user, title="Shipped", date=this_week())
    Item.objects.create(user=user, type="book", title="Clean Code")
    shop = project(user)
    TimeEntry.objects.create(user=user, project=shop, date=timezone.localdate(), minutes=30)
    Note.objects.create(user=user, markdown="# Idea")
    Opportunity.objects.create(user=user, title="Booking app", hypothesis="Salons pay for bookings")


def counts(client: Client) -> dict[str, object]:
    response = client.get("/api/counts")
    assert response.status_code == 200
    data: dict[str, object] = response.json()
    assert set(data) == KEYS
    return data


def test_counts_without_any_activity(client: Client) -> None:
    owner(client)
    assert counts(client) == {key: 0 for key in KEYS} | {"timerRunning": False}
    assert not Week.objects.exists()  # read-only: the current week is not created


def test_counts_only_the_owners_rows(client: Client) -> None:
    user, other = owner(client), stranger()
    fill(user)
    fill(other)
    timer(other, project(other, "Their shop"))
    with CaptureQueriesContext(connection) as queries:
        data = counts(client)
    assert len(queries) <= 11  # one per number, plus the dev-mode login
    assert data == {
        "objectivesOpen": 2,
        "skills": 1,
        "jobAds": 1,
        "achievements": 1,
        "items": 2,  # the book and the project
        "notes": 1,
        "opportunities": 1,
        "projects": 1,
        "timerRunning": False,  # only the stranger's timer runs
    }


def test_open_objectives_of_this_week_only(client: Client) -> None:
    user = owner(client)
    week_with(user, this_week() - dt.timedelta(days=7), "open", "open", "open")
    assert counts(client)["objectivesOpen"] == 0  # this week has no row yet
    week_with(user, this_week(), "open", "done", "dropped", "open")
    week_with(user, this_week() + dt.timedelta(days=7), "open")
    assert counts(client)["objectivesOpen"] == 2


def test_job_ads_of_this_month_and_achievements_of_this_week(client: Client) -> None:
    user = owner(client)
    month, week = this_month(), this_week()
    for ad_month in (month, month, growth.months_before(month, 1), growth.months_after(month, 1)):
        JobAd.objects.create(user=user, title="Dev", text="Python", month=ad_month)
    for day in (week, week + dt.timedelta(days=6), week - dt.timedelta(days=1), week + dt.timedelta(days=7)):
        Achievement.objects.create(user=user, title="Win", date=day)
    data = counts(client)
    assert (data["jobAds"], data["achievements"]) == (2, 2)


def freeze(monkeypatch: pytest.MonkeyPatch, moment: dt.datetime) -> None:
    """timezone.now() (and so localdate(), which counts.snapshot uses by default) returns `moment`."""
    monkeypatch.setattr(timezone, "now", lambda: moment)


def test_this_week_starts_at_midnight_in_prague(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    """Sunday 2026-11-08 23:30 UTC is already Monday 00:30 in Prague (CET): the week of the 9th counts."""
    user = owner(client)
    monday = dt.date(2026, 11, 9)
    week_with(user, monday - dt.timedelta(days=7), "open", "open", "open")
    week_with(user, monday, "open")
    Achievement.objects.create(user=user, title="Last week", date=monday - dt.timedelta(days=1))
    Achievement.objects.create(user=user, title="This week", date=monday)
    freeze(monkeypatch, dt.datetime(2026, 11, 8, 23, 30, tzinfo=dt.UTC))
    data = counts(client)
    assert (data["objectivesOpen"], data["achievements"]) == (1, 1)  # UTC's Sunday would give (3, 1)
    assert snapshot(user) == snapshot(user, monday)


def test_this_month_starts_at_midnight_in_prague(client: Client, monkeypatch: pytest.MonkeyPatch) -> None:
    """2026-11-30 23:30 UTC is 1 December 00:30 in Prague: December's job ads count, not November's."""
    user = owner(client)
    JobAd.objects.create(user=user, title="November", text="Python", month=dt.date(2026, 11, 1))
    JobAd.objects.create(user=user, title="November too", text="Go", month=dt.date(2026, 11, 1))
    JobAd.objects.create(user=user, title="December", text="Django", month=dt.date(2026, 12, 1))
    freeze(monkeypatch, dt.datetime(2026, 11, 30, 23, 30, tzinfo=dt.UTC))
    assert counts(client)["jobAds"] == 1  # UTC's 30 November would give 2
    assert snapshot(user) == snapshot(user, dt.date(2026, 12, 1))


def test_timer_running(client: Client) -> None:
    user = owner(client)
    shop = project(user)
    TimeEntry.objects.create(user=user, project=shop, date=timezone.localdate(), minutes=45)
    assert counts(client)["timerRunning"] is False
    timer(user, shop)
    assert counts(client)["timerRunning"] is True


def test_each_count_equals_its_list(client: Client) -> None:
    """A click on a sidebar row shows exactly the number next to it (the pages' default filters)."""
    user, other = owner(client), stranger()
    fill(user)
    fill(other)
    week_with(user, this_week() - dt.timedelta(days=7), "open")
    JobAd.objects.create(user=user, title="Old", text="PHP", month=growth.months_before(this_month(), 1))
    Achievement.objects.create(user=user, title="Old win", date=this_week() - dt.timedelta(days=3))
    timer(user, project(user, "Timed"))
    # Rows a page filter could hide: a count that added that filter would no longer equal its list.
    Opportunity.objects.create(user=user, title="Dropped", hypothesis="x", decision="drop")
    Opportunity.objects.create(user=user, title="Built", hypothesis="y", decision="build")
    Item.objects.create(user=user, type="course", title="Finished course", status="done")
    project(user, "Delivered", status="done")
    faded = growth.save_skill(Skill(user=user), {"name": "jQuery"})
    growth.add_evidence(
        faded, {"kind": "link", "title": "Old site", "date": this_week() - dt.timedelta(days=400)}
    )
    data = counts(client)

    def rows(url: str) -> int:
        response = client.get(url)
        assert response.status_code == 200
        return len(response.json()["results"])

    current = client.get("/api/weeks/current").json()
    assert data["objectivesOpen"] == sum(o["status"] == "open" for o in current["objectives"])
    assert data["skills"] == rows("/api/skills?limit=200")
    assert data["jobAds"] == rows(f"/api/market/job-ads?month={this_month():%Y-%m}&limit=200")
    assert data["achievements"] == rows(f"/api/achievements?week={this_week()}&limit=200")
    assert data["items"] == rows("/api/items?limit=200")
    assert data["notes"] == rows("/api/notes?limit=200")
    assert data["opportunities"] == rows("/api/opportunities?limit=200")
    assert data["projects"] == rows("/api/projects?limit=200")
    assert data["timerRunning"] is (client.get("/api/time-entries/timer").json()["running"] is not None)
    assert data["timerRunning"] is True
    skills = client.get("/api/skills?limit=200").json()["results"]
    assert {s["name"]: s["freshness"] for s in skills}["jQuery"] == "faded"
    assert (data["skills"], data["items"], data["opportunities"], data["projects"]) == (2, 5, 3, 3)


def test_counts_require_auth(anon_client: Client) -> None:
    assert anon_client.get("/api/counts").status_code == 401
