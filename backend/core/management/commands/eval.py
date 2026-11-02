import json
import time
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser

from core.services import llm

# purpose -> golden set directory under backend/evals/
SUITES = {"tag": "inbox_tag"}


class Command(BaseCommand):
    help = (
        "Run a golden set against the real LLM (DECISIONS 10.3) and assert in code: schema valid, expected "
        "tags present, summary length. Run before any prompt or model change. Never part of make check."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("suite", choices=sorted(SUITES))

    def handle(self, *args: Any, **options: Any) -> None:
        from inbox import tagging

        files = sorted((settings.BASE_DIR / "evals" / SUITES[options["suite"]]).glob("*.json"))
        if not files:
            raise CommandError("golden set is empty")
        failures = 0
        for path in files:
            problems = self._check(path, tagging)
            failures += bool(problems)
            status = "FAIL " + "; ".join(problems) if problems else "ok"
            self.stdout.write(f"{path.name}: {status}")
        self.stdout.write(f"{len(files) - failures}/{len(files)} passed, model {settings.LLM_MODEL}")
        if failures:
            raise CommandError(f"{failures} case(s) failed")

    def _check(self, path: Path, tagging: Any) -> list[str]:
        case = json.loads(path.read_text())
        source, expect = case["input"], case["expect"]
        user = tagging.item_text(source.get("title", ""), source.get("site", ""), source.get("text", ""))
        for _ in range(3):  # free tier: wait out a rate limit instead of failing the case
            try:
                result = tagging.suggest(user, use_cache=False)
                break
            except llm.RateLimited:
                time.sleep(60)
            except llm.LlmError as exc:
                return [f"{type(exc).__name__}: {exc}"]
        else:
            return ["rate limited 3 times"]
        problems = [
            f"missing tag {t!r} (got {result.tags})" for t in expect.get("tags", []) if t not in result.tags
        ]
        if len(result.summary) > 160 or "\n" in result.summary:
            problems.append("summary is not one line of at most 160 characters")
        if "destination" in expect and result.destination != expect["destination"]:
            problems.append(f"destination {result.destination!r}, expected {expect['destination']!r}")
        return problems
