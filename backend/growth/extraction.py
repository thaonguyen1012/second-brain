"""Skills a job ad asks for, through the LLM seam (DECISIONS 9.2 Market, 10.3, 10.4).

Job ads are public text, so up to MAX_SENT_CHARS of the description is sent (not the 500-character cap of
private inbox content). Runs only in the `jd_skills` background job, never inside a request.
"""

import json
from functools import cache
from typing import Any, Literal

from django.conf import settings
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.services import jobs, llm
from growth import services
from growth.models import JobAd

PURPOSE = "jd_skills"
MAX_SENT_CHARS = 4000
MAX_SKILLS = 15
MAX_SKILL_WORDS = 4


class JdSkills(BaseModel):
    """The only shape accepted from the LLM; anything else leaves the ad unprocessed."""

    model_config = ConfigDict(extra="forbid")

    skills: list[str] = Field(min_length=1, max_length=MAX_SKILLS)
    seniority: Literal["junior", "mid", "senior", "lead", "unknown"]

    @field_validator("skills")
    @classmethod
    def short_names(cls, value: list[str]) -> list[str]:
        names: list[str] = []
        for raw in value:
            name = services.normalize_skill(raw)
            if not name or len(raw.strip()) > 40 or len(name.split()) > MAX_SKILL_WORDS:
                raise ValueError(f"not a short skill name: {raw[:40]!r}")
            if name not in names:
                names.append(name)
        return names


@cache
def prompt() -> llm.Prompt:
    """backend/prompts/jd_skills.md: a `version: N` line, `---`, then the provider-neutral system prompt."""
    header, _, body = (settings.BASE_DIR / "prompts" / "jd_skills.md").read_text().partition("\n---\n")
    version = header.removeprefix("version:").strip()
    body = body.replace("{max_skills}", str(MAX_SKILLS)).replace("{max_chars}", str(MAX_SENT_CHARS))
    body = body.replace("{reader}", llm.reader_profile())
    return llm.Prompt(PURPOSE, version, body.strip())


def ad_text(title: str, company: str, text: str) -> str:
    """The user message: the ad as JSON data inside <job_ad> tags (never the URL)."""
    data = {"title": title[:200], "company": company[:200], "text": text[:MAX_SENT_CHARS]}
    return "<job_ad>\n" + json.dumps(data, ensure_ascii=False) + "\n</job_ad>"


def extract(user_text: str, use_cache: bool = True) -> JdSkills:
    return llm.complete(prompt(), user_text, JdSkills, use_cache=use_cache)


@jobs.handler(services.JD_JOB)
def extract_skills(payload: dict[str, Any]) -> None:
    ad = JobAd.objects.filter(pk=payload["job_ad_id"]).first()
    if ad is None or ad.processed or services.digest(ad) != payload["digest"]:
        return  # gone, done (or corrected by hand), or edited since: a newer job reads the new text
    try:
        result = extract(ad_text(ad.title, ad.company, ad.text))
    except (llm.RateLimited, llm.BudgetExceeded) as exc:
        raise jobs.RetryLater(str(exc)) from exc
    except llm.InvalidOutput as exc:  # fallback: no skills, still unprocessed, reason kept
        ad.error = f"extraction: {exc}"[:500]
        ad.save(update_fields=["error", "updated_at"])
        return
    ad.skills, ad.seniority = result.skills, result.seniority
    ad.processed, ad.processed_at, ad.error = True, timezone.now(), ""
    ad.save(update_fields=["skills", "seniority", "processed", "processed_at", "error", "updated_at"])
