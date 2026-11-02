import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.services import jobs
from core.testing import csrf
from growth import services
from growth.models import Achievement, JobAd, Prediction, Skill
from library.models import Item

pytestmark = pytest.mark.django_db
MONTH = dt.date(2026, 11, 1)


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def test_search_skills_by_name_or_alias_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    Skill.objects.create(user=user, name="PostgreSQL", key="postgresql", aliases=["postgres", "psql"])
    Skill.objects.create(user=user, name="SQL tuning", key="sql tuning")
    Skill.objects.create(user=user, name="Django", key="django", aliases=["drf"])
    Skill.objects.create(user=stranger(), name="SQL", key="sql")
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/skills", {"q": "SQL"}).json()["results"]
    assert len(queries) <= 4
    assert [s["name"] for s in data] == ["PostgreSQL", "SQL tuning"]

    def names(query: str) -> list[str]:
        return [s["name"] for s in client.get("/api/skills", {"q": query}).json()["results"]]

    assert names("DRF") == ["Django"]  # alias, case-insensitive
    assert names("gres") == ["PostgreSQL"]
    assert names("nothing") == []
    assert client.get("/api/skills", {"q": "sql", "freshness": "fresh"}).json()["results"] == []


def test_delete_achievement_keeps_project_and_skills(client: Client) -> None:
    user = owner(client)
    project = Item.objects.create(user=user, type="project", title="Shop")
    skill = Skill.objects.create(user=user, name="Python", key="python")
    win = Achievement.objects.create(user=user, title="Shipped", project=project)
    win.skills.add(skill)
    headers = csrf(client)
    assert client.delete(f"/api/achievements/{win.pk}", headers=headers).status_code == 204
    assert client.delete(f"/api/achievements/{win.pk}", headers=headers).status_code == 404
    assert Item.objects.filter(pk=project.pk).exists() and Skill.objects.filter(pk=skill.pk).exists()


def test_delete_prediction(client: Client) -> None:
    user = owner(client)
    row = Prediction.objects.create(user=user, statement="x", made_on=MONTH, check_on=MONTH)
    headers = csrf(client)
    assert client.delete(f"/api/predictions/{row.pk}", headers=headers).status_code == 204
    assert not Prediction.objects.exists()


def test_delete_job_ad_with_a_pending_extraction(client: Client) -> None:
    ad = services.create_job_ad(owner(client), {"title": "Engineer", "text": "Python", "month": MONTH})
    headers = csrf(client)
    assert client.delete(f"/api/market/job-ads/{ad.pk}", headers=headers).status_code == 204
    assert client.get("/api/market/job-ads").json()["results"] == []
    assert jobs.run_pending() == {"done": 1, "retry": 0, "deferred": 0, "failed": 0}  # nothing left to read


def test_delete_another_owners_rows_answers_404(client: Client) -> None:
    other = stranger()
    win = Achievement.objects.create(user=other, title="theirs")
    guess = Prediction.objects.create(user=other, statement="theirs", made_on=MONTH, check_on=MONTH)
    ad = JobAd.objects.create(user=other, title="theirs", text="t", month=MONTH)
    headers = csrf(client)
    urls = (f"/api/achievements/{win.pk}", f"/api/predictions/{guess.pk}", f"/api/market/job-ads/{ad.pk}")
    for url in urls:
        assert client.delete(url, headers=headers).status_code == 404
        assert client.delete(url).status_code == 403  # without CSRF
    assert Achievement.objects.count() == Prediction.objects.count() == JobAd.objects.count() == 1


def test_deletes_require_auth(anon_client: Client) -> None:
    for url in ("/api/achievements/1", "/api/predictions/1", "/api/market/job-ads/1"):
        assert anon_client.delete(url).status_code == 401


def test_search_achievements_predictions_and_job_ads(client: Client) -> None:
    user = owner(client)
    Achievement.objects.create(user=user, title="Shipped checkout", impact="40 s -> 12 s")
    Achievement.objects.create(user=user, title="Talk", impact="Checkout story for 30 people")
    Achievement.objects.create(user=user, title="Other")
    Achievement.objects.create(user=stranger(), title="checkout of someone else")
    Prediction.objects.create(user=user, statement="Agents replace RPA", made_on=MONTH, check_on=MONTH)
    Prediction.objects.create(
        user=user, statement="x", note="agents were early", made_on=MONTH, check_on=MONTH
    )
    Prediction.objects.create(user=user, statement="Rates fall", made_on=MONTH, check_on=MONTH)
    JobAd.objects.create(user=user, title="Data engineer", company="Rohlik", text="t", month=MONTH)
    JobAd.objects.create(user=user, title="Analyst", company="ROHLIK group", text="t", month=MONTH)
    JobAd.objects.create(user=user, title="Analyst", company="Other", text="rohlik in the text", month=MONTH)

    def titles(path: str, key: str, q: str) -> list[str]:
        return sorted(r[key] for r in client.get(path, {"q": q}).json()["results"])

    assert titles("/api/achievements", "title", "checkout") == ["Shipped checkout", "Talk"]
    assert titles("/api/predictions", "statement", "agents") == ["Agents replace RPA", "x"]
    assert titles("/api/market/job-ads", "company", "rohlik") == ["ROHLIK group", "Rohlik"]
    assert len(client.get("/api/market/job-ads", {"q": ""}).json()["results"]) == 3


def test_get_one_achievement_prediction_and_job_ad(client: Client) -> None:
    user = owner(client)
    win = Achievement.objects.create(user=user, title="Shipped")
    guess = Prediction.objects.create(user=user, statement="Agents", made_on=MONTH, check_on=MONTH)
    ad = JobAd.objects.create(user=user, title="Data engineer", text="t", month=MONTH)
    assert client.get(f"/api/achievements/{win.pk}").json()["title"] == "Shipped"
    assert client.get(f"/api/predictions/{guess.pk}").json()["statement"] == "Agents"
    assert client.get(f"/api/market/job-ads/{ad.pk}").json()["title"] == "Data engineer"
    other = stranger()
    theirs = Achievement.objects.create(user=other, title="theirs")
    assert client.get(f"/api/achievements/{theirs.pk}").status_code == 404
