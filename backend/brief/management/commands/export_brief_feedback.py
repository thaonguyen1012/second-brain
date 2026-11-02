import json
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser

from brief import services
from core.services.users import get_or_create_owner


class Command(BaseCommand):
    help = (
        "Write the news items Alex rated (useful / not useful) into the `eval brief` golden set "
        "(DECISIONS 10.3), one fb-<id>.json per item. Only the title and the first 500 characters are "
        "written; existing files are kept unless --overwrite."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--out", type=Path, default=settings.BASE_DIR / "evals" / "news_tag")
        parser.add_argument("--overwrite", action="store_true", help="Rewrite fb-*.json files that exist.")
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        owner = get_or_create_owner(options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL)
        out: Path = options["out"]
        out.mkdir(parents=True, exist_ok=True)
        written = kept = 0
        for item in services.rated(owner):
            target = out / f"fb-{item.pk}.json"
            if target.exists() and not options["overwrite"]:
                kept += 1
                continue
            case = services.golden_case(item)
            target.write_text(json.dumps(case, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            written += 1
        self.stdout.write(f"{written} written, {kept} kept (already there) in {out}")
