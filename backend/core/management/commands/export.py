from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandParser
from django.utils import timezone

from core.services import export
from core.services.users import get_or_create_owner


class Command(BaseCommand):
    help = (
        "Export the owner's data (DECISIONS 4.7): notes as markdown with front matter in <out>/notes/, every "
        "other model as JSON in <out>/data/, the Item images in <out>/images/. No secrets, no Job or "
        "LlmCache rows."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--out",
            type=Path,
            help="Target directory (created if missing); default backend/exports/<date> (gitignored).",
        )
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        owner = get_or_create_owner(options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL)
        out: Path = options["out"] or settings.BASE_DIR / "exports" / timezone.localdate().isoformat()
        counts = export.export(owner, out.resolve())
        images = counts.pop("images", 0)
        total = sum(counts.values())
        self.stdout.write(
            f"{total} rows ({counts['notes']} notes) and {images} images exported to {out.resolve()}"
        )
