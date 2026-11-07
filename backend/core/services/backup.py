"""Local database backups (DECISIONS 10.1): `manage.py backup` and `manage.py restore_check`.

* backup: `pg_dump -Fc` of the configured database into BACKUP_DIR/<YYYY-MM-DD>.dump (written to a
  `.partial` file, then renamed), keeping the newest `keep` dated dumps; a second run on the same day replaces
  that day's file. Then the stored images (THUMBS_DIR: Item images, inbox thumbnails) are mirrored into
  BACKUP_DIR/thumbs/: new files only, never a deletion, so every dump kept can find its images.
* restore_check: restores the newest dump into a throwaway database named `<db>_restore_check_<pid>`, counts
  the rows of every table, compares them with the live database, lists the image names the restored rows
  refer to (the command reports those missing from the mirror), then drops the throwaway database. It never
  writes to the configured database.

A real restore is pg_restore of a dump plus copying BACKUP_DIR/thumbs/* into THUMBS_DIR (deploy/README.md).

The pg tools match the server's major version when a versioned install exists (Homebrew `postgresql@16`,
Debian `/usr/lib/postgresql/16`), because pg_dump 17 output can carry settings a 16 server rejects. PG_BIN_DIR
overrides the lookup. The password goes through PGPASSWORD, never on a command line.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg
from psycopg import sql

DUMP_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}\.dump$")
IMAGE_NAME = re.compile(r"^[0-9A-Za-z]{32}\.webp$")  # a stored image (core/services/thumbnails.py)
MIRROR = "thumbs"  # BACKUP_DIR/thumbs: the image mirror next to the dumps
THROWAWAY_SUFFIX = "_restore_check_"
# Tables whose emptiness after a restore means the dump is broken (they always hold rows once migrated).
MUST_HAVE_ROWS = ("django_migrations", "django_content_type")
# (table, column) of the rows that name a stored image; a column missing from an older dump is skipped.
IMAGE_COLUMNS = (("library_item", "image_path"), ("inbox_inboxentry", "og_image_path"))


class BackupError(RuntimeError):
    pass


@dataclass
class RestoreReport:
    dump: Path
    database: str
    counts: dict[str, int]
    live: dict[str, int]
    differences: dict[str, tuple[int, int]] = field(default_factory=dict)
    images: set[str] = field(default_factory=set)  # image names the restored rows refer to

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def pg_env(db: dict[str, Any]) -> dict[str, str]:
    """Connection settings for the pg tools as libpq environment variables (no secret in argv)."""
    env = dict(os.environ)
    for key, var in (("HOST", "PGHOST"), ("PORT", "PGPORT"), ("USER", "PGUSER"), ("PASSWORD", "PGPASSWORD")):
        value = db.get(key)
        if value:
            env[var] = str(value)
    return env


def server_major(db: dict[str, Any]) -> int:
    with connect(db, db["NAME"]) as conn:
        return int(conn.info.server_version) // 10000


def pg_tool(name: str, major: int | None = None) -> str:
    """Path of a pg tool, preferring the install that matches the server's major version."""
    candidates: list[Path] = []
    if override := os.environ.get("PG_BIN_DIR"):
        candidates.append(Path(override) / name)
    if major:
        candidates += [
            Path(f"/opt/homebrew/opt/postgresql@{major}/bin/{name}"),
            Path(f"/usr/local/opt/postgresql@{major}/bin/{name}"),
            Path(f"/usr/lib/postgresql/{major}/bin/{name}"),
        ]
    for path in candidates:
        if path.is_file() and os.access(path, os.X_OK):
            return str(path)
    found = shutil.which(name)
    if not found:
        raise BackupError(f"{name} not found (set PG_BIN_DIR to the PostgreSQL bin directory)")
    return found


def connect(db: dict[str, Any], dbname: str) -> psycopg.Connection[Any]:
    return psycopg.connect(
        dbname=dbname,
        host=db.get("HOST") or None,
        port=db.get("PORT") or None,
        user=db.get("USER") or None,
        password=db.get("PASSWORD") or None,
        autocommit=True,
    )


def dated_dumps(directory: Path) -> list[Path]:
    """The dated dumps in `directory`, oldest first (the name sorts by date)."""
    if not directory.is_dir():
        return []
    return sorted(p for p in directory.iterdir() if p.is_file() and DUMP_NAME.match(p.name))


def rotate(directory: Path, keep: int) -> list[Path]:
    """Delete all but the newest `keep` dated dumps; other files in the directory are left alone."""
    if keep < 1:
        raise BackupError("keep must be at least 1")
    old = dated_dumps(directory)[:-keep]
    for path in old:
        path.unlink()
    return old


