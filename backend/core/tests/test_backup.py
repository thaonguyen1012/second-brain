import shutil
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.db import connection

from core.services import backup, thumbnails
from core.testing import image_bytes
from inbox.models import InboxEntry
from library.models import Item


def touch(directory: Path, *names: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name in names:
        (directory / name).write_bytes(b"x")


def test_rotate_keeps_the_newest_dated_dumps_and_ignores_other_files(tmp_path: Path) -> None:
    touch(tmp_path, "2026-10-30.dump", "2026-11-01.dump", "2026-10-31.dump", "notes.txt", "x.dump.partial")
    removed = backup.rotate(tmp_path, keep=2)
    assert [p.name for p in removed] == ["2026-10-30.dump"]
    assert sorted(p.name for p in tmp_path.iterdir()) == [
        "2026-10-31.dump",
        "2026-11-01.dump",
        "notes.txt",
        "x.dump.partial",
    ]
    with pytest.raises(backup.BackupError):
        backup.rotate(tmp_path, keep=0)


def test_dated_dumps_of_a_missing_directory_is_empty(tmp_path: Path) -> None:
    assert backup.dated_dumps(tmp_path / "missing") == []


def test_password_goes_through_the_environment_and_throwaway_name_is_never_the_live_one() -> None:
    env = backup.pg_env({"HOST": "localhost", "PORT": 5432, "USER": "u", "PASSWORD": "pw"})
    assert (env["PGHOST"], env["PGPORT"], env["PGUSER"], env["PGPASSWORD"]) == (
        "localhost",
        "5432",
        "u",
        "pw",
    )
    name = backup.throwaway_name("alex_brain")
    assert name != "alex_brain" and name.startswith("alex_brain_restore_check_")
    assert len(backup.throwaway_name("x" * 80)) == 63


def test_pg_tool_prefers_pg_bin_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    tool = tmp_path / "pg_dump"
    tool.write_text("#!/bin/sh\n")
    tool.chmod(0o755)
    monkeypatch.setenv("PG_BIN_DIR", str(tmp_path))
    assert backup.pg_tool("pg_dump", 16) == str(tool)
    monkeypatch.setenv("PATH", "/nonexistent")
    with pytest.raises(backup.BackupError):
        backup.pg_tool("pg_tool_that_does_not_exist", 16)


def test_backup_files_are_owner_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # A stand-in pg_dump that writes its --file argument with the umask it was given
    tool = tmp_path / "bin" / "pg_dump"
    tool.parent.mkdir()
    tool.write_text(
        '#!/bin/sh\nfor a in "$@"; do case "$a" in --file=*) echo dump > "${a#--file=}";; esac; done\n'
    )
    tool.chmod(0o755)
    monkeypatch.setattr(backup, "server_major", lambda db: 16)
    monkeypatch.setattr(backup, "pg_tool", lambda name, major=None: str(tool))
    directory = tmp_path / "backups"
    directory.mkdir(mode=0o755)
    directory.chmod(0o755)

    target, _ = backup.backup({"NAME": "alex_brain"}, directory, "2026-11-02", keep=3)
    assert target.read_text() == "dump\n"
    assert target.stat().st_mode & 0o777 == 0o600
    assert directory.stat().st_mode & 0o777 == 0o700

    fresh = tmp_path / "new" / "backups"
    target, _ = backup.backup({"NAME": "alex_brain"}, fresh, "2026-11-02", keep=3)
    assert target.stat().st_mode & 0o777 == 0o600
    assert fresh.stat().st_mode & 0o777 == 0o700


def test_the_image_mirror_copies_new_files_only_and_never_deletes(tmp_path: Path) -> None:
    source, mirror = tmp_path / "thumbs", tmp_path / "backups" / "thumbs"
    new, kept, gone = ("a" * 32 + ".webp", "b" * 32 + ".webp", "c" * 32 + ".webp")
    source.mkdir()
    (source / new).write_bytes(b"new image")
    (source / kept).write_bytes(b"same name, same bytes")
    (source / "x1y2.tmp").write_bytes(b"being written")  # store()'s temporary file
    (source / "notes.txt").write_bytes(b"not an image")
    mirror.mkdir(parents=True, mode=0o755)
    (mirror / kept).write_bytes(b"copied last night")
    (mirror / gone).write_bytes(b"removed from the app since")

    assert backup.mirror_images(source, mirror) == 1
    assert sorted(p.name for p in mirror.iterdir()) == sorted([new, kept, gone])
    assert (mirror / new).read_bytes() == b"new image"
    assert (mirror / kept).read_bytes() == b"copied last night"  # an existing name is never rewritten
    assert (mirror / new).stat().st_mode & 0o777 == 0o600
    assert mirror.stat().st_mode & 0o777 == 0o700
    assert backup.mirror_images(source, mirror) == 0
    assert backup.mirror_images(tmp_path / "missing", tmp_path / "empty") == 0
    assert backup.missing_images([new, "d" * 32 + ".webp", "../etc/passwd"], mirror) == [
        "../etc/passwd",
        "d" * 32 + ".webp",
    ]


@pytest.mark.django_db
def test_image_names_of_a_dump_made_before_item_images() -> None:
    # An older dump has no library_item.image_path: that column is skipped instead of failing the check.
    with backup.connect(connection.settings_dict, connection.settings_dict["NAME"]) as conn:
        assert backup.referenced_images(conn, (("library_item", "no_such_column"),)) == set()
        assert backup.referenced_images(conn) == set()  # both real columns exist (no committed rows)


def test_restore_check_without_dumps_fails(tmp_path: Path) -> None:
    with pytest.raises(CommandError, match="no dump"):
        call_command("restore_check", dir=tmp_path)


def test_restore_check_lists_ten_missing_images_at_most(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    touch(tmp_path, "2026-11-07.dump")
    dump = tmp_path / "2026-11-07.dump"
    names = {f"{n:032x}.webp" for n in range(12)}  # none of them in the (missing) mirror
    report = backup.RestoreReport(
        dump=dump, database="throwaway", counts={"library_item": 12}, live={"library_item": 12}, images=names
    )

    def restored(db: dict[str, Any], path: Path) -> backup.RestoreReport:
        return report

    monkeypatch.setattr(backup, "restore_check", restored)
    out = StringIO()
    call_command("restore_check", dump=dump, stdout=out)
    lines = out.getvalue().splitlines()
    assert any(line.startswith("images: 12 referenced, 12 missing from the backup") for line in lines)
    shown = [line for line in lines if line.startswith("  missing: ")]
    assert shown == [f"  missing: {name}" for name in sorted(names)[:10]]
    assert lines[-1] == "  ... and 2 more"


@pytest.mark.skipif(not shutil.which("pg_dump"), reason="PostgreSQL client tools are not installed")
@pytest.mark.django_db(transaction=True)
def test_backup_then_restore_check_round_trip(tmp_path: Path, client: Any, settings: Any) -> None:
    settings.THUMBS_DIR = tmp_path / "media"
    client.get("/api/me")
    user = User.objects.get(username="dev@localhost")
    cover = thumbnails.store(thumbnails.to_webp(image_bytes(), thumbnails.ITEM_SIZES))
    never_stored = "e" * 32 + ".webp"  # a row naming a file that is not on disk
    InboxEntry.objects.create(user=user, url="https://example.com/a", og_image_path=never_stored)
    Item.objects.create(user=user, type="book", title="Dune", image_path=cover)
    touch(tmp_path, "2026-01-01.dump", "2026-01-02.dump")

    out = StringIO()
    call_command("backup", dir=tmp_path, keep=2, stdout=out)
    dumps = backup.dated_dumps(tmp_path)
    assert len(dumps) == 2 and dumps[0].name == "2026-01-02.dump"
    assert "removed 2026-01-01.dump" in out.getvalue()
    assert not list(tmp_path.glob("*.partial"))
    assert f"images: 1 copied to {tmp_path / 'thumbs'}" in out.getvalue()
    assert (tmp_path / "thumbs" / cover).read_bytes() == (tmp_path / "media" / cover).read_bytes()

    InboxEntry.objects.create(user=user, text="written after the dump")
    out = StringIO()
    call_command("restore_check", dir=tmp_path, stdout=out)
    text = out.getvalue()
    assert "restored into" in text and "inbox_inboxentry: dump 1, live 2" in text
    assert "images: 2 referenced, 1 missing from the backup" in text
    assert f"  missing: {never_stored}" in text

    # The throwaway database is gone and the live one is untouched.
    with connection.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM pg_database WHERE datname = %s",
            [backup.throwaway_name(connection.settings_dict["NAME"])],
        )
        assert cur.fetchone() == (0,)
    assert InboxEntry.objects.count() == 2
