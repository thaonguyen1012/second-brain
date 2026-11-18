"""manage.py import_notes: the owner's notes from markdown files, matched by label, safe to run again."""

from io import StringIO
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from core.services.users import get_or_create_owner
from library.models import Note
from library.services import note_label

pytestmark = pytest.mark.django_db
OWNER = "dev@localhost"


def run(directory: Path) -> str:
    out = StringIO()
    call_command("import_notes", str(directory), owner=OWNER, stdout=out)
    return out.getvalue()


def test_creates_then_updates_by_label(tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text("# CV, November 2026\n\nFirst version.\n", encoding="utf-8")
    (tmp_path / "b.md").write_text("Plain first line\n\nBody.\n", encoding="utf-8")
    assert "2 created, 0 updated, 0 unchanged" in run(tmp_path)
    notes = list(Note.objects.order_by("id"))
    assert [note_label(n) for n in notes] == ["CV, November 2026", "Plain first line"]
    assert all(n.title == "" for n in notes)
    assert notes[0].user.username == OWNER

    assert "0 created, 0 updated, 2 unchanged" in run(tmp_path)

    (tmp_path / "a.md").write_text("# CV, November 2026\n\nSecond version.\n", encoding="utf-8")
    assert "0 created, 1 updated, 1 unchanged" in run(tmp_path)
    assert Note.objects.count() == 2
    assert "Second version" in Note.objects.get(pk=notes[0].pk).markdown


def test_matches_a_note_whose_title_field_holds_the_label(tmp_path: Path) -> None:
    """A note made with the title field set (the editor leaves it empty) is the same note: updated, not
    doubled."""
    owner = get_or_create_owner(OWNER)
    note = Note.objects.create(user=owner, title="Interview prep", markdown="# Interview prep\n\nold\n")
    (tmp_path / "prep.md").write_text("# Interview prep\n\nnew\n", encoding="utf-8")
    assert "0 created, 1 updated" in run(tmp_path)
    note.refresh_from_db()
    assert note.title == "" and "new" in note.markdown
    assert Note.objects.count() == 1


def test_other_notes_and_an_empty_file_are_left_alone(tmp_path: Path) -> None:
    other = Note.objects.create(user=get_or_create_owner(OWNER), title="", markdown="Mine\n")
    (tmp_path / "a.md").write_text("# New\n", encoding="utf-8")
    run(tmp_path)
    other.refresh_from_db()
    assert other.markdown == "Mine\n"
    assert Note.objects.count() == 2

    (tmp_path / "empty.md").write_text("\n\n---\n\n", encoding="utf-8")
    with pytest.raises(CommandError, match=r"empty\.md"):
        run(tmp_path)


def test_no_files_is_an_error(tmp_path: Path) -> None:
    with pytest.raises(CommandError, match=r"no \.md file"):
        run(tmp_path)


def test_seed_directory_is_the_default() -> None:
    out = StringIO()
    call_command("import_notes", owner=OWNER, stdout=out)
    assert Note.objects.count() >= 2
    labels = {note_label(n) for n in Note.objects.all()}
    assert any("CV" in label for label in labels)
