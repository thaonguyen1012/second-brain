"""Tools (Items of type tool, the Công cụ page): the stages a tool is tagged with, and the starter list that
`manage.py seed_tools` adds.

STAGES are tag slugs in the page's order; web/lib/tools.ts holds the same slugs (a web test compares them).
The starter list is data, so it lives in tools.json next to this file: each tool's title, a one-line summary
of what it is for (Vietnamese, the owner's language), its official URL and its stages.
"""

import json
from collections.abc import Iterable
from pathlib import Path
from typing import TypedDict

STAGES = (
    "explore",  # reading and dissecting codebases
    "practice",  # learning by doing
    "plan",  # planning and design
    "code",
    "review",
    "test",
    "security",
    "deps",  # dependencies and the supply chain
    "git",
    "ci",  # CI/CD and deploys
    "observe",  # monitoring and logs
    "data",
    "ai",
    "docs",  # docs and diagrams
)

SEED_FILE = Path(__file__).with_name("tools.json")


class SeedTool(TypedDict):
    title: str
    summary: str
    source: str
    stages: list[str]


def seed_tools() -> list[SeedTool]:
    """The starter list, in the order of tools.json."""
    tools: list[SeedTool] = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    return tools


def stage_tags(stages: Iterable[str]) -> list[str]:
    """`stages` in STAGES order, unknown ones left out."""
    wanted = set(stages)
    return [stage for stage in STAGES if stage in wanted]
