import datetime as dt

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError, connection, transaction
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.testing import csrf, send
from inbox.models import InboxEntry
from library.models import Item, Note
from opportunities import services
from opportunities.models import Evidence, Opportunity, ScoreSnapshot
from weeks.models import Week

pytestmark = pytest.mark.django_db

SCORES = {"opportunity": 7, "pain": 8, "feasibility": 5, "timing": 6}


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.create(username="other@x", email="other@x")


def opportunity(user: User, title: str = "Bakery stock", **fields: object) -> Opportunity:
    return Opportunity.objects.create(
        user=user,
        title=title,
        hypothesis="Small bakeries lose money on waste and pay for a forecast.",
        **fields,
    )


def evidence(opp: Opportunity, stance: str = "supports", title: str = "Talk", **fields: object) -> Evidence:
    return Evidence.objects.create(opportunity=opp, kind="conversation", stance=stance, title=title, **fields)


def backdate(row: Opportunity | Evidence, days: int) -> None:
    type(row).objects.filter(pk=row.pk).update(created_at=timezone.now() - dt.timedelta(days=days))


def test_create_opportunity(client: Client) -> None:
    headers = csrf(client)
    body = {
        "title": "Bakery stock",
        "hypothesis": "Small bakeries lose money on waste and pay for a forecast.",
        "whyNow": "Cheap LLMs",
        "nextAction": "Talk to 3 bakers",
        "decideBy": "2026-12-01",
        "scores": {**SCORES, "note": "first guess"},
    }
    response = send(client, "post", "/api/opportunities", body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["title"], data["whyNow"], data["nextAction"], data["decideBy"]) == (
        "Bakery stock",
        "Cheap LLMs",
        "Talk to 3 bakers",
        "2026-12-01",
    )
    assert (data["decision"], data["decidedAt"], data["stale"], data["evidence"]) == ("open", None, False, [])
    assert {k: data["scores"][k] for k in SCORES} == SCORES
    assert len(data["scoreHistory"]) == 1 and data["scoreHistory"][0]["note"] == "first guess"
    # Without scores there is no snapshot; scores are 1-10; title and hypothesis are required.
    bare = send(client, "post", "/api/opportunities", {"title": "x", "hypothesis": "y"}, headers).json()
    assert bare["scores"] is None and bare["scoreHistory"] == []
    for bad in (
        {"title": "x"},
        {"hypothesis": "y"},
        {"title": "x", "hypothesis": "y", "decision": "maybe"},
        {"title": "x", "hypothesis": "y", "scores": {**SCORES, "pain": 11}},
        {"title": "x", "hypothesis": "y", "scores": {"pain": 3}},
    ):
        assert send(client, "post", "/api/opportunities", bad, headers).status_code == 400
    assert Opportunity.objects.count() == 2 and ScoreSnapshot.objects.count() == 1


def test_list_opportunities_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    for i in range(5):
        opp = opportunity(user, f"Opp {i}")
        services.record_scores(opp, {"opportunity_score": i + 1, "pain": 2, "feasibility": 3, "timing": 4})
        services.record_scores(opp, {"opportunity_score": i + 2, "pain": 2, "feasibility": 3, "timing": 4})
        evidence(opp)
        evidence(opp, "contradicts")
        evidence(opp, "contradicts")
    opportunity(stranger(), "Foreign")
    with CaptureQueriesContext(connection) as queries:
        response = client.get("/api/opportunities")
    assert response.status_code == 200
    assert len(queries) <= 4  # session + user + one page query with counts and scores
    rows = response.json()["results"]
    assert [r["title"] for r in rows] == [f"Opp {i}" for i in range(4, -1, -1)]  # newest first
    first = rows[-1]
    assert (first["evidenceSupports"], first["evidenceContradicts"]) == (1, 2)
    assert first["scores"]["opportunity"] == 2  # the newest snapshot
    assert first["lastEvidenceAt"] is not None and "evidence" not in first


def test_list_filters_by_decision_and_stale(client: Client) -> None:
    user = owner(client)
    fresh = opportunity(user, "Fresh")
    old_quiet = opportunity(user, "Old quiet", decision="keep")
    backdate(old_quiet, 40)
    old_dropped = opportunity(user, "Old dropped", decision="drop")
    backdate(old_dropped, 40)

    def titles(url: str) -> set[str]:
        return {r["title"] for r in client.get(url).json()["results"]}

    assert titles("/api/opportunities?decision=keep") == {"Old quiet"}
    assert titles("/api/opportunities?stale=true") == {"Old quiet"}
    assert titles("/api/opportunities?stale=false") == {"Fresh", "Old dropped"}
    assert client.get("/api/opportunities?stale=yes").status_code == 400
    assert client.get("/api/opportunities?decision=maybe").status_code == 400
    assert fresh.pk


