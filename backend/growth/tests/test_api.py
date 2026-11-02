import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.models import Job
from core.testing import csrf, send
from growth import services
from growth.models import JobAd, Skill, SkillEvidence
from library.models import Item, Note
from opportunities.models import Opportunity

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def skill(user: User, name: str = "Python", aliases: list[str] | None = None) -> Skill:
    return services.save_skill(Skill(user=user), {"name": name, "aliases": aliases or []})


def evidence(row: Skill, days_ago: int, title: str = "Shipped") -> SkillEvidence:
    date = timezone.localdate() - dt.timedelta(days=days_ago)
    return SkillEvidence.objects.create(skill=row, kind="link", title=title, url="https://x.test", date=date)


def ad(user: User, month: dt.date, skills: list[str], processed: bool = True, **fields: object) -> JobAd:
    values: dict[str, object] = {"title": "Engineer", "text": "...", **fields}
    return JobAd.objects.create(user=user, month=month, skills=skills, processed=processed, **values)


THIS_MONTH = services.month_start(timezone.localdate())
LAST_MONTH = services.months_before(THIS_MONTH, 1)


# --- Skills -----------------------------------------------------------------------------------------


def test_create_skill(client: Client) -> None:
    headers = csrf(client)
    body = {"name": "  Next.js ", "aliases": ["NextJS", "next", "nextjs"], "note": "App router"}
    response = send(client, "post", "/api/skills", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["name"], data["aliases"], data["note"]) == ("Next.js", ["nextjs", "next"], "App router")
    assert (data["freshness"], data["lastEvidenceOn"], data["evidenceCount"], data["evidence"]) == (
        "faded",
        None,
        0,
        [],
    )
    assert "rating" not in data and "level" not in data  # no self-rating to maintain
    # Name and aliases must stay unambiguous for matching; a name is required.
    for bad in ({"name": "next.js"}, {"name": "Vercel", "aliases": ["nextjs"]}, {"name": "next"}, {}):
        assert send(client, "post", "/api/skills", bad, headers).status_code == 400
    assert Skill.objects.count() == 1 and Skill.objects.get().key == "next.js"


def test_list_skills_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    for name in ("Rust", "Django", "Czech", "AWS", "Python"):
        row = skill(user, name)
        evidence(row, 10)
        evidence(row, 400)
    skill(stranger(), "Go")
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/skills")
    assert response.status_code == 200
    assert len(queries) <= 3  # session + user + one page query with the annotations
    rows = response.json()["results"]
    assert [r["name"] for r in rows] == ["AWS", "Czech", "Django", "Python", "Rust"]  # by name
    assert rows[0]["evidenceCount"] == 2 and rows[0]["freshness"] == "fresh" and "evidence" not in rows[0]


def test_freshness_fades_with_the_newest_evidence(client: Client) -> None:
    user = owner(client)
    fresh, aging, faded, never = (skill(user, n) for n in ("Fresh", "Aging", "Faded", "Never"))
    evidence(fresh, 400)
    evidence(fresh, 30)  # the newest evidence decides
    evidence(aging, 120)
    evidence(faded, 200)
    by_name = {r["name"]: r for r in client.get("/api/skills").json()["results"]}
    assert {n: r["freshness"] for n, r in by_name.items()} == {
        "Fresh": "fresh",
        "Aging": "aging",
        "Faded": "faded",
        "Never": "faded",
    }
    assert by_name["Fresh"]["lastEvidenceOn"] == str(timezone.localdate() - dt.timedelta(days=30))
    # Exactly at the edge: 6 months without evidence is faded, a day less is still aging.
    today = dt.date(2026, 11, 2)
    edge = skill(user, "Edge")
    SkillEvidence.objects.create(skill=edge, kind="link", title="x", date=dt.date(2026, 5, 2))
    assert services.skills(user, today).get(pk=edge.pk).freshness == "faded"  # type: ignore[attr-defined]
    SkillEvidence.objects.create(skill=edge, kind="link", title="x", date=dt.date(2026, 5, 3))
    assert services.skills(user, today).get(pk=edge.pk).freshness == "aging"  # type: ignore[attr-defined]
    assert services.months_before(dt.date(2026, 8, 31), 6) == dt.date(2026, 2, 28)
    # The filter.
    names = {r["name"] for r in client.get("/api/skills?freshness=faded").json()["results"]}
    assert names == {"Faded", "Never"}
    assert client.get("/api/skills?freshness=old").status_code == 400
    assert never.pk  # created, listed as faded


