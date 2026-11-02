"""Practice-rhythm reminders of the week review (DECISIONS 6.5): GET /api/weeks/{start}/review `rhythm`."""

import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.test import Client

from growth.models import Achievement, Prediction
from library.models import Item, Note
from weeks import services
from weeks.models import Week

pytestmark = pytest.mark.django_db

PRAGUE = dt.timezone(dt.timedelta(hours=1))  # CET (November to March)
SUMMER = dt.timezone(dt.timedelta(hours=2))  # CEST


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def note_at(user: User, moment: dt.datetime) -> Note:
    note = Note.objects.create(user=user, markdown="private body")
    Note.objects.filter(pk=note.pk).update(created_at=moment)
    return note


def predict(user: User, check_on: dt.date, **fields: object) -> Prediction:
    return Prediction.objects.create(
        user=user, statement="x", made_on=check_on - dt.timedelta(days=180), check_on=check_on, **fields
    )


def test_weekly_checklist_counts_notes_achievements_and_due_predictions(client: Client) -> None:
    user = owner(client)
    other = User.objects.create(username="other@x", email="other@x")
    monday = dt.date(2026, 11, 9)  # Sunday the 15th: no monthly line
    Week.objects.create(user=user, start_date=monday)
    note_at(user, dt.datetime(2026, 11, 9, 0, 10, tzinfo=PRAGUE))  # Sunday 23:10 UTC, Monday in Prague
    note_at(user, dt.datetime(2026, 11, 15, 23, 50, tzinfo=PRAGUE))
    note_at(user, dt.datetime(2026, 11, 8, 23, 50, tzinfo=PRAGUE))  # the week before
    note_at(other, dt.datetime(2026, 11, 10, 12, 0, tzinfo=PRAGUE))
    Achievement.objects.create(user=user, title="Shipped", date=dt.date(2026, 11, 15))
    Achievement.objects.create(user=user, title="Earlier", date=dt.date(2026, 11, 8))
    Achievement.objects.create(user=other, title="Theirs", date=dt.date(2026, 11, 10))
    predict(user, dt.date(2026, 11, 15))  # due on the Sunday
    predict(user, dt.date(2026, 5, 1))  # overdue, still open
    predict(user, dt.date(2026, 11, 16))  # next week
    predict(user, dt.date(2026, 11, 1), outcome="right")  # already scored
    predict(other, dt.date(2026, 11, 1))

    response = client.get(f"/api/weeks/{monday}/review")
    assert response.status_code == 200
    assert response.json()["rhythm"] == {
        "notes": 2,
        "achievements": 1,
        "predictionsDue": 2,
        "month": None,
        "quarter": None,
    }


def test_empty_week_has_zero_counts(client: Client) -> None:
    user = owner(client)
    Week.objects.create(user=user, start_date=dt.date(2026, 11, 16))
    rhythm = client.get("/api/weeks/2026-11-16/review").json()["rhythm"]
    assert rhythm == {"notes": 0, "achievements": 0, "predictionsDue": 0, "month": None, "quarter": None}


def test_first_review_of_a_month_looks_back_at_the_month_that_ended(client: Client) -> None:
    user = owner(client)
    monday = dt.date(2026, 10, 26)  # Sunday 1 November: the first review of November
    Week.objects.create(user=user, start_date=monday)
    Item.objects.create(
        user=user, type="book", title="Oct 1", finished_at=dt.datetime(2026, 10, 1, 0, 30, tzinfo=SUMMER)
    )
    Item.objects.create(
        user=user, type="book", title="Oct 31", finished_at=dt.datetime(2026, 10, 31, 23, 30, tzinfo=PRAGUE)
    )
    Item.objects.create(
        user=user, type="book", title="Nov", finished_at=dt.datetime(2026, 11, 1, 0, 30, tzinfo=PRAGUE)
    )
    Item.objects.create(
        user=user, type="film", title="Film", finished_at=dt.datetime(2026, 10, 10, tzinfo=SUMMER)
    )
    note_at(user, dt.datetime(2026, 10, 5, 12, 0, tzinfo=SUMMER))

    rhythm = client.get(f"/api/weeks/{monday}/review").json()["rhythm"]
    assert rhythm["month"] == {"month": "2026-10", "booksFinished": 2, "notes": 1}
    assert rhythm["quarter"] is None


@pytest.mark.parametrize(
    ("monday", "month", "year", "quarter"),
    [
        (dt.date(2026, 9, 28), "2026-09", 2026, 3),  # Sunday 4 October
        (dt.date(2026, 12, 28), "2026-12", 2026, 4),  # Sunday 3 January 2027
        (dt.date(2027, 3, 29), "2027-03", 2027, 1),  # Sunday 4 April
        (dt.date(2027, 6, 28), "2027-06", 2027, 2),  # Sunday 4 July
    ],
)
def test_first_review_of_a_quarter_adds_the_quarter_line(
    client: Client, monday: dt.date, month: str, year: int, quarter: int
) -> None:
    user = owner(client)
    week = Week.objects.create(user=user, start_date=monday)
    rhythm = services.rhythm(week)
    assert rhythm["month"]["month"] == month
    assert (rhythm["quarter"]["year"], rhythm["quarter"]["quarter"]) == (year, quarter)


def test_quarter_counts(client: Client) -> None:
    user = owner(client)
    monday = dt.date(2026, 9, 28)  # Q3 2026 ended on Wednesday 30 September
    Week.objects.create(user=user, start_date=monday)
    Achievement.objects.create(user=user, title="Q3 start", date=dt.date(2026, 7, 1))
    Achievement.objects.create(user=user, title="Q3 end", date=dt.date(2026, 9, 30))
    Achievement.objects.create(user=user, title="Q4", date=dt.date(2026, 10, 1))
    Achievement.objects.create(user=user, title="Q2", date=dt.date(2026, 6, 30))
    Item.objects.create(
        user=user, type="project", title="Eshop", finished_at=dt.datetime(2026, 8, 20, tzinfo=SUMMER)
    )
    Item.objects.create(
        user=user, type="project", title="Later", finished_at=dt.datetime(2026, 10, 2, tzinfo=SUMMER)
    )
    predict(user, dt.date(2027, 3, 1))  # open, not due yet: still on the quarterly list
    predict(user, dt.date(2026, 9, 1))
    predict(user, dt.date(2026, 9, 1), outcome="wrong")

    rhythm = client.get(f"/api/weeks/{monday}/review").json()["rhythm"]
    assert rhythm["predictionsDue"] == 1
    assert rhythm["quarter"] == {
        "year": 2026,
        "quarter": 3,
        "achievements": 2,
        "projectsFinished": 1,
        "predictionsOpen": 2,
    }
