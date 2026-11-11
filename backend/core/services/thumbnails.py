"""Stored images: inbox link thumbnails and Item images (covers, project logos; DECISIONS 9.6). Decode
with Pillow (decompression-bomb limit), re-encode as webp <= MAX_BYTES, store under THUMBS_DIR (outside any
web root; served through X-Accel-Redirect).

A file's name is the hash of its bytes, so rows of either table and of any owner can share one file: a file
goes only through discard_if_unused, never while a row still names it.
"""

import hashlib
import io
import os
import tempfile
import warnings
from pathlib import Path

from django.conf import settings
from PIL import Image, ImageOps

from inbox.models import InboxEntry
from library.models import Item

MAX_BYTES = 200 * 1024
MAX_PIXELS = 20_000_000  # decoded size above this is refused (bomb)
FORMATS = frozenset({"JPEG", "PNG", "GIF", "WEBP"})
SIZES = (1200, 800, 600, 400)  # inbox link cards
# Item images are shown at most ~280 css px wide: 600 px covers 2x screens and keeps lists light.
ITEM_SIZES = (600, 400)
QUALITIES = (80, 65, 50)
Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # Pillow warns above this and raises above twice this


class ThumbnailError(Exception):
    pass


def to_webp(data: bytes, sizes: tuple[int, ...] = SIZES) -> bytes:
    """The first frame, turned by its EXIF orientation, as a webp whose longer side is at most the first of
    `sizes` that fits in MAX_BYTES (each size tried at QUALITIES). Pillow reads the bytes themselves (JPEG,
    PNG, GIF or WebP only), whatever type the sender claimed; anything else, a bomb or an image that does not
    fit raises ThumbnailError."""
    largest = sizes[0]
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=sorted(FORMATS)) as source:
                source.seek(0)  # first frame of animations
                source.draft("RGB", (largest, largest))  # JPEG: decode at reduced scale
                source.thumbnail((largest, largest))  # shrink before any full-size copy
                image = ImageOps.exif_transpose(source).convert("RGBA")
    except Exception as exc:  # third-party bytes: Pillow raises many types (struct.error on bad EXIF, S-06)
        raise ThumbnailError(f"cannot decode image: {type(exc).__name__}") from exc
    for size in sizes:
        frame = image.copy()
        frame.thumbnail((size, size))
        for quality in QUALITIES:
            out = io.BytesIO()
            frame.save(out, "WEBP", quality=quality, method=4)
            if out.tell() <= MAX_BYTES:
                return out.getvalue()
    raise ThumbnailError("cannot fit the thumbnail in the size limit")


def store(webp: bytes) -> str:
    """Write the image (content addressed) and return its file name. The file is world-readable (0644, not
    mkstemp's 0600): in production nginx, another user than the app, sends it (X-Accel-Redirect)."""
    name = hashlib.sha256(webp).hexdigest()[:32] + ".webp"
    root = Path(settings.THUMBS_DIR)
    root.mkdir(parents=True, exist_ok=True)
    target = root / name
    if not target.exists():
        fd, tmp = tempfile.mkstemp(dir=root, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(webp)
            os.chmod(tmp, 0o644)
            os.replace(tmp, target)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise
    return name


def path_of(name: str) -> Path | None:
    """Existing image file for a stored name, or None (also for "" and anything that is not a stored name)."""
    if len(name) != 37 or not name.endswith(".webp") or not name[:32].isalnum():
        return None
    target = Path(settings.THUMBS_DIR) / name
    return target if target.is_file() else None


def in_use(name: str) -> bool:
    """Whether a row still names the file: an inbox thumbnail or an Item image, of any owner."""
    return (
        InboxEntry.objects.filter(og_image_path=name).exists()
        or Item.objects.filter(image_path=name).exists()
    )


def discard_if_unused(name: str) -> None:
    """Remove the file unless a row still names it ("" does nothing). Call it once the change that dropped the
    reference is committed (transaction.on_commit), so the check sees it."""
    if name and not in_use(name):
        _unlink(name)


def _unlink(name: str) -> None:
    if (target := path_of(name)) is not None:
        target.unlink(missing_ok=True)
