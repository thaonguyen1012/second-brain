from pathlib import Path

from django.conf import settings


def resolve_attachment(rel_path: str) -> Path | None:
    """Existing regular file under FILES_DIR for a URL path, or None (traversal, symlink escape, missing)."""
    if not rel_path or "\x00" in rel_path or rel_path.startswith("/"):
        return None
    root = attachments_root()
    try:
        target = (root / rel_path).resolve(strict=True)
    except (OSError, RuntimeError):
        return None
    if not target.is_relative_to(root) or not target.is_file():
        return None
    return target


def attachments_root() -> Path:
    return settings.FILES_DIR.resolve()
