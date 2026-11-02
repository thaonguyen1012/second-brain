import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.testing import csrf
from inbox.models import InboxEntry
from opportunities.models import Evidence, Opportunity

pytestmark = pytest.mark.django_db


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def test_search_opportunities_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    Opportunity.objects.create(user=user, title="Bakery stock", hypothesis="Waste costs money")
    Opportunity.objects.create(user=user, title="Tutor", hypothesis="Parents pay for BAKERY-style routines")
    Opportunity.objects.create(user=user, title="Other", hypothesis="h", why_now="bakery")  # not searched
    Opportunity.objects.create(user=stranger(), title="Bakery", hypothesis="theirs")
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/opportunities", {"q": "bakery"}).json()["results"]
    assert len(queries) <= 5  # session + user + page + fit prefetch
    assert [o["title"] for o in data] == ["Tutor", "Bakery stock"]
    assert client.get("/api/opportunities", {"q": "bakery", "decision": "drop"}).json()["results"] == []


def test_delete_evidence(client: Client) -> None:
    user = owner(client)
    opportunity = Opportunity.objects.create(user=user, title="o", hypothesis="h")
    entry = InboxEntry.objects.create(user=user, text="talk")
    proof = Evidence.objects.create(
        opportunity=opportunity, kind="inbox", stance="supports", inbox_entry=entry, title="talk"
    )
    other = Opportunity.objects.create(user=user, title="o2", hypothesis="h")
    headers = csrf(client)
    # The evidence id under another opportunity of the owner does not match.
    wrong = f"/api/opportunities/{other.pk}/evidence/{proof.pk}"
    assert client.delete(wrong, headers=headers).status_code == 404
    url = f"/api/opportunities/{opportunity.pk}/evidence/{proof.pk}"
    assert client.delete(url, headers=headers).status_code == 204
    assert client.delete(url, headers=headers).status_code == 404
    assert InboxEntry.objects.filter(pk=entry.pk).exists()
    detail = client.get(f"/api/opportunities/{opportunity.pk}").json()
    assert detail["evidence"] == [] and detail["evidenceSupports"] == 0


def test_delete_another_owners_evidence_answers_404(client: Client) -> None:
    theirs = Opportunity.objects.create(user=stranger(), title="o", hypothesis="h")
    proof = Evidence.objects.create(opportunity=theirs, kind="conversation", stance="supports", title="t")
    url = f"/api/opportunities/{theirs.pk}/evidence/{proof.pk}"
    assert client.delete(url, headers=csrf(client)).status_code == 404
    assert client.delete(url).status_code == 403  # no CSRF token: refused before the lookup
    assert Evidence.objects.filter(pk=proof.pk).exists()


def test_delete_evidence_requires_auth(anon_client: Client) -> None:
    assert anon_client.delete("/api/opportunities/1/evidence/1").status_code == 401
