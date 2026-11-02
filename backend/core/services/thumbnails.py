"""Link thumbnails: decode with Pillow (decompression-bomb limit), re-encode as webp <= MAX_BYTES, store
under THUMBS_DIR (outside any web root; served through X-Accel-Redirect)."""

import hashlib
import io
import os
import tempfile
import warnings
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

MAX_BYTES = 200 * 1024
MAX_PIXELS = 20_000_000  # decoded size above this is refused (bomb)
FORMATS = frozenset({"JPEG", "PNG", "GIF", "WEBP"})
SIZES = (1200, 800, 600, 400)
QUALITIES = (80, 65, 50)
Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # Pillow warns above this and raises above twice this


class ThumbnailError(Exception):
    pass


def to_webp(data: bytes) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=sorted(FORMATS)) as source:
                source.seek(0)  # first frame of animations
                source.draft("RGB", (SIZES[0], SIZES[0]))  # JPEG: decode at reduced scale
                source.thumbnail((SIZES[0], SIZES[0]))  # shrink before any full-size copy
                image = ImageOps.exif_transpose(source).convert("RGBA")
    except (
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise ThumbnailError(f"cannot decode image: {type(exc).__name__}") from exc
    for size in SIZES:
        frame = image.copy()
        frame.thumbnail((size, size))
        for quality in QUALITIES:
            out = io.BytesIO()
            frame.save(out, "WEBP", quality=quality, method=4)
            if out.tell() <= MAX_BYTES:
                return out.getvalue()
    raise ThumbnailError("cannot fit the thumbnail in the size limit")


def store(webp: bytes) -> str:
    """Write the thumbnail (content-addressed) and return its file name."""
    name = hashlib.sha256(webp).hexdigest()[:32] + ".webp"
    root = Path(settings.THUMBS_DIR)
    root.mkdir(parents=True, exist_ok=True)
    target = root / name
    if not target.exists():
        fd, tmp = tempfile.mkstemp(dir=root, suffix=".tmp")
        with os.fdopen(fd, "wb") as f:
            f.write(webp)
        os.replace(tmp, target)
    return name


def path_of(name: str) -> Path | None:
    """Existing thumbnail file for a stored name, or None."""
    if len(name) != 37 or not name.endswith(".webp") or not name[:32].isalnum():
        return None
    target = Path(settings.THUMBS_DIR) / name
    return target if target.is_file() else None


def discard(name: str) -> None:
    """Remove a stored thumbnail; callers check first that no row still uses the name (content addressed)."""
    if (target := path_of(name)) is not None:
        target.unlink(missing_ok=True)
