from typing import Any

from django.core.management.base import BaseCommand, CommandParser

from core.services import jobs


class Command(BaseCommand):
    help = (
        "Run due background jobs (cron, every 5 minutes): first enqueue the periodic ones (feeds, morning "
        "brief), then run what is due. Fetches and LLM calls only happen here."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--limit", type=int, default=100, help="Most jobs to run in this call.")
        parser.add_argument("--kind", action="append", help="Only these job kinds (repeatable).")
        parser.add_argument(
            "--no-schedule", action="store_true", help="Do not enqueue periodic jobs (feeds, brief) first."
        )

    def handle(self, *args: Any, **options: Any) -> None:
        kinds = set(options["kind"]) if options["kind"] else None
        if not options["no_schedule"]:
            jobs.schedule()
        counts = jobs.run_pending(limit=options["limit"], kinds=kinds)
        self.stdout.write(" ".join(f"{k}={v}" for k, v in counts.items()))