def test_stale_rule(client: Client) -> None:
    """Undecided or kept, and no evidence recorded for 4 weeks (or created 4+ weeks ago without any)."""
    user = owner(client)
    young = opportunity(user, "Young")  # created now, no evidence: not stale yet
    quiet = opportunity(user, "Quiet")
    backdate(quiet, 29)
    old_evidence = opportunity(user, "Old evidence")
    backdate(old_evidence, 90)
    backdate(evidence(old_evidence), 29)
    recent = opportunity(user, "Recent evidence")
    backdate(recent, 90)
    backdate(evidence(recent, date=dt.date(2026, 1, 1)), 27)  # an old talk recorded recently counts
    built = opportunity(user, "Built", decision="build")
    backdate(built, 90)
    rows = {o.title: o for o in services.opportunities(user)}
    assert {t for t, o in rows.items() if getattr(o, "stale")} == {"Quiet", "Old evidence"}  # noqa: B009
    data = client.get(f"/api/opportunities/{quiet.pk}").json()
    assert (data["stale"], data["lastEvidenceAt"]) == (True, None)
    # New evidence makes it fresh again.
    evidence(quiet)
    assert client.get(f"/api/opportunities/{quiet.pk}").json()["stale"] is False
    assert young.pk


def test_get_opportunity_with_evidence_and_history(client: Client) -> None:
    user = owner(client)
    opp = opportunity(user)
    services.record_scores(opp, {"opportunity_score": 5, "pain": 5, "feasibility": 5, "timing": 5})
    services.record_scores(
        opp, {"opportunity_score": 6, "pain": 7, "feasibility": 5, "timing": 5, "note": "x"}
    )
    evidence(opp, title="Old talk", date=dt.date(2026, 10, 1))
    evidence(opp, "contradicts", title="New talk", date=dt.date(2026, 10, 20))
    with CaptureQueriesContext(connection) as queries:
        response = client.get(f"/api/opportunities/{opp.pk}")
    assert response.status_code == 200
    assert len(queries) <= 6  # session + user + opportunity + evidence + scores + fit
    data = response.json()
    assert [e["title"] for e in data["evidence"]] == ["New talk", "Old talk"]
    assert [s["opportunity"] for s in data["scoreHistory"]] == [6, 5]  # newest first, old values kept
    assert data["scores"]["pain"] == 7
    foreign = opportunity(stranger())
    assert client.get(f"/api/opportunities/{foreign.pk}").status_code == 404


