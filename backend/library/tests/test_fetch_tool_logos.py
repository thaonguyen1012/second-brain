"""manage.py fetch_tool_logos: queue the logo of each of the owner's tools that has none (DECISIONS 9.10)."""

from io import StringIO
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.management import CommandError, call_command

from core.models import Job
from core.tests.fakenet import FakeNet
from library.models import Item
from library.services import FOUND_NOTHING

pytestmark = pytest.mark.django_db
OWNER = "dev@localhost"


@pytest.fixture
def owner(monkeypatch: pytest.MonkeyPatch) -> User:
    FakeNet(monkeypatch)  # no request may leave: run_jobs fetches the logos, never the command
    return User.objects.create(username=OWNER, email=OWNER)


def run(*args: str) -> str:
    out = StringIO()
    call_command("fetch_tool_logos", *args, stdout=out)
    return out.getvalue().strip()


def tool(user: User, title: str, **fields: Any) -> Item:
    return Item.objects.create(user=user, type="tool", title=title, **fields)


def job(item: Item, status: str, **payload: Any) -> Job:
    payload = {"item_id": item.pk, "url": item.source, "expect": "", **payload}
    return Job.objects.create(kind="item_image", key=f"item_image:{item.pk}", payload=payload, status=status)


def test_only_tools_with_a_link_and_no_logo_and_no_fetch_under_way_are_queued(owner: User) -> None:
    semgrep = tool(owner, "Semgrep", source="https://semgrep.dev")
    tool(owner, "Has a logo", source="https://a.test/", image_path="c" * 32 + ".webp")
    tool(owner, "No link", source="man grep")
    tool(owner, "No source")
    waiting = job(tool(owner, "Waiting", source="https://b.test/"), "pending")
    running = job(tool(owner, "Running", source="https://c.test/"), "running")
    # a fetch that ended otherwise (a logo found, then removed; an upload; given up after errors): asked again
    ended = job(tool(owner, "Ended", source="https://d.test/"), "done")
    gave_up = job(tool(owner, "Gave up", source="https://e.test/"), "failed")
    # the last fetch of its link found no logo: not asked again, unless its link changed since
    found_none = job(tool(owner, "Found none", source="https://g.test/"), "done", found=FOUND_NOTHING)
    moved = tool(owner, "Moved", source="https://h.test/new")
    job(moved, "done", url="https://h.test/old", found=FOUND_NOTHING)
    Item.objects.create(user=owner, type="book", title="Dune", source="https://blog.test/dune")  # not a tool
    stranger = User.objects.create(username="other@x", email="other@x")
    tool(stranger, "Theirs", source="https://f.test/")

    out = run("--owner", OWNER)
    assert out == (
        "4 tool logos queued, 2 already waiting, 2 without a web link, 1 whose site had no logo last time "
        f"(--again asks them again), for {OWNER}"
    )
    new = Job.objects.get(key=f"item_image:{semgrep.pk}")
    assert (new.status, new.payload) == (
        "pending",
        {"item_id": semgrep.pk, "url": "https://semgrep.dev", "expect": ""},
    )
    for armed in (ended, gave_up):
        armed.refresh_from_db()
        assert (armed.status, armed.attempts) == ("pending", 0)
    assert Job.objects.get(key=f"item_image:{moved.pk}").payload["url"] == "https://h.test/new"
    for left in (waiting, running, found_none):
        before = left.status
        left.refresh_from_db()
        assert left.status == before  # left as they were
    assert Job.objects.count() == 7  # nothing for a book, a tool with a logo, or another user's tool


def test_again_asks_the_tools_whose_site_had_no_logo(owner: User) -> None:
    item = tool(owner, "Found none", source="https://g.test/")
    found_none = job(item, "done", found=FOUND_NOTHING)
    assert run("--owner", OWNER).startswith("0 tool logos queued")
    assert run("--owner", OWNER, "--again").startswith("1 tool logos queued")
    found_none.refresh_from_db()
    assert (found_none.status, found_none.payload) == (
        "pending",
        {"item_id": item.pk, "url": "https://g.test/", "expect": ""},  # asked afresh: the mark is gone
    )


def test_running_it_again_queues_nothing_new(owner: User) -> None:
    tool(owner, "Semgrep", source="https://semgrep.dev")
    tool(owner, "Trivy", source="https://trivy.dev")
    assert run("--owner", OWNER).startswith("2 tool logos queued, 0 already waiting")
    before = list(Job.objects.values_list("key", "status", "payload", "updated_at").order_by("key"))
    assert run("--owner", OWNER).startswith("0 tool logos queued, 2 already waiting")
    assert list(Job.objects.values_list("key", "status", "payload", "updated_at").order_by("key")) == before


def test_the_owner_by_default_and_never_a_new_user(owner: User, settings: Any) -> None:
    settings.OWNER_EMAIL, settings.DEV_USER_EMAIL = "", "Dev@Localhost"
    tool(owner, "Semgrep", source="https://semgrep.dev")
    assert run().startswith("1 tool logos queued, 0 already waiting, 0 without a web link, 0 whose site")
    assert run().endswith(f"for {OWNER}")
    with pytest.raises(CommandError, match="no user nobody@x"):
        run("--owner", "nobody@x")
    assert not User.objects.filter(username="nobody@x").exists()
