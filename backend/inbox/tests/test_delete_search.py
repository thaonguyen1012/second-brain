from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext

from core.models import Job
from core.services import jobs
from core.testing import csrf
from inbox.models import InboxEntry
from library.models import Item
from opportunities.models import Evidence, Opportunity

pytestmark = pytest.mark.django_db
IMAGE = "a" * 32 + ".webp"


def owner(client: Client) -> User:
    client.get("/api/me")
    return User.objects.get(username="dev@localhost")


def stranger() -> User:
    return User.objects.get_or_create(username="other@x", email="other@x")[0]


def test_search_inbox_without_n_plus_one(client: Client) -> None:
    user = owner(client)
    item = Item.objects.create(user=user, type="article", title="Linked")
    InboxEntry.objects.create(user=user, url="https://a.test/p", og_title="Pricing for bakeries", item=item)
    InboxEntry.objects.create(user=user, text="Call the BAKER about stock", status="later")
    InboxEntry.objects.create(user=user, url="https://bakery.test/x")
    InboxEntry.objects.create(user=user, text="unrelated", summary="bakery")  # summary is not searched
    InboxEntry.objects.create(user=stranger(), text="bakery of someone else")
    with CaptureQueriesContext(connection) as queries:
        data = client.get("/api/inbox", {"q": "bake"}).json()["results"]
    assert len(queries) <= 4
    assert [e["ogTitle"] or e["text"] or e["url"] for e in data] == [
        "https://bakery.test/x",
        "Call the BAKER about stock",
        "Pricing for bakeries",
    ]
    assert data[2]["itemTitle"] == "Linked"
    later = client.get("/api/inbox", {"q": "bake", "status": "later"}).json()["results"]
    assert [e["text"] for e in later] == ["Call the BAKER about stock"]


def test_delete_entry_keeps_evidence_and_drops_unused_thumbnail(
    client: Client, settings: Any, tmp_path: Path, django_capture_on_commit_callbacks: Any
) -> None:
    settings.THUMBS_DIR = tmp_path
    (tmp_path / IMAGE).write_bytes(b"webp")
    user = owner(client)
    shared = InboxEntry.objects.create(user=user, url="https://a.test/1", og_image_path=IMAGE)
    twin = InboxEntry.objects.create(user=user, url="https://a.test/2", og_image_path=IMAGE)
    opportunity = Opportunity.objects.create(user=user, title="o", hypothesis="h")
    proof = Evidence.objects.create(
        opportunity=opportunity, kind="inbox", stance="supports", inbox_entry=shared, title="Post"
    )
    jobs.enqueue("unfurl", f"unfurl:{shared.pk}", {"entry_id": shared.pk})
    headers = csrf(client)
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"/api/inbox/{shared.pk}", headers=headers).status_code == 204
    assert (tmp_path / IMAGE).exists()  # the twin still shows it
    proof.refresh_from_db()
    assert proof.inbox_entry is None and proof.title == "Post"
    jobs.run_pending()  # the pending unfurl job finds nothing and ends quietly
    assert Job.objects.get().status == Job.Status.DONE
    with django_capture_on_commit_callbacks(execute=True):
        assert client.delete(f"/api/inbox/{twin.pk}", headers=headers).status_code == 204
    assert not (tmp_path / IMAGE).exists()
    assert client.delete(f"/api/inbox/{twin.pk}", headers=headers).status_code == 404


def test_delete_another_owners_entry_answers_404(client: Client) -> None:
    entry = InboxEntry.objects.create(user=stranger(), text="theirs")
    assert client.delete(f"/api/inbox/{entry.pk}", headers=csrf(client)).status_code == 404
    assert InboxEntry.objects.filter(pk=entry.pk).exists()


def test_delete_entry_requires_csrf(client: Client) -> None:
    entry = InboxEntry.objects.create(user=owner(client), text="mine")
    assert client.delete(f"/api/inbox/{entry.pk}").status_code == 403
    assert InboxEntry.objects.filter(pk=entry.pk).exists()


def test_delete_entry_requires_auth(anon_client: Client) -> None:
    assert anon_client.delete("/api/inbox/1").status_code == 401