def test_update_opportunity(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    opp = opportunity(user)
    url = f"/api/opportunities/{opp.pk}"
    data = send(client, "patch", url, {"nextAction": "Call Jana", "decision": "keep"}, headers).json()
    assert (data["nextAction"], data["decision"], data["title"]) == ("Call Jana", "keep", "Bakery stock")
    assert data["decidedAt"] is not None
    data = send(client, "patch", url, {"decision": "open", "decideBy": None}, headers).json()
    assert (data["decision"], data["decidedAt"], data["decideBy"]) == ("open", None, None)
    assert send(client, "patch", url, {"decision": "later"}, headers).status_code == 400
    # Scores are not patched; they only grow through POST .../scores.
    send(client, "patch", url, {"scores": SCORES}, headers)
    assert ScoreSnapshot.objects.count() == 0
    foreign = opportunity(stranger())
    response = send(client, "patch", f"/api/opportunities/{foreign.pk}", {"title": "x"}, headers)
    assert response.status_code == 404


def test_record_scores_keeps_history(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    opp = opportunity(user)
    url = f"/api/opportunities/{opp.pk}/scores"
    first = send(client, "post", url, SCORES, headers)
    assert first.status_code == 201
    assert {k: first.json()[k] for k in SCORES} == SCORES
    second = send(client, "post", url, {**SCORES, "timing": 9, "note": "AI act news"}, headers)
    assert second.status_code == 201
    history = list(ScoreSnapshot.objects.filter(opportunity=opp).values_list("timing", flat=True))
    assert history == [9, 6]  # the old row is untouched
    assert client.get(f"/api/opportunities/{opp.pk}").json()["scores"]["timing"] == 9
    for bad in ({**SCORES, "pain": 0}, {**SCORES, "timing": 11}, {"pain": 5}):
        assert send(client, "post", url, bad, headers).status_code == 400
    with pytest.raises(IntegrityError), transaction.atomic():
        ScoreSnapshot.objects.create(opportunity=opp, opportunity_score=0, pain=1, feasibility=1, timing=1)
    foreign = opportunity(stranger())
    assert send(client, "post", f"/api/opportunities/{foreign.pk}/scores", SCORES, headers).status_code == 404


def test_add_evidence(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    opp = opportunity(user)
    url = f"/api/opportunities/{opp.pk}/evidence"
    item = Item.objects.create(user=user, type="article", title="Waste report")
    note = Note.objects.create(user=user, title="Market notes", markdown="...")
    entry = InboxEntry.objects.create(user=user, url="https://x.cz/a", og_title="Bakery news")
    talk = {"kind": "conversation", "stance": "supports", "title": "Jana, baker", "note": "Throws away 15%"}
    response = send(client, "post", url, {**talk, "date": "2026-10-30"}, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["kind"], data["title"], data["date"], data["item"]) == (
        "conversation",
        "Jana, baker",
        "2026-10-30",
        None,
    )
    linked = [
        ({"kind": "item", "stance": "supports", "item": item.pk}, "Waste report"),
        ({"kind": "note", "stance": "contradicts", "libraryNote": note.pk}, "Market notes"),
        ({"kind": "inbox", "stance": "supports", "inboxEntry": entry.pk}, "Bakery news"),
        (
            {"kind": "link", "stance": "supports", "title": "HN thread", "url": "https://news.example.com/1"},
            "HN thread",
        ),
    ]
    for body, title in linked:
        response = send(client, "post", url, body, headers)
        assert response.status_code == 201, response.json()
        assert response.json()["title"] == title  # taken from the linked row when not sent
    assert response.json()["date"] == timezone.localdate().isoformat()
    other = stranger()
    foreign_item = Item.objects.create(user=other, type="book", title="Foreign")
    foreign_note = Note.objects.create(user=other, markdown="x")
    foreign_entry = InboxEntry.objects.create(user=other, text="x")
    for bad in (
        {"kind": "item", "stance": "supports", "item": foreign_item.pk},  # another user's rows
        {"kind": "note", "stance": "supports", "libraryNote": foreign_note.pk},
        {"kind": "inbox", "stance": "supports", "inboxEntry": foreign_entry.pk},
        {"kind": "inbox", "stance": "supports", "inboxEntry": entry.pk},  # already evidence here
        {"kind": "item", "stance": "supports"},  # missing link
        {"kind": "conversation", "stance": "supports", "item": item.pk, "title": "x"},  # wrong link
        {"kind": "conversation", "stance": "supports"},  # no title
        {"kind": "link", "stance": "supports", "title": "x"},  # no url
        {"kind": "link", "stance": "supports", "title": "x", "url": "ftp://x"},
        {**talk, "stance": "neutral"},
    ):
        assert send(client, "post", url, bad, headers).status_code == 400, bad
    assert Evidence.objects.count() == 5
    foreign = opportunity(other)
    assert send(client, "post", f"/api/opportunities/{foreign.pk}/evidence", talk, headers).status_code == 404


def test_update_evidence(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    opp = opportunity(user)
    row = evidence(opp, note="maybe")
    url = f"/api/opportunities/{opp.pk}/evidence/{row.pk}"
    response = send(client, "patch", url, {"stance": "contradicts", "note": "No, they pay nothing"}, headers)
    assert response.status_code == 200
    data = response.json()
    assert (data["stance"], data["note"], data["title"], data["kind"]) == (
        "contradicts",
        "No, they pay nothing",
        "Talk",
        "conversation",
    )
    assert send(client, "patch", url, {"stance": "neutral"}, headers).status_code == 400
    assert send(client, "patch", url, {"kind": "item"}, headers).json()["kind"] == "conversation"  # ignored
    other_opp = opportunity(user, "Other")
    wrong = f"/api/opportunities/{other_opp.pk}/evidence/{row.pk}"
    assert send(client, "patch", wrong, {"note": "x"}, headers).status_code == 404
    foreign = evidence(opportunity(stranger()))
    foreign_url = f"/api/opportunities/{foreign.opportunity_id}/evidence/{foreign.pk}"
    assert send(client, "patch", foreign_url, {"note": "x"}, headers).status_code == 404


def test_attach_inbox_entry(client: Client) -> None:
    user = owner(client)
    headers = csrf(client)
    opp = opportunity(user)
    entry = InboxEntry.objects.create(
        user=user, url="https://x.cz/a", og_title="Bakery news", suggested_destination="opportunity"
    )
    url = f"/api/opportunities/{opp.pk}/evidence/inbox"
    body = {"inboxEntry": entry.pk, "stance": "supports", "note": "Prices up 20%"}
    response = send(client, "post", url, body, headers)
    assert response.status_code == 201
    data = response.json()
    assert (data["created"], data["inboxStatus"]) == (True, "archived")
    ev = data["evidence"]
    assert (ev["kind"], ev["inboxEntry"], ev["title"], ev["url"], ev["note"]) == (
        "inbox",
        entry.pk,
        "Bakery news",
        "https://x.cz/a",
        "Prices up 20%",
    )
    assert ev["date"] == timezone.localdate(entry.created_at).isoformat()
    entry.refresh_from_db()
    assert entry.status == "archived"
    # Repeating it is harmless: the same evidence comes back.
    again = send(client, "post", url, body, headers)
    assert again.status_code == 200 and again.json()["evidence"]["id"] == ev["id"]
    assert Evidence.objects.count() == 1
    # archive=false keeps the entry in the inbox (e.g. evidence for two opportunities).
    later = InboxEntry.objects.create(user=user, text="Talk with a baker", status="later")
    response = send(
        client, "post", url, {"inboxEntry": later.pk, "stance": "contradicts", "archive": False}, headers
    )
    assert response.status_code == 201 and response.json()["inboxStatus"] == "later"
    foreign_entry = InboxEntry.objects.create(user=stranger(), text="x")
    response = send(client, "post", url, {"inboxEntry": foreign_entry.pk, "stance": "supports"}, headers)
    assert response.status_code == 400
    foreign_entry.refresh_from_db()
    assert foreign_entry.status == "inbox"
    assert send(client, "post", url, {"inboxEntry": later.pk}, headers).status_code == 400  # stance needed


def test_week_review_lists_opportunity_evidence(client: Client) -> None:
    user = owner(client)
    monday = timezone.localdate() - dt.timedelta(days=timezone.localdate().weekday())
    Week.objects.create(user=user, start_date=monday)
    busy = opportunity(user, "Busy")
    evidence(busy)
    evidence(busy, "contradicts")
    old = evidence(busy)
    backdate(old, 10)  # recorded before this week
    quiet = opportunity(user, "Quiet")
    backdate(quiet, 40)
    other = opportunity(stranger(), "Foreign")
    evidence(other)
    response = client.get(f"/api/weeks/{monday.isoformat()}/review")
    assert response.status_code == 200
    data = response.json()
    assert data["opportunities"]["withEvidence"] == [
        {"id": busy.pk, "title": "Busy", "decision": "open", "supports": 1, "contradicts": 1}
    ]
    assert data["opportunities"]["stale"] == [
        {"id": quiet.pk, "title": "Quiet", "decision": "open", "lastEvidenceAt": None}
    ]
    assert "time" in data and len(data["days"]) == 7  # existing fields stay


def test_opportunities_require_auth(anon_client: Client) -> None:
    for url in ("/api/opportunities", "/api/opportunities/1"):
        assert anon_client.get(url).status_code == 401
    writes = [
        ("post", "/api/opportunities"),
        ("patch", "/api/opportunities/1"),
        ("post", "/api/opportunities/1/scores"),
        ("post", "/api/opportunities/1/evidence"),
        ("patch", "/api/opportunities/1/evidence/1"),
        ("post", "/api/opportunities/1/evidence/inbox"),
    ]
    for method, url in writes:
        assert send(anon_client, method, url, {}, {}).status_code == 401
    assert Opportunity.objects.count() == 0


def test_opportunities_require_csrf(client: Client) -> None:
    user = owner(client)
    opp = opportunity(user)
    row = evidence(opp)
    entry = InboxEntry.objects.create(user=user, text="x")
    base = f"/api/opportunities/{opp.pk}"
    writes = [
        ("post", "/api/opportunities", {"title": "x", "hypothesis": "y"}),
        ("patch", base, {"title": "x"}),
        ("post", f"{base}/scores", SCORES),
        ("post", f"{base}/evidence", {"kind": "conversation", "stance": "supports", "title": "x"}),
        ("patch", f"{base}/evidence/{row.pk}", {"note": "x"}),
        ("post", f"{base}/evidence/inbox", {"inboxEntry": entry.pk, "stance": "supports"}),
    ]
    for method, url, body in writes:
        assert send(client, method, url, body, {}).status_code == 403
    assert Opportunity.objects.count() == 1 and Evidence.objects.count() == 1
    assert ScoreSnapshot.objects.count() == 0 and Opportunity.objects.get().title == "Bakery stock"
    assert InboxEntry.objects.get().status == "inbox"
