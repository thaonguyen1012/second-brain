"""startedAt / finishedAt follow the status on every API write of an Item: POST/PATCH /api/items and
POST/PATCH /api/projects (the Dự án board PATCHes only the status)."""

import datetime as dt
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from core.testing import csrf, send

pytestmark = pytest.mark.django_db

EARLIER = "2026-10-01T08:00:00Z"
BASES = ["/api/items", "/api/projects"]


def create(client: Client, base: str, **fields: Any) -> dict[str, Any]:
    body = {"title": "Deep Work", **({"type": "book"} if base == "/api/items" else {}), **fields}
    response = send(client, "post", base, body, csrf(client))
    assert response.status_code == 201, response.json()
    data: dict[str, Any] = response.json()
    return data


def patch(client: Client, url: str, **fields: Any) -> tuple[str | None, str | None]:
    response = send(client, "patch", url, fields, csrf(client))
    assert response.status_code == 200, response.json()
    return response.json()["startedAt"], response.json()["finishedAt"]


def moment(value: str | None) -> dt.datetime:
    assert value is not None
    return dt.datetime.fromisoformat(value)


@pytest.mark.parametrize("base", BASES)
def test_each_status_change_moves_the_dates(client: Client, base: str) -> None:
    url = f"{base}/{create(client, base)['id']}"
    before = timezone.now()

    started, finished = patch(client, url, status="active")
    assert finished is None and moment(started) >= before
    # done keeps the start and sets the finish
    same_start, finished = patch(client, url, status="done")
    assert same_start == started and moment(finished) >= moment(started)
    # no status change leaves both dates alone
    assert patch(client, url, status="done") == (started, finished)
    assert patch(client, url, title="Deep Work, 2nd ed.") == (started, finished)
    # back to active: the finish is cleared, the start kept
    assert patch(client, url, status="active") == (started, None)
    # dropped clears the finish and keeps the start
    patch(client, url, status="done")
    assert patch(client, url, status="dropped") == (started, None)
    # planned clears both
    assert patch(client, url, status="planned") == (None, None)
    # done straight from planned: a finish, the start stays empty
    started, finished = patch(client, url, status="done")
    assert started is None and moment(finished) >= before


@pytest.mark.parametrize("base", BASES)
def test_creating_with_a_status_sets_the_same_dates(client: Client, base: str) -> None:
    before = timezone.now()
    active = create(client, base, status="active")
    assert moment(active["startedAt"]) >= before and active["finishedAt"] is None
    done = create(client, base, status="done")
    assert done["startedAt"] is None and moment(done["finishedAt"]) >= before
    for status in ("planned", "dropped"):
        data = create(client, base, status=status)
        assert (data["startedAt"], data["finishedAt"]) == (None, None)
    default = create(client, base)
    assert (default["status"], default["startedAt"], default["finishedAt"]) == ("planned", None, None)


@pytest.mark.parametrize("base", BASES)
def test_dates_sent_in_the_same_request_win(client: Client, base: str) -> None:
    earlier = moment(EARLIER)
    data = create(client, base, status="done", finishedAt=EARLIER)
    assert data["startedAt"] is None and moment(data["finishedAt"]) == earlier
    data = create(client, base, status="active", startedAt=EARLIER)
    assert moment(data["startedAt"]) == earlier and data["finishedAt"] is None
    url = f"{base}/{data['id']}"

    started, finished = patch(client, url, status="done", finishedAt=EARLIER)
    assert moment(started) == earlier and moment(finished) == earlier
    # an explicit null wins too: active without a start date
    assert patch(client, url, status="planned") == (None, None)
    assert patch(client, url, status="active", startedAt=None) == (None, None)
    # planned keeps a start sent with it; the finish is still cleared
    started, finished = patch(client, url, status="planned", startedAt=EARLIER)
    assert moment(started) == earlier and finished is None


@pytest.mark.parametrize("base", BASES)
def test_a_date_that_is_already_set_is_kept(client: Client, base: str) -> None:
    url = f"{base}/{create(client, base)['id']}"
    earlier = moment(EARLIER)
    # a start date set by hand on a planned Item survives the move to active
    patch(client, url, startedAt=EARLIER)
    started, finished = patch(client, url, status="active")
    assert moment(started) == earlier and finished is None
    # a finish date sent with dropped survives the move to done
    patch(client, url, status="dropped", finishedAt=EARLIER)
    started, finished = patch(client, url, status="done")
    assert moment(started) == earlier and moment(finished) == earlier