def test_get_skill_with_evidence(client: Client) -> None:
    user = owner(client)
    row = skill(user)
    evidence(row, 50, "Older")
    evidence(row, 5, "Newer")
    data = client.get(f"/api/skills/{row.pk}").json()
    assert [e["title"] for e in data["evidence"]] == ["Newer", "Older"]
    assert client.get(f"/api/skills/{skill(stranger(), 'Go').pk}").status_code == 404


def test_update_skill(client: Client) -> None:
    user = owner(client)
    row = skill(user, "Postgres")
    skill(user, "MySQL")
    headers = csrf(client)
    response = send(
        client, "patch", f"/api/skills/{row.pk}", {"name": "PostgreSQL", "aliases": ["Postgres"]}, headers
    )
    assert response.status_code == 200
    assert (response.json()["name"], response.json()["aliases"]) == ("PostgreSQL", ["postgres"])
    assert send(client, "patch", f"/api/skills/{row.pk}", {"aliases": ["mysql"]}, headers).status_code == 400
    foreign = skill(stranger(), "Go")
    assert send(client, "patch", f"/api/skills/{foreign.pk}", {"note": "x"}, headers).status_code == 404


def test_add_evidence(client: Client) -> None:
    user = owner(client)
    row = skill(user)
    project = Item.objects.create(user=user, type="project", title="Pekárna eshop")
    note = Note.objects.create(user=user, title="Case study", markdown="...")
    other_item = Item.objects.create(user=stranger(), type="project", title="Not mine")
    headers = csrf(client)
    url = f"/api/skills/{row.pk}/evidence"
    shipped = send(client, "post", url, {"kind": "item", "item": project.pk, "date": "2026-10-01"}, headers)
    assert shipped.status_code == 201
    assert (shipped.json()["title"], shipped.json()["item"], shipped.json()["date"]) == (
        "Pekárna eshop",
        project.pk,
        "2026-10-01",
    )
    written = send(client, "post", url, {"kind": "note", "libraryNote": note.pk}, headers).json()
    assert (written["title"], written["date"]) == ("Case study", str(timezone.localdate()))
    article = {"kind": "link", "title": "Blog post", "url": "https://blog.test/a"}
    assert send(client, "post", url, article, headers).status_code == 201
    for bad in (
        {"kind": "item", "item": other_item.pk},  # not the owner's
        {"kind": "item"},  # missing link
        {"kind": "link", "item": project.pk, "title": "x", "url": "https://x.test"},  # link of another kind
        {"kind": "link", "title": "x"},  # no url
        {"kind": "link", "title": "x", "url": "javascript:alert(1)"},
        {"kind": "shipped"},
    ):
        assert send(client, "post", url, bad, headers).status_code == 400
    foreign = skill(stranger(), "Go")
    assert send(client, "post", f"/api/skills/{foreign.pk}/evidence", article, headers).status_code == 404
    assert SkillEvidence.objects.count() == 3


def test_update_and_delete_evidence(client: Client) -> None:
    user = owner(client)
    row = skill(user)
    old = evidence(row, 300)
    headers = csrf(client)
    url = f"/api/skills/{row.pk}/evidence/{old.pk}"
    today = str(timezone.localdate())
    response = send(client, "patch", url, {"date": today, "note": "redone"}, headers)
    assert response.status_code == 200 and response.json()["date"] == today
    assert client.get(f"/api/skills/{row.pk}").json()["freshness"] == "fresh"
    assert send(client, "patch", url, {"url": "ftp://x"}, headers).status_code == 400
    other = skill(user, "Go")
    assert send(client, "patch", f"/api/skills/{other.pk}/evidence/{old.pk}", {}, headers).status_code == 404
    assert client.delete(url, headers=headers).status_code == 204
    assert client.delete(url, headers=headers).status_code == 404
    assert client.get(f"/api/skills/{row.pk}").json()["freshness"] == "faded"


# --- Job ads ----------------------------------------------------------------------------------------


