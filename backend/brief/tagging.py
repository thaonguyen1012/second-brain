"""LLM work for the morning brief, through the LLM seam (DECISIONS 10.3, 10.4), only in background jobs.

`news_tag`: one call per news item (title, source name and the stored 500-character excerpt; never the URL):
topic tags, a one-line summary, a "new tool/skill" flag and a relevance score 1-5.
`brief_intro`: at most one call per brief (per day): a short intro written from the chosen items' titles and
summaries. Feed text is data, never instructions (10.5).
"""

import json
from functools import cache
from typing import Any

from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator

from brief import services
from brief.models import Area, DailyBrief, NewsItem
from core.services import jobs, llm
from library.services import normalize_tags

TAG_PURPOSE = "news_tag"
INTRO_PURPOSE = "brief_intro"
# The six areas of DECISIONS 6.2 plus the groups of the morning brief (5) and the target market (9.5).
CONTROLLED_TAGS = (
    *Area.values,
    "ai tools",
    "agents",
    "automation",
    "data",
    "programming",
    "security",
    "startups",
    "pricing",
    "sales",
    "marketing",
    "economy",
    "jobs",
    "eu",
    "local",
)
MAX_FREE_TAGS = 2
MAX_INTRO = 600


class NewsTags(BaseModel):
    """The only shape accepted for one news item; anything else leaves it untagged (`failed`)."""

    model_config = ConfigDict(extra="forbid")

    tags: list[str] = Field(min_length=1, max_length=5)
    summary: str = Field(min_length=1, max_length=160)
    new_tool: bool
    relevance: int = Field(ge=1, le=5)

    @field_validator("tags")
    @classmethod
    def known_tags(cls, value: list[str]) -> list[str]:
        tags = normalize_tags(value)
        free = [t for t in tags if t not in CONTROLLED_TAGS]
        if len(free) > MAX_FREE_TAGS:
            raise ValueError(f"more than {MAX_FREE_TAGS} free tags")
        if any(len(t.split()) > 3 or len(t) > 40 for t in free):
            raise ValueError("free tags have at most 3 words")
        return tags

    @field_validator("summary")
    @classmethod
    def one_line(cls, value: str) -> str:
        if "\n" in value or "\r" in value:
            raise ValueError("summary must be one line")
        return value.strip()


class BriefIntro(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intro: str = Field(min_length=1, max_length=MAX_INTRO)


def _load(name: str, purpose: str, **values: str) -> llm.Prompt:
    """backend/prompts/<name>.md: a `version: N` line, `---`, then the provider-neutral system prompt."""
    header, _, body = (settings.BASE_DIR / "prompts" / f"{name}.md").read_text().partition("\n---\n")
    for key, value in {"reader": llm.reader_profile(), **values}.items():
        body = body.replace("{" + key + "}", value)
    return llm.Prompt(purpose, header.removeprefix("version:").strip(), body.strip())


@cache
def tag_prompt() -> llm.Prompt:
    return _load("news_tag", TAG_PURPOSE, controlled_tags=", ".join(CONTROLLED_TAGS))


@cache
def intro_prompt() -> llm.Prompt:
    return _load("brief_intro", INTRO_PURPOSE, max_chars=str(MAX_INTRO))


def news_text(title: str, source: str, excerpt: str) -> str:
    """The user message: the item as JSON data inside <news> tags."""
    data = {"title": title[:300], "source": source[:100], "text": excerpt[:500]}
    return "<news>\n" + json.dumps(data, ensure_ascii=False) + "\n</news>"


def brief_text(items: list[NewsItem]) -> str:
    data = [{"title": i.title[:300], "summary": i.summary, "tags": i.tags} for i in items]
    return "<brief>\n" + json.dumps(data, ensure_ascii=False) + "\n</brief>"


def suggest(user_text: str, use_cache: bool = True) -> NewsTags:
    return llm.complete(tag_prompt(), user_text, NewsTags, use_cache=use_cache)


@jobs.handler(services.TAG_JOB)
def tag_news(payload: dict[str, Any]) -> None:
    item = NewsItem.objects.select_related("source").filter(pk=payload["news_item_id"]).first()
    if item is None or item.tag_status != NewsItem.TagStatus.QUEUED:
        return
    try:
        result = suggest(news_text(item.title, item.source.name, item.excerpt))
    except (llm.RateLimited, llm.BudgetExceeded) as exc:
        raise jobs.RetryLater(str(exc)) from exc
    except llm.InvalidOutput as exc:  # fallback: no tags, not in any brief, reason kept
        item.tag_status, item.error = NewsItem.TagStatus.FAILED, f"tagging: {exc}"[:500]
        item.save(update_fields=["tag_status", "error", "updated_at"])
        return
    item.tags, item.summary, item.new_tool, item.relevance = (
        result.tags,
        result.summary,
        result.new_tool,
        result.relevance,
    )
    item.tag_status, item.tagged_at, item.error = NewsItem.TagStatus.TAGGED, timezone.now(), ""
    item.save(
        update_fields=[
            "tags",
            "summary",
            "new_tool",
            "relevance",
            "tag_status",
            "tagged_at",
            "error",
            "updated_at",
        ]
    )


@jobs.handler(services.INTRO_JOB)
def write_intro(payload: dict[str, Any]) -> None:
    brief = DailyBrief.objects.filter(pk=payload["brief_id"]).first()
    if brief is None or brief.intro:
        return
    items = [e.news_item for e in brief.entries.select_related("news_item").order_by("position")]
    if not items:
        return
    try:
        result = llm.complete(intro_prompt(), brief_text(items), BriefIntro)
    except (llm.RateLimited, llm.BudgetExceeded) as exc:
        raise jobs.RetryLater(str(exc)) from exc
    except llm.InvalidOutput as exc:  # fallback: the brief stays, without an intro
        brief.error = f"intro: {exc}"[:500]
        brief.save(update_fields=["error", "updated_at"])
        return
    brief.intro, brief.error = result.intro.strip(), ""
    brief.save(update_fields=["intro", "error", "updated_at"])
