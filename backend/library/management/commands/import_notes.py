from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError, CommandParser
from django.db import transaction

from core.services.users import get_or_create_owner
from library import services
from library.models import Note


class Command(BaseCommand):
    help = (
        "Create or update the owner's notes from markdown files (default backend/seed/notes, the notes that "
        "travel with the code to a machine with its own database). A file is one note; its first line with "
        "text is the note's label (the title field stays empty, as for a note typed in the editor). A note "
        "the owner has with the same label is updated to the file's text, any other note is left alone, so "
        "the command is safe to run after every release."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("directory", nargs="?", default=str(Path(__file__).parents[3] / "seed" / "notes"))
        parser.add_argument("--owner", help="Owner email (default OWNER_EMAIL, or DEV_USER_EMAIL in dev).")

    def handle(self, *args: Any, **options: Any) -> None:
        directory = Path(options["directory"])
        files = sorted(directory.glob("*.md"))
        if not files:
            raise CommandError(f"no .md file in {directory}")
        owner = get_or_create_owner(options["owner"] or settings.OWNER_EMAIL or settings.DEV_USER_EMAIL)
        created = updated = unchanged = 0
        with transaction.atomic():
            mine = list(Note.objects.filter(user=owner).order_by("id"))
            for file in files:
                markdown = file.read_text(encoding="utf-8")
                label = services.note_label(Note(title="", markdown=markdown))
                if not label:
                    raise CommandError(f"{file.name}: no line with text to name the note")
                same = [note for note in mine if services.note_label(note) == label]
                if same:
                    note = same[0]
                    if note.title == "" and note.markdown == markdown:
                        unchanged += 1
                        continue
                    services.save_note(note, {"title": "", "markdown": markdown})
                    updated += 1
                else:
                    note = services.save_note(Note(user=owner), {"title": "", "markdown": markdown})
                    mine.append(note)
                    created += 1
                self.stdout.write(f"{file.name}: note {note.pk}, {label[:60]}")
        self.stdout.write(f"{created} created, {updated} updated, {unchanged} unchanged")
