import datetime as dt
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from brief import services
from brief.models import BriefEntry, DailyBrief, NewsItem, Source
from core.testing import csrf, send
from growth.services import month_start
from opportunities.models import Evidence, Opportunity

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def feed(user: User, name: str = "Simon") -> Source:
    return Source.objects.create(user=user, name=name, feed_url=f"https://{name}.test/feed", area="ai")


def news(source: Source, title: str, **fields: Any) -> NewsItem:
    values: dict[str, Any] = {
        "url": f"https://n.test/{title}",
        "tags": ["ai"],
        "summary": f"S {title}",
        "relevance": 3,
        "tag_status": "tagged",
        **fields,
    }
    return NewsItem.objects.create(user=source.user, source=source, title=title, dedupe_key=title, **values)


def backdate(item: NewsItem, days: int) -> None:
    NewsItem.objects.filter(pk=item.pk).update(created_at=timezone.now() - dt.timedelta(days=days))


def test_list_news_with_filters_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    simon, hn = feed(user), feed(user, "hn")
    for i in range(6):
        news(simon if i % 2 else hn, f"n{i}", tags=["ai", "agents"] if i < 2 else ["economy"])
    tool = news(simon, "tool", new_tool=True, relevance=5, published=timezone.now())
    old = news(hn, "old", tag_status="skipped", relevance=None, tags=[])
    backdate(old, 3)
    news(feed(stranger(), "theirs"), "foreign")
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/news")
    assert response.status_code == 200
    assert len(queries) <= 3  # session + user + one page query joined with the source
    data = response.json()["results"]
    assert len(data) == 8 and data[0]["title"] == "tool"
    assert data[0] == {
        "id": tool.pk,
        "source": {"id": simon.pk, "name": "Simon", "area": "ai"},
        "title": "tool",
        "url": "https://n.test/tool",
        "published": data[0]["published"],
        "excerpt": "",
        "tags": ["ai"],
        "summary": "S tool",
        "newTool": True,
        "relevance": 5,
        "tagStatus": "tagged",
        "createdAt": data[0]["createdAt"],
    }

    def titles(query: str) -> list[str]:
        return sorted(r["title"] for r in client.get(f"/api/news?{query}").json()["results"])

    assert titles("tag=Agents") == ["n0", "n1"]
    assert titles("newTool=true") == ["tool"]
    assert titles("minRelevance=4") == ["tool"]
    assert titles("tagStatus=skipped") == ["old"]
    assert titles(f"source={simon.pk}") == ["n1", "n3", "n5", "tool"]
    assert "old" not in titles(f"date={timezone.localdate()}")
    assert titles(f"date={timezone.localdate() - dt.timedelta(days=3)}") == ["old"]
    for bad in ("newTool=yes", "minRelevance=9", "date=2026-13-01", "tagStatus=x", "source=abc"):
        assert client.get(f"/api/news?{bad}").status_code == 400


def test_today_brief_and_brief_by_date(client: Client) -> None:
    user = owner(client)
    source = feed(user)
    today = timezone.localdate()
    assert client.get("/api/brief/today").status_code == 404
    items = [news(source, f"b{i}") for i in range(3)]
    brief = DailyBrief.objects.create(user=user, date=today, intro="Hôm nay...", generated_at=timezone.now())
    for position, item in enumerate(reversed(items)):
        BriefEntry.objects.create(brief=brief, news_item=item, position=position)
    other = DailyBrief.objects.create(
        user=stranger(), date=today - dt.timedelta(days=1), generated_at=timezone.now()
    )
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/brief/today")
    assert response.status_code == 200
    assert len(queries) <= 4  # session + user + brief + entries with items and sources
    data = response.json()
    assert (data["date"], data["intro"]) == (today.isoformat(), "Hôm nay...")
    assert [i["title"] for i in data["items"]] == ["b2", "b1", "b0"]
    assert data["items"][0]["source"]["name"] == "Simon"
    assert client.get(f"/api/brief/{today.isoformat()}").json()["items"][0]["id"] == items[2].pk
    assert client.get(f"/api/brief/{other.date.isoformat()}").status_code == 404  # not the owner's
    assert client.get("/api/brief/2026-02-30").status_code == 400
    assert client.get("/api/brief/yesterday").status_code == 404


