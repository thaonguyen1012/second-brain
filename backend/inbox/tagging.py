"""AI tagging of inbox entries: tags, a one-line summary and a destination (DECISIONS 9.2), through the
LLM seam. Only the title, site name and the first 500 characters are sent (DECISIONS 10.4)."""

import json
import logging
from functools import cache
from typing import Any, Literal
from urllib.parse import urlsplit

from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.services import jobs, llm
from inbox.models import InboxEntry
from library.services import normalize_tags

logger = logging.getLogger(__name__)

PURPOSE = "inbox_tag"
MAX_SENT_CHARS = 500
CONTROLLED_TAGS = (
    "ai",
    "programming",
    "web",
    "data",
    "security",
    "devops",
    "product",
    "design",
    "career",
    "freelance",
    "business",
    "marketing",
    "productivity",
    "learning",
    "languages",
    "finance",
    "health",
    "entertainment",
)
MAX_FREE_TAGS = 2


class TagSuggestion(BaseModel):
    """The only shape accepted from the LLM; anything else falls back to no tags."""

    model_config = ConfigDict(extra="forbid")

    tags: list[str] = Field(min_length=1, max_length=6)
    summary: str = Field(min_length=1, max_length=160)
    destination: Literal["read_later", "book", "opportunity", "note"]

    @field_validator("tags")
    @classmethod
    def known_tags(cls, value: list[str]) -> list[str]:
        tags = normalize_tags(value)
        free = [t for t in tags if t not in CONTROLLED_TAGS]
        if len(free) > MAX_FREE_TAGS:
            raise ValueError(f"more than {MAX_FREE_TAGS} free tags")
        if any(len(t.split()) > 3 for t in free):
            raise ValueError("free tags have at most 3 words")
        return tags

    @field_validator("summary")
    @classmethod
    def one_line(cls, value: str) -> str:
        if "\n" in value or "\r" in value:
            raise ValueError("summary must be one line")
        return value.strip()


@cache
def prompt() -> llm.Prompt:
    """backend/prompts/inbox_tag.md: a `version: N` line, `---`, then the provider-neutral system prompt."""
    header, _, body = (settings.BASE_DIR / "prompts" / "inbox_tag.md").read_text().partition("\n---\n")
    version = header.removeprefix("version:").strip()
    body = body.replace("{controlled_tags}", ", ".join(CONTROLLED_TAGS))
    body = body.replace("{reader}", llm.reader_profile())
    return llm.Prompt(PURPOSE, version, body.strip())


def item_text(title: str, site: str, text: str) -> str:
    """The user message: the item as JSON data inside <item> tags."""
    data = {"title": title[:300], "site": site[:100], "text": text[:MAX_SENT_CHARS]}
    return "<item>\n" + json.dumps(data, ensure_ascii=False) + "\n</item>"


def entry_text(entry: InboxEntry) -> str:
    # Never the full URL (query strings carry tokens): the host at most, nothing for refused URLs.
    host = "" if entry.error.startswith("unfurl refused") else (urlsplit(entry.url).hostname or "")
    title = entry.og_title or host
    body = " ".join(part for part in (entry.og_description, entry.text) if part)
    return item_text(title, entry.og_site_name, body)


def suggest(user_text: str, use_cache: bool = True) -> TagSuggestion:
    return llm.complete(prompt(), user_text, TagSuggestion, use_cache=use_cache)


@jobs.handler("tag")
def tag_entry(payload: dict[str, Any]) -> None:
    entry = InboxEntry.objects.filter(pk=payload["entry_id"]).first()
    if entry is None or entry.processed:
        return
    try:
        result = suggest(entry_text(entry))
    except (llm.RateLimited, llm.BudgetExceeded) as exc:
        raise jobs.RetryLater(str(exc)) from exc
    except llm.InvalidOutput as exc:  # fallback: no tags, still unprocessed, reason kept
        entry.error = f"tagging: {exc}"[:500]
        entry.save(update_fields=["error", "updated_at"])
        return
    entry.suggested_tags = result.tags
    entry.summary = result.summary
    entry.suggested_destination = result.destination
    entry.processed, entry.processed_at, entry.error = True, timezone.now(), ""
    entry.save(
        update_fields=[
            "suggested_tags",
            "summary",
            "suggested_destination",
            "processed",
            "processed_at",
            "error",
            "updated_at",
        ]
    )


def enqueue(entry: InboxEntry) -> None:
    jobs.enqueue("tag", f"tag:{entry.pk}", {"entry_id": entry.pk})
