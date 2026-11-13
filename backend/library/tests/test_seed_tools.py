"""manage.py seed_tools: the starter list of tools (library/tools.json) for the owner."""

from io import StringIO
from urllib.parse import urlsplit

import pytest
from django.contrib.auth.models import User
from django.core.management import call_command

from core.models import Job
from library.models import Item
from library.tools import STAGES, seed_tools, stage_tags

pytestmark = pytest.mark.django_db
OWNER = "dev@localhost"
# Tools the owner used or asked about (13/11/2026); the list must keep them
ASKED = {
    "gitleaks",
    "git-filter-repo",
    "Semgrep",
    "Trivy",
    "Bandit",
    "pip-audit",
    "npm audit",
    "GitHub CodeQL",
    "Dependabot",
    "OSV-Scanner",
    "DeepWiki",
    "GitDiagram",
    "dependency-cruiser",
    "pydeps",
    "SonarQube Cloud",
    "Snyk",
    "Playwright",
    "Vitest",
    "pytest",
    "Ruff",
    "mypy",
    "lefthook",
    "uv",
    "Sentry",
    "Docker",
    "Claude Code",
}


def seed(*args: str) -> str:
    out = StringIO()
    call_command("seed_tools", "--owner", OWNER, *args, stdout=out)
    return out.getvalue()


def owner() -> User:
    return User.objects.get(username=OWNER)


def test_the_starter_list_is_well_formed() -> None:
    tools = seed_tools()
    assert 75 <= len(tools) <= 90
    titles = [tool["title"].casefold() for tool in tools]
    assert len(set(titles)) == len(titles)  # one entry per tool, whatever the case
    assert {tool["title"] for tool in tools} >= ASKED
    for tool in tools:
        assert set(tool) == {"title", "summary", "source", "stages"}, tool["title"]
        assert 0 < len(tool["summary"]) <= 300 and " ".join(tool["summary"].split()) == tool["summary"]
        url = urlsplit(tool["source"])
        assert url.scheme == "https" and url.netloc, tool["title"]
        # known stages, in the page's order
        assert tool["stages"] and tool["stages"] == stage_tags(tool["stages"]), tool["title"]
    used = {stage for tool in tools for stage in tool["stages"]}
    assert used == set(STAGES)  # every stage of the page has tools
    stages = {tool["title"]: tool["stages"] for tool in tools}
    assert stages["Claude Code"] == ["explore", "ai"]
    assert stages["dependency-cruiser"] == stages["pydeps"] == ["explore", "deps"]


def test_seed_adds_every_tool_once_as_planned_without_images() -> None:
    first = seed()
    tools = Item.objects.filter(user=owner(), type="tool")
    n = len(seed_tools())
    assert first.strip() == f"{n} tools added, 0 already there, for {OWNER}"
    assert tools.count() == n
    assert set(tools.values_list("status", flat=True)) == {"planned"}
    assert not tools.exclude(started_at=None).exists() and not tools.exclude(finished_at=None).exists()
    semgrep = tools.get(title="Semgrep")
    assert (semgrep.source, semgrep.tags) == ("https://semgrep.dev", ["review", "security"])
    assert semgrep.summary.startswith("Quét code")
    assert not Job.objects.exists()  # a tool's picture is a logo: no fetch from its link

    again = seed()
    assert again.strip() == f"0 tools added, {n} already there, for {OWNER}"
    assert Item.objects.filter(type="tool").count() == n


def test_seed_never_changes_a_tool_the_owner_already_has() -> None:
    call_command("seed_tools", "--owner", OWNER, stdout=StringIO(), verbosity=0)  # makes the owner
    Item.objects.filter(user=owner()).delete()
    mine = Item.objects.create(
        user=owner(), type="tool", title="semgrep", status="active", summary="Của mình", tags=["security"]
    )
    before = Item.objects.filter(pk=mine.pk).values().get()
    out = seed("--verbosity", "2")
    assert "+ Semgrep" not in out and "+ Trivy" in out
    assert Item.objects.filter(pk=mine.pk).values().get() == before  # not one field touched
    assert Item.objects.filter(user=owner(), title__iexact="semgrep").count() == 1


def test_seed_works_for_the_owner_only() -> None:
    stranger = User.objects.create(username="other@x", email="other@x")
    theirs = Item.objects.create(user=stranger, type="tool", title="Semgrep", summary="Của họ")
    seed()
    assert Item.objects.filter(user=stranger).count() == 1  # nothing added for anyone else
    assert Item.objects.get(pk=theirs.pk).summary == "Của họ"
    # theirs did not count
    assert Item.objects.filter(user=owner(), type="tool", title="Semgrep").count() == 1