def test_topic_counts_per_iso_week(client: Client) -> None:
    user = owner(client)
    source = feed(user)
    news(source, "a", tags=["ai", "agents"])
    news(source, "b", tags=["ai"])
    news(source, "c", tags=["ai"], tag_status="failed")  # not counted
    backdate(news(source, "d", tags=["economy", "ai"]), 7)
    backdate(news(source, "e", tags=["economy"]), 400)  # outside the window
    news(feed(stranger(), "x"), "f", tags=["ai"])
    response = client.get("/api/news/topics?weeks=3")
    assert response.status_code == 200
    weeks = response.json()["weeks"]
    current = services.week_start(timezone.localdate())
    assert [w["start"] for w in weeks] == [(current - dt.timedelta(weeks=n)).isoformat() for n in (2, 1, 0)]
    iso = current.isocalendar()
    assert weeks[2]["week"] == f"{iso.year}-W{iso.week:02d}"
    assert weeks[2]["items"] == 2
    assert weeks[2]["topics"] == [{"tag": "ai", "count": 2}, {"tag": "agents", "count": 1}]
    assert weeks[1]["topics"] == [{"tag": "ai", "count": 1}, {"tag": "economy", "count": 1}]
    assert weeks[0] == {"week": weeks[0]["week"], "start": weeks[0]["start"], "items": 0, "topics": []}
    assert len(client.get("/api/news/topics").json()["weeks"]) == 8
    assert client.get("/api/news/topics?weeks=0").status_code == 400


def test_news_item_becomes_opportunity_evidence(client: Client) -> None:
    user = owner(client)
    item = news(feed(user), "voice", published=timezone.now() - dt.timedelta(days=2))
    opportunity = Opportunity.objects.create(user=user, title="Voice", hypothesis="h")
    headers = csrf(client)
    url = f"/api/opportunities/{opportunity.pk}/evidence/news"
    response = send(client, "post", url, {"newsItem": item.pk, "stance": "supports"}, headers)
    assert response.status_code == 201
    data = response.json()
    assert data["created"] is True
    evidence = data["evidence"]
    assert (evidence["kind"], evidence["stance"], evidence["title"], evidence["url"], evidence["note"]) == (
        "link",
        "supports",
        "voice",
        "https://n.test/voice",
        "S voice",
    )
    assert evidence["date"] == timezone.localdate(item.published).isoformat()
    again = send(client, "post", url, {"newsItem": item.pk, "stance": "contradicts"}, headers)
    assert again.status_code == 200 and again.json()["created"] is False
    assert Evidence.objects.count() == 1
    detail = client.get(f"/api/opportunities/{opportunity.pk}").json()
    assert detail["evidenceSupports"] == 1


def test_news_evidence_checks_ownership(client: Client) -> None:
    user = owner(client)
    mine = news(feed(user), "mine")
    theirs = news(feed(stranger(), "x"), "theirs")
    my_opportunity = Opportunity.objects.create(user=user, title="Mine", hypothesis="h")
    their_opportunity = Opportunity.objects.create(user=stranger(), title="Theirs", hypothesis="h")
    headers = csrf(client)
    url = f"/api/opportunities/{my_opportunity.pk}/evidence/news"
    assert (
        send(client, "post", url, {"newsItem": theirs.pk, "stance": "supports"}, headers).status_code == 400
    )
    assert send(client, "post", url, {"newsItem": mine.pk}, headers).status_code == 400
    foreign = f"/api/opportunities/{their_opportunity.pk}/evidence/news"
    assert (
        send(client, "post", foreign, {"newsItem": mine.pk, "stance": "supports"}, headers).status_code == 404
    )
    assert Evidence.objects.count() == 0


def test_market_report_lists_new_tools_of_the_month(client: Client) -> None:
    user = owner(client)
    source = feed(user)
    news(source, "claude-code", new_tool=True, relevance=5)
    news(source, "mcp", new_tool=True, relevance=3)
    news(source, "opinion", new_tool=False)
    backdate(news(source, "last-year", new_tool=True), 400)
    news(feed(stranger(), "x"), "foreign", new_tool=True)
    report = client.get("/api/market/report").json()
    assert [n["title"] for n in report["newTools"]] == ["claude-code", "mcp"]
    assert report["newTools"][0]["newTool"] is True
    assert {"month", "jobAds", "processed", "seniority", "skills", "gaps"} <= report.keys()
    month = month_start(timezone.localdate())
    assert report["month"] == f"{month:%Y-%m}"


def test_brief_requires_auth(anon_client: Client) -> None:
    for url in ("/api/news", "/api/news/topics", "/api/brief/today", "/api/brief/2026-11-02"):
        assert anon_client.get(url).status_code == 401
    assert send(anon_client, "post", "/api/opportunities/1/evidence/news", {}, {}).status_code == 401


def test_news_evidence_requires_csrf(client: Client) -> None:
    user = owner(client)
    item = news(feed(user), "x")
    opportunity = Opportunity.objects.create(user=user, title="O", hypothesis="h")
    url = f"/api/opportunities/{opportunity.pk}/evidence/news"
    assert send(client, "post", url, {"newsItem": item.pk, "stance": "supports"}, {}).status_code == 403
    assert Evidence.objects.count() == 0