def test_create_job_ad_enqueues_extraction(client: Client) -> None:
    headers = csrf(client)
    body = {"title": "Product Engineer", "company": "Acme", "url": "https://jobs.test/1", "text": "Python"}
    response = send(client, "post", "/api/market/job-ads", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["month"], data["processed"], data["skills"]) == (f"{THIS_MONTH:%Y-%m}", False, [])
    job = Job.objects.get()
    assert job.kind == "jd_skills" and job.payload["job_ad_id"] == data["id"]
    # Skills typed by hand need no job; month as YYYY-MM.
    typed = {**body, "month": "2026-09", "skills": ["Python", " python ", "Czech"]}
    data = send(client, "post", "/api/market/job-ads", typed, headers).json()
    assert (data["month"], data["skills"], data["processed"]) == ("2026-09", ["python", "czech"], True)
    assert Job.objects.count() == 1
    for bad in ({"title": "x"}, {"text": "x"}, {**body, "month": "2026-13"}, {**body, "month": "2026-1"}):
        assert send(client, "post", "/api/market/job-ads", bad, headers).status_code == 400


def test_list_job_ads_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    for i in range(5):
        ad(user, THIS_MONTH, ["python"], title=f"Ad {i}")
    ad(user, LAST_MONTH, ["rust"], title="Older")
    ad(stranger(), THIS_MONTH, ["go"])
    with CaptureQueriesContext(connection) as queries:
        response = client.get(f"/api/market/job-ads?month={THIS_MONTH:%Y-%m}")
    assert response.status_code == 200 and len(queries) <= 3
    assert [r["title"] for r in response.json()["results"]] == [f"Ad {i}" for i in range(4, -1, -1)]
    assert len(client.get("/api/market/job-ads").json()["results"]) == 6
    assert client.get("/api/market/job-ads?month=11-2026").status_code == 400


def test_update_job_ad(client: Client) -> None:
    user = owner(client)
    row = ad(user, THIS_MONTH, ["python"], seniority="senior")
    headers = csrf(client)
    url = f"/api/market/job-ads/{row.pk}"
    # Month or url only: the extraction stands.
    data = send(client, "patch", url, {"month": "2026-10"}, headers).json()
    assert (data["month"], data["processed"], data["skills"]) == ("2026-10", True, ["python"])
    assert Job.objects.count() == 0
    # New text: extraction again.
    data = send(client, "patch", url, {"text": "Rust and Czech"}, headers).json()
    assert (data["processed"], data["skills"], data["seniority"]) == (False, [], "")
    assert Job.objects.get().payload["digest"] == services.digest(JobAd.objects.get())
    # A hand correction wins over the job.
    data = send(client, "patch", url, {"skills": ["Rust", "Czech"]}, headers).json()
    assert (data["processed"], data["skills"]) == (True, ["rust", "czech"])
    foreign = ad(stranger(), THIS_MONTH, [])
    assert (
        send(client, "patch", f"/api/market/job-ads/{foreign.pk}", {"title": "x"}, headers).status_code == 404
    )


# --- Market report ----------------------------------------------------------------------------------


def test_market_report_counts_and_gaps(client: Client) -> None:
    user = owner(client)
    python = skill(user, "Python")
    evidence(python, 20)
    postgres = skill(user, "PostgreSQL", ["postgres"])
    evidence(postgres, 300)  # faded
    react = skill(user, "React")
    evidence(react, 120)  # aging: not a gap
    ad(user, THIS_MONTH, ["python", "postgres", "llm apis", "react"], seniority="senior")
    ad(user, THIS_MONTH, ["Python", "postgresql", "llm apis", "czech"], seniority="senior")
    ad(user, THIS_MONTH, ["python", "python"], seniority="mid")  # once per ad
    ad(user, THIS_MONTH, ["kubernetes"], processed=False)  # not extracted yet: not counted
    ad(user, LAST_MONTH, ["llm apis", "python"])
    ad(stranger(), THIS_MONTH, ["go", "go"])
    with CaptureQueriesContext(connection) as queries:
        response = client.get(f"/api/market/report?month={THIS_MONTH:%Y-%m}")
    assert response.status_code == 200 and len(queries) <= 4
    data = response.json()
    assert (data["month"], data["jobAds"], data["processed"]) == (f"{THIS_MONTH:%Y-%m}", 4, 3)
    assert data["seniority"] == [{"level": "senior", "count": 2}, {"level": "mid", "count": 1}]
    lines = {line["name"]: line for line in data["skills"]}
    assert [line["name"] for line in data["skills"]] == ["Python", "llm apis", "PostgreSQL", "czech", "React"]
    assert (lines["Python"]["count"], lines["Python"]["previousCount"], lines["Python"]["gap"]) == (
        3,
        1,
        False,
    )
    assert lines["Python"]["skill"]["freshness"] == "fresh"
    assert (lines["PostgreSQL"]["count"], lines["PostgreSQL"]["skill"]["freshness"]) == (2, "faded")
    assert (lines["llm apis"]["skill"], lines["llm apis"]["previousCount"]) == (None, 1)
    assert lines["React"]["gap"] is False and lines["React"]["skill"]["freshness"] == "aging"
    assert [g["name"] for g in data["gaps"]] == ["llm apis", "PostgreSQL", "czech"]
    assert "go" not in lines
    # Default month = this month; a bad month answers 400; an empty month is an empty mirror.
    assert client.get("/api/market/report").json()["jobAds"] == 4
    assert client.get("/api/market/report?month=2026").status_code == 400
    empty = client.get("/api/market/report?month=2020-01").json()
    assert (empty["jobAds"], empty["skills"], empty["gaps"]) == (0, [], [])


