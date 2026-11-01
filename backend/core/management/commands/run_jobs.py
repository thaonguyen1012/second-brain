from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from core.services import jobs


class Command(BaseCommand):
    help = "Run due background jobs (cron, e.g. every 5 minutes). Unfurl and LLM calls only happen here."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--limit", type=int, default=100, help="Most jobs to run in this call.")
        parser.add_argument("--kind", action="append", help="Only these job kinds (repeatable).")

    def handle(self, *args: Any, **options: Any) -> None:
        kinds = set(options["kind"]) if options["kind"] else None
        counts = jobs.run_pending(limit=options["limit"], kinds=kinds)
        self.stdout.write(" ".join(f"{k}={v}" for k, v in counts.items()))
