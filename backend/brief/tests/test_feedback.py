import json
from io import StringIO
from pathlib import Path

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from brief.models import BriefEntry, DailyBrief, NewsItem, Source
from core.testing import csrf, send

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def news(user: User, title: str, excerpt: str = "") -> NewsItem:
    source, _ = Source.objects.get_or_create(
        user=user, feed_url="https://simon.test/feed", defaults={"name": "Simon", "area": "ai"}
    )
    return NewsItem.objects.create(
        user=user,
        source=source,
        title=title,
        url=f"https://n.test/{title}",
        dedupe_key=title,
        excerpt=excerpt,
    )


def test_rate_news_item_and_see_it_in_todays_brief(client: Client) -> None:
    user = owner(client)
    item = news(user, "Agents")
    brief = DailyBrief.objects.create(user=user, date=timezone.localdate(), generated_at=timezone.now())
    BriefEntry.objects.create(brief=brief, news_item=item, position=0)
    headers = csrf(client)
    assert client.get("/api/brief/today").json()["items"][0]["feedback"] is None
    response = send(client, "patch", f"/api/news/{item.pk}", {"feedback": "useful"}, headers)
    assert response.status_code == 200
    assert response.json()["feedback"] == "useful" and response.json()["source"]["name"] == "Simon"
    item.refresh_from_db()
    assert item.feedback == "useful" and item.feedback_at is not None
    assert client.get("/api/brief/today").json()["items"][0]["feedback"] == "useful"
    cleared = send(client, "patch", f"/api/news/{item.pk}", {"feedback": None}, headers)
    assert cleared.json()["feedback"] is None
    item.refresh_from_db()
    assert item.feedback == "" and item.feedback_at is None
    assert send(client, "patch", f"/api/news/{item.pk}", {"feedback": "meh"}, headers).status_code == 400
    assert send(client, "patch", f"/api/news/{item.pk}", {}, headers).status_code == 400


def test_rate_another_owners_item_answers_404(client: Client) -> None:
    theirs = news(User.objects.create(username="other@x", email="other@x"), "theirs")
    headers = csrf(client)
    assert send(client, "patch", f"/api/news/{theirs.pk}", {"feedback": "useful"}, headers).status_code == 404
    assert send(client, "patch", f"/api/news/{theirs.pk}", {"feedback": "useful"}, {}).status_code == 403
    theirs.refresh_from_db()
    assert theirs.feedback == ""


def test_rate_requires_auth(anon_client: Client) -> None:
    assert send(anon_client, "patch", "/api/news/1", {"feedback": "useful"}, {}).status_code == 401


def test_export_brief_feedback_writes_golden_cases(client: Client, tmp_path: Path) -> None:
    user = owner(client)
    useful = news(user, "Useful", "x" * 500)
    useful.feedback = "useful"
    useful.save()
    dull = news(user, "Dull", "short")
    dull.feedback = "not_useful"
    dull.save()
    news(user, "Unrated", "never exported")
    other = User.objects.create(username="other@x", email="other@x")
    foreign = news(other, "Foreign")
    NewsItem.objects.filter(pk=foreign.pk).update(feedback="useful")

    out = StringIO()
    args = ("export_brief_feedback", "--owner", "dev@localhost", "--out", str(tmp_path))
    call_command(*args, stdout=out)
    assert "2 written, 0 kept" in out.getvalue()
    assert {p.name for p in tmp_path.iterdir()} == {f"fb-{dull.pk}.json", f"fb-{useful.pk}.json"}
    case = json.loads((tmp_path / f"fb-{useful.pk}.json").read_text())
    assert case == {
        "input": {"title": "Useful", "source": "Simon", "text": "x" * 500},
        "expect": {"relevance": [3, 5]},
        "feedback": "useful",
    }
    assert json.loads((tmp_path / f"fb-{dull.pk}.json").read_text())["expect"] == {"relevance": [1, 2]}

    # A hand-edited case is kept unless --overwrite.
    (tmp_path / f"fb-{dull.pk}.json").write_text("{}")
    call_command(*args, stdout=StringIO())
    assert (tmp_path / f"fb-{dull.pk}.json").read_text() == "{}"
    call_command(*args, "--overwrite", stdout=StringIO())
    assert json.loads((tmp_path / f"fb-{dull.pk}.json").read_text())["feedback"] == "not_useful"