# --- Opportunity fit (step 4 TODO) ------------------------------------------------------------------


def test_opportunity_fit_links_own_skills(client: Client) -> None:
    user = owner(client)
    python = skill(user, "Python")
    evidence(python, 3)
    sales = skill(user, "Sales")
    foreign = skill(stranger(), "Go")
    headers = csrf(client)
    body = {"title": "Bakery stock", "hypothesis": "Bakeries pay for a forecast.", "fit": [python.pk]}
    created = send(client, "post", "/api/opportunities", body, headers).json()
    assert created["fit"] == [{"id": python.pk, "name": "Python", "freshness": "fresh"}]
    url = f"/api/opportunities/{created['id']}"
    data = send(client, "patch", url, {"fit": [sales.pk, python.pk]}, headers).json()
    assert [s["name"] for s in data["fit"]] == ["Python", "Sales"]
    assert send(client, "patch", url, {"fit": [foreign.pk]}, headers).status_code == 400
    assert send(client, "patch", url, {"title": "Renamed"}, headers).json()["fit"][1]["freshness"] == "faded"
    listed = client.get("/api/opportunities").json()["results"][0]
    assert len(listed["fit"]) == 2
    assert set(Opportunity.objects.get().fit.values_list("name", flat=True)) == {"Python", "Sales"}
    assert send(client, "patch", url, {"fit": []}, headers).json()["fit"] == []


# --- Auth -------------------------------------------------------------------------------------------


def test_growth_requires_auth(anon_client: Client) -> None:
    for url in ("/api/skills", "/api/skills/1", "/api/market/job-ads", "/api/market/report"):
        assert anon_client.get(url).status_code == 401
    writes = [
        ("post", "/api/skills"),
        ("patch", "/api/skills/1"),
        ("post", "/api/skills/1/evidence"),
        ("patch", "/api/skills/1/evidence/1"),
        ("delete", "/api/skills/1/evidence/1"),
        ("post", "/api/market/job-ads"),
        ("patch", "/api/market/job-ads/1"),
    ]
    for method, url in writes:
        assert send(anon_client, method, url, {}, {}).status_code == 401
    assert Skill.objects.count() == 0 and JobAd.objects.count() == 0


def test_growth_requires_csrf(client: Client) -> None:
    user = owner(client)
    row = skill(user)
    proof = evidence(row, 1)
    job_ad = ad(user, THIS_MONTH, ["python"])
    writes = [
        ("post", "/api/skills", {"name": "Rust"}),
        ("patch", f"/api/skills/{row.pk}", {"name": "Go"}),
        ("post", f"/api/skills/{row.pk}/evidence", {"kind": "link", "title": "x", "url": "https://x.test"}),
        ("patch", f"/api/skills/{row.pk}/evidence/{proof.pk}", {"note": "x"}),
        ("delete", f"/api/skills/{row.pk}/evidence/{proof.pk}", {}),
        ("post", "/api/market/job-ads", {"title": "x", "text": "y"}),
        ("patch", f"/api/market/job-ads/{job_ad.pk}", {"title": "x"}),
    ]
    for method, url, body in writes:
        assert send(client, method, url, body, {}).status_code == 403
    assert Skill.objects.get().name == "Python" and SkillEvidence.objects.count() == 1
    assert JobAd.objects.get().title == "Engineer" and Job.objects.count() == 0