def backup(db: dict[str, Any], directory: Path, day: str, keep: int) -> tuple[Path, list[Path]]:
    """pg_dump -Fc into directory/<day>.dump; returns the dump and the rotated-out files.

    A dump is an unencrypted copy of the whole database (password hashes, sessions, every Note), so the
    directory is owner-only (0700, also when it already existed) and every dump is 0600, whatever the umask.
    """
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    target = directory / f"{day}.dump"
    partial = target.with_name(target.name + ".partial")
    command = [
        pg_tool("pg_dump", server_major(db)),
        "--format=custom",
        "--no-owner",
        "--no-acl",
        f"--file={partial}",
        db["NAME"],
    ]
    try:
        subprocess.run(  # noqa: S603
            command, env=pg_env(db), check=True, capture_output=True, text=True, umask=0o077
        )
    except subprocess.CalledProcessError as exc:
        partial.unlink(missing_ok=True)
        raise BackupError(f"pg_dump failed: {exc.stderr.strip()}") from exc
    partial.chmod(0o600)
    partial.replace(target)
    return target, rotate(directory, keep)


def mirror_images(source: Path, target: Path) -> int:
    """Copy the stored images of `source` (THUMBS_DIR) that `target` (BACKUP_DIR/thumbs) lacks; returns how
    many it copied.

    Never deletes and never rewrites: a name is the hash of the bytes, so it always means the same image, and
    an image removed from the app stays restorable with every dump that still names it. Like the dumps, the
    folder is owner-only (0700) and each file 0600; a file is written as `.partial`, then renamed, so an
    interrupted copy never leaves a truncated image under a real name. Other files (temporary ones) are
    skipped.
    """
    target.mkdir(mode=0o700, parents=True, exist_ok=True)
    target.chmod(0o700)
    if not source.is_dir():
        return 0
    copied = 0
    for path in sorted(source.iterdir()):
        mirrored = target / path.name
        if not IMAGE_NAME.match(path.name) or not path.is_file() or mirrored.exists():
            continue
        partial = mirrored.with_name(mirrored.name + ".partial")
        try:
            with path.open("rb") as image:
                fd = os.open(partial, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(fd, "wb") as copy:
                    shutil.copyfileobj(image, copy)
        except FileNotFoundError:  # discarded by the app since the listing
            partial.unlink(missing_ok=True)
            continue
        partial.chmod(0o600)
        partial.replace(mirrored)
        copied += 1
    return copied


def referenced_images(
    conn: psycopg.Connection[Any], columns: Iterable[tuple[str, str]] = IMAGE_COLUMNS
) -> set[str]:
    """The image names that rows of a database refer to (`columns`: table, column); a column the database
    does not have is skipped (a dump made before Items had images lacks library_item.image_path)."""
    names: set[str] = set()
    for table, column in columns:
        present = conn.execute(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s AND column_name = %s",
            (table, column),
        ).fetchone()
        if present is None:
            continue
        query = sql.SQL("SELECT DISTINCT {column} FROM {table} WHERE {column} <> ''").format(
            column=sql.Identifier(column), table=sql.Identifier("public", table)
        )
        names.update(str(row[0]) for row in conn.execute(query).fetchall())
    return names


def missing_images(names: Iterable[str], mirror: Path) -> list[str]:
    """The names without a file in the image mirror, sorted."""
    return sorted(n for n in names if not IMAGE_NAME.match(n) or not (mirror / n).is_file())


def table_counts(conn: psycopg.Connection[Any]) -> dict[str, int]:
    """Exact row count of every table in the public schema."""
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        ).fetchall()
    ]
    counts: dict[str, int] = {}
    for table in tables:
        row = conn.execute(
            sql.SQL("SELECT count(*) FROM {}").format(sql.Identifier("public", table))
        ).fetchone()
        counts[table] = int(row[0]) if row else 0
    return counts


def throwaway_name(live: str) -> str:
    return f"{live}{THROWAWAY_SUFFIX}{os.getpid()}"[:63]


def restore_check(db: dict[str, Any], dump: Path) -> RestoreReport:
    """Restore `dump` into a throwaway database, count rows, compare with the live database, collect the
    image names its rows refer to, drop it."""
    live_name: str = db["NAME"]
    name = throwaway_name(live_name)
    if name == live_name or THROWAWAY_SUFFIX not in name:
        raise BackupError("refusing to restore over the configured database")
    major = server_major(db)
    with connect(db, live_name) as admin:
        admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
        try:
            command = [
                pg_tool("pg_restore", major),
                "--no-owner",
                "--no-acl",
                "--exit-on-error",
                f"--dbname={name}",
                str(dump),
            ]
            try:
                subprocess.run(command, env=pg_env(db), check=True, capture_output=True, text=True)  # noqa: S603
            except subprocess.CalledProcessError as exc:
                raise BackupError(f"pg_restore failed: {exc.stderr.strip()}") from exc
            with connect(db, name) as restored:
                counts = table_counts(restored)
                images = referenced_images(restored)
        finally:
            admin.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))
        live = table_counts(admin)
    empty = [t for t in MUST_HAVE_ROWS if counts.get(t, 0) == 0]
    if empty:
        raise BackupError(f"restored database has no rows in {', '.join(empty)}")
    differences = {
        t: (counts.get(t, 0), live.get(t, 0))
        for t in sorted(set(counts) | set(live))
        if counts.get(t, 0) != live.get(t, 0)
    }
    return RestoreReport(
        dump=dump, database=name, counts=counts, live=live, differences=differences, images=images
    )


def human_size(n: int) -> str:
    size = float(n)
    for unit in ("B", "kB", "MB", "GB"):
        if size < 1000 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1000
    return f"{n} B"
