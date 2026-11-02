import json
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from pydantic import BaseModel

from core.services import llm

# purpose -> golden set directory under backend/evals/
SUITES = {"tag": "inbox_tag", "jd": "jd_skills", "brief": "news_tag"}


def _call(fn: Callable[[], BaseModel]) -> BaseModel | str:
    """The validated reply, or why there is none."""
    for _ in range(3):  # free tier: wait out a rate limit instead of failing the case
        try:
            return fn()
        except llm.RateLimited:
            time.sleep(60)
        except llm.LlmError as exc:
            return f"{type(exc).__name__}: {exc}"
    return "rate limited 3 times"


def check_tag(case: dict[str, Any]) -> list[str]:
    from inbox import tagging

    source, expect = case["input"], case["expect"]
    user = tagging.item_text(source.get("title", ""), source.get("site", ""), source.get("text", ""))
    result = _call(lambda: tagging.suggest(user, use_cache=False))
    if isinstance(result, str):
        return [result]
    assert isinstance(result, tagging.TagSuggestion)
    problems = [
        f"missing tag {t!r} (got {result.tags})" for t in expect.get("tags", []) if t not in result.tags
    ]
    if len(result.summary) > 160 or "\n" in result.summary:
        problems.append("summary is not one line of at most 160 characters")
    if "destination" in expect and result.destination != expect["destination"]:
        problems.append(f"destination {result.destination!r}, expected {expect['destination']!r}")
    return problems


def check_jd(case: dict[str, Any]) -> list[str]:
    """`expect.skills`: each entry a name or a list of accepted names; `absent`: names that must not appear;
    `seniority`: a level or a list of accepted levels."""
    from growth import extraction

    source, expect = case["input"], case["expect"]
    user = extraction.ad_text(source.get("title", ""), source.get("company", ""), source.get("text", ""))
    result = _call(lambda: extraction.extract(user, use_cache=False))
    if isinstance(result, str):
        return [result]
    assert isinstance(result, extraction.JdSkills)
    problems = []
    for wanted in expect.get("skills", []):
        names = [wanted] if isinstance(wanted, str) else wanted
        if not set(names) & set(result.skills):
            problems.append(f"missing skill {names} (got {result.skills})")
    problems += [f"unexpected skill {n!r}" for n in expect.get("absent", []) if n in result.skills]
    if "seniority" in expect:
        levels = [expect["seniority"]] if isinstance(expect["seniority"], str) else expect["seniority"]
        if result.seniority not in levels:
            problems.append(f"seniority {result.seniority!r}, expected {levels}")
    return problems


def check_brief(case: dict[str, Any]) -> list[str]:
    """Morning-brief tagging. `expect.tags`: each entry a tag or a list of accepted tags; `new_tool`: the
    flag; `relevance`: [lowest, highest] accepted."""
    from brief import tagging

    source, expect = case["input"], case["expect"]
    user = tagging.news_text(source.get("title", ""), source.get("source", ""), source.get("text", ""))
    result = _call(lambda: tagging.suggest(user, use_cache=False))
    if isinstance(result, str):
        return [result]
    assert isinstance(result, tagging.NewsTags)
    problems = []
    for wanted in expect.get("tags", []):
        names = [wanted] if isinstance(wanted, str) else wanted
        if not set(names) & set(result.tags):
            problems.append(f"missing tag {names} (got {result.tags})")
    if len(result.summary) > 160 or "\n" in result.summary:
        problems.append("summary is not one line of at most 160 characters")
    if "new_tool" in expect and result.new_tool != expect["new_tool"]:
        problems.append(f"new_tool {result.new_tool}, expected {expect['new_tool']}")
    if "relevance" in expect:
        low, high = expect["relevance"]
        if not low <= result.relevance <= high:
            problems.append(f"relevance {result.relevance}, expected {low}-{high}")
    return problems


CHECKS: dict[str, Callable[[dict[str, Any]], list[str]]] = {
    "tag": check_tag,
    "jd": check_jd,
    "brief": check_brief,
}


class Command(BaseCommand):
    help = (
        "Run a golden set against the real LLM (DECISIONS 10.3) and assert in code: schema valid, expected "
        "tags or skills present. Run before any prompt or model change. Never part of make check."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("suite", choices=sorted(SUITES))

    def handle(self, *args: Any, **options: Any) -> None:
        suite = options["suite"]
        files = sorted((settings.BASE_DIR / "evals" / SUITES[suite]).glob("*.json"))
        if not files:
            raise CommandError("golden set is empty")
        failures = 0
        for path in files:
            problems = self._check(path, CHECKS[suite])
            failures += bool(problems)
            status = "FAIL " + "; ".join(problems) if problems else "ok"
            self.stdout.write(f"{path.name}: {status}")
        self.stdout.write(f"{len(files) - failures}/{len(files)} passed, model {settings.LLM_MODEL}")
        if failures:
            raise CommandError(f"{failures} case(s) failed")

    def _check(self, path: Path, check: Callable[[dict[str, Any]], list[str]]) -> list[str]:
        return check(json.loads(path.read_text()))
