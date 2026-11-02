from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import connection
from django.utils import timezone

from core.services import backup


class Command(BaseCommand):
    help = (
        "pg_dump -Fc of the configured database into BACKUP_DIR/<date>.dump (DECISIONS 10.1), keeping "
        "the newest BACKUP_KEEP dated dumps. `make backup`; deploy/launchd/com.example.brain.backup.plist "
        "runs it nightly."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--dir", type=Path, help="Target directory (default BACKUP_DIR, backend/backups)."
        )
        parser.add_argument("--keep", type=int, help="Dated dumps to keep (default BACKUP_KEEP, 14).")

    def handle(self, *args: Any, **options: Any) -> None:
        directory: Path = (options["dir"] or settings.BACKUP_DIR).resolve()
        keep: int = options["keep"] or settings.BACKUP_KEEP
        try:
            dump, removed = backup.backup(
                connection.settings_dict, directory, timezone.localdate().isoformat(), keep
            )
        except backup.BackupError as exc:
            raise CommandError(str(exc)) from exc
        kept = backup.dated_dumps(directory)
        self.stdout.write(
            f"{dump} ({backup.human_size(dump.stat().st_size)}); dated dumps kept: {len(kept)}"
            + (f", removed {', '.join(p.name for p in removed)}" if removed else "")
        )
