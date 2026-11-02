import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.test import Client

from core.testing import csrf, send
from library.models import Item
from weeks.models import Objective, Week
from work.models import TimeEntry

pytestmark = pytest.mark.django_db
MON = dt.date(2026, 10, 26)
PREV = MON - dt.timedelta(days=7)


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def test_delete_objective_keeps_carried_copies_and_time(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    source = Objective.objects.create(week=Week.objects.create(user=user, start_date=PREV), title="ship")
    send(client, "post", f"/api/weeks/{MON}/plan", {"carry": [source.pk]}, headers)
    carried = Objective.objects.get(carried_from=source)
    project = Item.objects.create(user=user, type="project", title="Shop")
    entry = TimeEntry.objects.create(user=user, project=project, date=PREV, minutes=60, objective=source)

    assert client.delete(f"/api/weeks/{MON}/objectives/{source.pk}", headers=headers).status_code == 404
    assert client.delete(f"/api/weeks/{PREV}/objectives/{source.pk}", headers=headers).status_code == 204
    carried.refresh_from_db()
    entry.refresh_from_db()
    assert (carried.title, carried.carried_from, entry.objective) == ("ship", None, None)
    objectives = client.get(f"/api/weeks/{MON}/plan").json()["week"]["objectives"]
    assert [(o["title"], o["carriedFrom"]) for o in objectives] == [("ship", None)]
    # The carried copy can be deleted on its own week too.
    assert client.delete(f"/api/weeks/{MON}/objectives/{carried.pk}", headers=headers).status_code == 204
    assert not Objective.objects.exists()


def test_delete_objective_checks_owner_and_monday(client: Client) -> None:
    other = User.objects.create(username="other@x", email="other@x")
    theirs = Objective.objects.create(week=Week.objects.create(user=other, start_date=MON), title="theirs")
    headers = csrf(client)
    assert client.delete(f"/api/weeks/{MON}/objectives/{theirs.pk}", headers=headers).status_code == 404
    tuesday = MON + dt.timedelta(days=1)
    assert client.delete(f"/api/weeks/{tuesday}/objectives/{theirs.pk}", headers=headers).status_code == 400
    assert client.delete(f"/api/weeks/{MON}/objectives/{theirs.pk}").status_code == 403
    assert Objective.objects.filter(pk=theirs.pk).exists()


def test_delete_objective_requires_auth(anon_client: Client) -> None:
    assert anon_client.delete(f"/api/weeks/{MON}/objectives/1").status_code == 401
