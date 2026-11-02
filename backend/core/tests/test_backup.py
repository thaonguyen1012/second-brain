import shutil
from io import StringIO
from pathlib import Path
from typing import Any

import pytest
from django.contrib.auth.models import User
from django.core.management import CommandError, call_command
from django.db import connection

from core.services import backup
from inbox.models import InboxEntry


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


def test_restore_check_without_dumps_fails(tmp_path: Path) -> None:
    with pytest.raises(CommandError, match="no dump"):
        call_command("restore_check", dir=tmp_path)


@pytest.mark.skipif(not shutil.which("pg_dump"), reason="PostgreSQL client tools are not installed")
@pytest.mark.django_db(transaction=True)
def test_backup_then_restore_check_round_trip(tmp_path: Path, client: Any) -> None:
    client.get("/api/me")
    user = User.objects.get(username="dev@localhost")
    InboxEntry.objects.create(user=user, url="https://example.com/a")
    touch(tmp_path, "2026-01-01.dump", "2026-01-02.dump")

    out = StringIO()
    call_command("backup", dir=tmp_path, keep=2, stdout=out)
    dumps = backup.dated_dumps(tmp_path)
    assert len(dumps) == 2 and dumps[0].name == "2026-01-02.dump"
    assert "removed 2026-01-01.dump" in out.getvalue()
    assert not list(tmp_path.glob("*.partial"))

    InboxEntry.objects.create(user=user, text="written after the dump")
    out = StringIO()
    call_command("restore_check", dir=tmp_path, stdout=out)
    text = out.getvalue()
    assert "restored into" in text and "inbox_inboxentry: dump 1, live 2" in text

    # The throwaway database is gone and the live one is untouched.
    with connection.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM pg_database WHERE datname = %s",
            [backup.throwaway_name(connection.settings_dict["NAME"])],
        )
        assert cur.fetchone() == (0,)
    assert InboxEntry.objects.count() == 2
