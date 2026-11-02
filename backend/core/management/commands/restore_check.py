from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import connection

from core.services import backup


class Command(BaseCommand):
    help = (
        "Restore the newest dump of BACKUP_DIR (or --dump) into a throwaway database, count the rows of "
        "every table, compare with the live database, then drop the throwaway database (DECISIONS 10.1)."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--dump", type=Path, help="Dump to check (default: the newest in BACKUP_DIR).")
        parser.add_argument("--dir", type=Path, help="Backup directory (default BACKUP_DIR).")

    def handle(self, *args: Any, **options: Any) -> None:
        dump: Path | None = options["dump"]
        if dump is None:
            dumps = backup.dated_dumps((options["dir"] or settings.BACKUP_DIR).resolve())
            if not dumps:
                raise CommandError("no dump found; run `make backup` first")
            dump = dumps[-1]
        if not dump.is_file():
            raise CommandError(f"{dump} does not exist")
        try:
            report = backup.restore_check(connection.settings_dict, dump.resolve())
        except backup.BackupError as exc:
            raise CommandError(str(exc)) from exc
        size = backup.human_size(dump.stat().st_size)
        self.stdout.write(
            f"{dump.name} ({size}) restored into {report.database} and dropped: {len(report.counts)} tables, "
            f"{report.total} rows"
        )
        for table, n in sorted(report.counts.items(), key=lambda kv: (-kv[1], kv[0])):
            if n:
                self.stdout.write(f"  {n:>8}  {table}")
        if report.differences:
            self.stdout.write("Differences with the live database (rows written since the dump):")
            for table, (restored, live) in report.differences.items():
                self.stdout.write(f"  {table}: dump {restored}, live {live}")
        else:
            self.stdout.write("Row counts match the live database.")
